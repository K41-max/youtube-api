import cluster from 'cluster';
import { CACHE_MANAGER, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import Consola from 'consola';
import { Model } from 'mongoose';
import fetch from 'node-fetch';
import { AppClusterService } from 'server/app-cluster.service';
import { ChannelBasicInfo } from '../channels/schemas/channel-basic-info.schema';
import { VideoBasicInfoDto } from '../videos/dto/video-basic-info.dto';
import { PopularDto } from './dto/popular.dto';
import { Popular } from './schemas/popular.schema';

@Injectable()
export class HomepageService {
  constructor(
    @InjectModel(Popular.name)
    private readonly PopularModel: Model<Popular>,
    @InjectModel(ChannelBasicInfo.name)
    private readonly ChannelBasicInfoModel: Model<ChannelBasicInfo>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  private popularPageUrl =
    'https://invidious.snopyta.org/api/v1/popular?fields=type,title,videoId,videoThumbnails,lengthSeconds,viewCount,author,authorId,publishedText';

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async refreshPopular(): Promise<void> {
    if ((cluster.worker && cluster.worker.id === 1) || !AppClusterService.isClustered) {
      Consola.info('Refreshing popular page');
      try {
        const popularPage = await fetch(this.popularPageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:84.0) Gecko/20100101 Firefox/84.0'
          }
        }).then(val => val.json());
        const popularVideos = [];
        await Promise.allSettled(
          popularPage.map(async (video: VideoBasicInfoDto) => {
            const hasResult = await fetch(`https://i.ytimg.com/vi/${video.videoId}/default.jpg`)
              .then(response => response.ok)
              .catch(_ => {
                return false;
              });
            if (hasResult) {
              popularVideos.push(video);
            } else {
              // Ignores videos, where thumbnails return an error, as they are most likely unavailable
            }
          })
        );

        const channelIds = popularVideos.map((video: VideoBasicInfoDto) => video.authorId);

        const channelBasicInfoArray = await this.ChannelBasicInfoModel.find({
          authorId: { $in: channelIds }
        }).exec();

        popularVideos.forEach((video: VideoBasicInfoDto) => {
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

        if (popularVideos.length > 0) {
          const updatedPopularPage = new this.PopularModel({
            videos: popularVideos,
            createdDate: Date.now().valueOf()
          });
          updatedPopularPage.save();
        }

        await this.cacheManager.del('popular');
      } catch (err) {
        Consola.error('Popular page refresh failed. URL: ' + this.popularPageUrl);
        Consola.error(err);
      }
    }
  }

  async getPopular(): Promise<PopularDto> {
    try {
      const popularVideos = await this.PopularModel.find()
        .sort({ createdDate: -1 })
        .limit(1)
        .exec();
      return {
        videos: popularVideos[0].videos,
        updatedAt: popularVideos[0].createdDate
      };
    } catch (error) {
      throw new InternalServerErrorException('Error loading the homepage.');
    }
  }
}
