import {
  Injectable,
  HttpException,
  NotFoundException,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { VideoBasicInfo } from 'server/core/videos/schemas/video-basic-info.schema';
import { ChannelBasicInfo } from 'server/core/channels/schemas/channel-basic-info.schema';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VideoBasicInfoDto } from 'server/core/videos/dto/video-basic-info.dto';
import { Sorting } from 'server/common/sorting.type';
import { ChannelBasicInfoDto } from 'server/core/channels/dto/channel-basic-info.dto';
import Consola from 'consola';
import { NotificationsService } from '../notifications/notifications.service';
import { Subscription } from './schemas/subscription.schema';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { getChannelFeed, runSubscriptionsJob } from './subscriptions-job';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(VideoBasicInfo.name)
    private readonly VideoModel: Model<VideoBasicInfo>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(ChannelBasicInfo.name)
    private readonly ChannelBasicInfoModel: Model<ChannelBasicInfo>,
    private notificationsService: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async collectSubscriptionsJob(): Promise<void> {
    const timeMeasurementName = 'subscription-job ' + new Date().toISOString();
    console.time(timeMeasurementName);
    const users = await this.subscriptionModel.find().lean(true).exec();
    const channelIds = users.reduce(
      (val, { subscriptions }) => [...val, ...subscriptions.map(e => e.channelId)],
      []
    );
    const uniqueChannelIds = [...new Set(channelIds)];
    const subscriptionResults = await runSubscriptionsJob(uniqueChannelIds);

    this.sendUserNotifications(subscriptionResults.videoResultArray);

    const channelsToUpdate = subscriptionResults.channelResultArray.map(channel => {
      return {
        updateOne: {
          filter: { authorId: channel.authorId },
          update: { $set: channel },
          upsert: true
        }
      };
    });

    const videosToUpdate = subscriptionResults.videoResultArray.map(video => {
      return {
        updateOne: {
          filter: { videoId: video.videoId },
          update: { $set: video },
          upsert: true
        }
      };
    });

    await this.ChannelBasicInfoModel.bulkWrite(channelsToUpdate);
    await this.VideoModel.bulkWrite(videosToUpdate);
    console.timeEnd(timeMeasurementName);
  }

  async saveChannelBasicInfo(channel: ChannelBasicInfoDto): Promise<ChannelBasicInfoDto | null> {
    const savedChannel = await this.ChannelBasicInfoModel.findOneAndUpdate(
      { authorId: channel.authorId },
      channel,
      {
        upsert: true,
        omitUndefined: true,
        new: true
      }
    )
      .exec()
      .catch(_ => Consola.error('Error saving channel info for id ' + channel.authorId));
    return savedChannel || null;
  }

  async saveVideoBasicInfo(video: VideoBasicInfoDto): Promise<VideoBasicInfoDto | null> {
    const savedVideo = await this.VideoModel.findOneAndUpdate({ videoId: video.videoId }, video, {
      upsert: true
    }).exec();
    return savedVideo || null;
  }

  async sendUserNotifications(videos: Array<VideoBasicInfoDto>): Promise<void> {
    const users = await this.subscriptionModel.find().lean().exec();
    const notificationsToSend: Array<{ username: string; videos: Array<VideoBasicInfoDto> }> = [];
    videos.forEach(video => {
      const subscribedUsers = users.filter(u =>
        u.subscriptions.find(sub => sub.channelId === video.authorId)
      );
      if (subscribedUsers) {
        subscribedUsers.forEach((user: Subscription) => {
          const channelSubscription = user.subscriptions.find(e => e.channelId === video.authorId);
          if (
            channelSubscription.createdAt &&
            channelSubscription.createdAt.valueOf() < video.published
          ) {
            const notification = notificationsToSend.find(
              notification => notification.username === user.username
            );
            if (notification) {
              notification.videos.push(video);
            } else {
              notificationsToSend.push({ username: user.username, videos: [video] });
            }
          }
        });
      }
    });
    await this.notificationsService.sendMultipleNotifications(notificationsToSend);
  }

  async getSubscribedChannelsCount(username: string): Promise<number> {
    const user = await this.subscriptionModel
      .findOne({ username })
      .exec()
      .catch(_ => {});

    if (user) {
      return user.subscriptions.length;
    }
    return 0;
  }

  async getSubscribedChannels(
    username: string,
    limit: number,
    start: number,
    sort: Sorting<ChannelBasicInfoDto>,
    filter: string
  ): Promise<{ channels: Array<ChannelBasicInfoDto>; channelCount: number }> {
    const user = await this.subscriptionModel
      .findOne({ username })
      .exec()
      .catch(_ => {});
    if (user) {
      const userChannelIds = user.subscriptions.map(e => e.channelId);
      if (userChannelIds) {
        const channelCount = await this.ChannelBasicInfoModel.countDocuments({
          authorId: { $in: userChannelIds },
          author: { $regex: `.*${filter}.*`, $options: 'i' }
        }).exec();
        const channels = await this.ChannelBasicInfoModel.find({
          authorId: { $in: userChannelIds },
          author: { $regex: `.*${filter}.*`, $options: 'i' }
        })
          .sort(sort)
          .skip(parseInt(start as any))
          .limit(parseInt(limit as any))
          .catch(_ => {
            return null;
          });

        if (channels) {
          return {
            channels,
            channelCount
          };
        }
      }
    }
    return { channels: [], channelCount: 0 };
  }

  async getSubscriptionFeed(
    username: string,
    limit: number,
    start: number
  ): Promise<{ videoCount: number; videos: Array<VideoBasicInfoDto> }> {
    const userSubscriptions = await this.subscriptionModel.findOne({ username }).lean().exec();
    if (userSubscriptions) {
      const userSubscriptionIds = userSubscriptions.subscriptions.map(e => e.channelId);
      const videoCount = await this.VideoModel.countDocuments({
        authorId: { $in: userSubscriptionIds }
      }).exec();
      const videos = await this.VideoModel.find({ authorId: { $in: userSubscriptionIds } })
        .sort({ published: -1 })
        .limit(parseInt(limit as any))
        .skip(parseInt(start as any))
        .map((el: any) => {
          delete el._id;
          delete el.__v;
          return el;
        })
        .catch(err => {
          throw new HttpException(`Error fetching subscription feed: ${err}`, 500);
        });
      if (videos) {
        const channelIds = videos.map((video: VideoBasicInfoDto) => video.authorId);

        const channelBasicInfoArray = await this.ChannelBasicInfoModel.find({
          authorId: { $in: channelIds }
        }).exec();

        videos.forEach((video: VideoBasicInfoDto) => {
          const channelInfo = channelBasicInfoArray.find(
            channel => channel.authorId === video.authorId
          );
          if (channelInfo) {
            if (channelInfo.authorThumbnailUrl) {
              video.authorThumbnailUrl = channelInfo.authorThumbnailUrl;
            } else if (channelInfo.authorThumbnails) {
              video.authorThumbnails = channelInfo.authorThumbnails;
            }

            if (channelInfo.authorVerified) {
              video.authorVerified = channelInfo.authorVerified;
            }
          }
        });
        return { videos, videoCount };
      }
    }
    return { videos: [], videoCount: 0 };
  }

  async getSubscription(username: string, channelId: string): Promise<SubscriptionStatusDto> {
    const user = await this.subscriptionModel.findOne({ username }).exec();
    if (user && user.subscriptions.length > 0) {
      const subscription = user.subscriptions.find(e => e.channelId === channelId);
      if (subscription) {
        return {
          channelId,
          isSubscribed: true
        };
      }
    }
    return {
      channelId,
      isSubscribed: false
    };
  }

  async subscribeToMultipleChannels(
    username: string,
    channelIds: Array<string>
  ): Promise<{
    successful: Array<SubscriptionStatusDto>;
    failed: Array<SubscriptionStatusDto>;
    existing: Array<SubscriptionStatusDto>;
  }> {
    const successful: Array<SubscriptionStatusDto> = [];
    const failed: Array<SubscriptionStatusDto> = [];
    const existing: Array<SubscriptionStatusDto> = [];
    const user = await this.subscriptionModel.findOne({ username }).exec();
    const subscriptions = user !== null ? user.subscriptions : [];

    await Promise.allSettled(
      channelIds
        .filter(channelId => {
          if (subscriptions.find(e => e.channelId === channelId)) {
            existing.push({ channelId, isSubscribed: true });
            return false;
          }
          return true;
        })
        .map(async (id: string) => {
          const channelFeed = await getChannelFeed(id);
          if (channelFeed) {
            let channel: ChannelBasicInfoDto;
            try {
              channel = await this.saveChannelBasicInfo(channelFeed.channel);
              await Promise.all(
                channelFeed.videos.map(vid => {
                  return this.saveVideoBasicInfo(vid);
                })
              );
            } catch (err) {
              failed.push({
                channelId: id,
                isSubscribed: false
              });
            }
            if (channel) {
              if (!subscriptions.find(e => e.channelId === channel.authorId)) {
                subscriptions.push({
                  channelId: channel.authorId,
                  createdAt: new Date()
                });

                successful.push({
                  channelId: channel.authorId,
                  isSubscribed: true
                });
              } else {
                existing.push({
                  channelId: channel.authorId,
                  isSubscribed: true
                });
              }
            }
          } else {
            failed.push({
              channelId: id,
              isSubscribed: false
            });
          }
        })
    ).then(() => {
      return this.subscriptionModel
        .findOneAndUpdate({ username }, { username, subscriptions }, { upsert: true })
        .exec()
        .catch(_ => {
          throw new InternalServerErrorException('Error updating subscriptions');
        });
    });
    return { successful, failed, existing };
  }

  async deleteAllSubscribedChannels(username: string): Promise<{ success: boolean }> {
    let successful = true;
    await this.subscriptionModel
      .deleteOne({ username })
      .exec()
      .catch(_ => {
        successful = false;
      });
    return { success: successful };
  }

  /**
   *
   * @param {string} username
   * @param {string} channelId
   *
   * @returns {SubscriptionStatusDto} The subscription status
   */
  async subscribeToChannel(username: string, channelId: string): Promise<SubscriptionStatusDto> {
    const user = await this.subscriptionModel.findOne({ username }).exec();

    const channelFeed = await getChannelFeed(channelId);
    if (channelFeed) {
      let channel: ChannelBasicInfoDto;

      try {
        channel = await this.saveChannelBasicInfo(channelFeed.channel);
        await Promise.all(
          channelFeed.videos.map(vid => {
            return this.saveVideoBasicInfo(vid);
          })
        );
      } catch (_) {}
      const subscriptions = user ? user.subscriptions : [];

      const currentSubscription = subscriptions.find(e => e.channelId === channel.authorId);

      if (!currentSubscription) {
        subscriptions.push({
          channelId: channel.authorId,
          createdAt: new Date()
        });
      }

      await this.subscriptionModel
        .findOneAndUpdate({ username }, { username, subscriptions }, { upsert: true })
        .exec()
        .then()
        .catch(_ => {
          throw new InternalServerErrorException('Error subscribing to channel');
        });

      return {
        channelId,
        isSubscribed: true
      };
    }
  }

  async unsubscribeFromChannel(
    username: string,
    channelId: string
  ): Promise<SubscriptionStatusDto> {
    const user = await this.subscriptionModel.findOne({ username }).exec();
    if (
      user &&
      user.subscriptions &&
      user.subscriptions.length > 0 &&
      user.subscriptions.find(e => e.channelId === channelId)
    ) {
      user.subscriptions = user.subscriptions.filter(e => e.channelId !== channelId);
      await user.save();

      return {
        channelId,
        isSubscribed: false
      };
    }
    throw new NotFoundException({
      message: 'User or subscription not found',
      ignoreFilter: true
    });
  }
}
