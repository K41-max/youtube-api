import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import {
  Injectable,
  HttpException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { UserprofileDto } from 'server/user/dto/userprofile.dto';
import humanizeDuration from 'humanize-duration';
import { Common } from 'server/core/common';
import { ChannelBasicInfoDto } from 'server/core/channels/dto/channel-basic-info.dto';
import Consola from 'consola';
import { FastifyReply } from 'fastify';
import archiver from 'archiver';
import { ViewTubeRequest } from 'server/common/viewtube-request';
import { User } from './schemas/user.schema';
import { UserDto } from './user.dto';
import { SettingsService } from './settings/settings.service';
import { UserprofileDetailsDto } from './dto/userprofile-details.dto';
import { HistoryService } from './history/history.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { profileImage } from './profile-image';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly UserModel: Model<User>,
    private settingsService: SettingsService,
    private historyService: HistoryService,
    private subscriptionsService: SubscriptionsService,
    private configService: ConfigService
  ) {}

  static getDateString(): string {
    const date = new Date();

    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  }

  async getProfile(username: string): Promise<UserprofileDto> {
    if (username) {
      const userSettings = await this.settingsService.getSettings(username);
      const user = await this.UserModel.findOne({ username }).exec();
      return {
        username,
        profileImage: user.profileImage ? `/api/user/profile/image/${username}` : null,
        settings: userSettings
      };
    }
  }

  async getProfileDetails(username: string): Promise<UserprofileDetailsDto> {
    if (username) {
      const user = await this.UserModel.findOne({ username }).exec();
      const videoHistory = await this.historyService.getHistory(username, 10, 0, 'DESC');

      const subscribedChannelsCount = await this.subscriptionsService.getSubscribedChannelsCount(
        username
      );

      const videoStats = await this.historyService.getHistoryStats(username);

      return {
        username,
        profileImage: user.profileImage ? `/api/user/profile/image/${username}` : null,
        videoHistory: videoHistory.videos,
        registeredAt: (user as any).createdAt,
        totalVideosCount: videoStats.totalVideoCount,
        totalTimeString: humanizeDuration(videoStats.totalSeconds * 1000),
        subscribedChannelsCount
      };
    }
  }

  async saveProfileImage(request: ViewTubeRequest) {
    const username = request.user.username;
    if (username) {
      let fileTooLarge = false;
      const file = await request.file({
        limits: {
          fieldNameSize: 100,
          fileSize: 4000000,
          files: 1
        }
      });

      file.file.on('limit', () => {
        fileTooLarge = true;
      });
      const mimetypeMath = file.mimetype.match(/image\/(jpg|jpeg|png|gif|webp)/);
      if (mimetypeMath !== null) {
        const fileBuffer = await file.toBuffer();
        let extension = 'jpg';
        const extMatch = file.filename.match(/\.(jpg|jpeg|png|gif|webp)$/);
        if (extMatch && extMatch[1]) {
          extension = extMatch[1];
        }
        let imgPath = `profiles/${username}.${extension}`;

        if (global['__basedir']) {
          // eslint-disable-next-line dot-notation
          imgPath = path.join(global['__basedir'], imgPath);
        }

        if (fileTooLarge) {
          throw new BadRequestException('The file is too large');
        }

        const writeFile = promisify(fs.writeFile);

        try {
          await writeFile(imgPath, fileBuffer);
        } catch (error) {
          Consola.log(error);
        }

        const publicPath = `/api/user/profile/image/${username}`;

        await this.UserModel.findOneAndUpdate({ username }, { profileImage: imgPath }).exec();

        return {
          path: publicPath
        };
      }
    }
    throw new BadRequestException('Uploaded file is not valid');
  }

  async getProfileImage(username: string, reply: FastifyReply) {
    if (username) {
      const user = await this.UserModel.findOne({ username }).exec();
      if (user && user.profileImage && fs.existsSync(user.profileImage)) {
        try {
          let filePath = user.profileImage;
          if (this.configService.get('NODE_ENV') !== 'production') {
            filePath = path.resolve('.', user.profileImage);
          }
          const fileStream = fs.createReadStream(filePath);
          reply.type('image/webp').send(fileStream);
        } catch (error) {
          throw new InternalServerErrorException('Error getting photo');
        }
      } else {
        const img = Buffer.from(profileImage, 'base64');
        reply
          .code(200)
          .headers({
            'Content-Type': 'image/png',
            'Content-Length': img.length
          })
          .send(img);
      }
    } else {
      throw new NotFoundException({
        message: 'User not found',
        ignoreFilter: true
      });
    }
  }

  async deleteProfileImage(username: string) {
    if (username) {
      const user = await this.UserModel.findOne({ username });
      if (user && user.profileImage && fs.existsSync(user.profileImage)) {
        fs.unlinkSync(user.profileImage);
        user.profileImage = null;
        await user.save();
      } else {
        throw new NotFoundException({
          message: 'Profile image not found',
          ignoreFilter: true
        });
      }
    } else {
      throw new NotFoundException({
        message: 'User not found',
        ignoreFilter: true
      });
    }
  }

  async create(user: UserDto): Promise<UserprofileDto> {
    const existingUser: null | User = await this.findOne(user.username);
    if (existingUser !== null) {
      throw new HttpException(`User ${existingUser.username} already exists`, 400);
    } else {
      const saltRounds = 10;
      let hash: string;
      try {
        hash = await bcrypt.hash(user.password, saltRounds);
      } catch (err) {
        throw new HttpException('Error registering user', 403);
      }

      const createdUser = await new this.UserModel({
        username: user.username,
        password: hash
      }).save();
      return {
        username: createdUser.username,
        profileImage: null,
        settings: null
      };
    }
  }

  findOne(username: string): Promise<User> {
    return this.UserModel.findOne({ username }).exec();
  }

  findAll(): Promise<User[]> {
    return this.UserModel.find().exec();
  }

  async deleteUserAndData(username: string) {
    if (username) {
      const subscriptions = await this.subscriptionsService.deleteAllSubscribedChannels(username);
      const history = await this.historyService.deleteCompleteHistory(username);
      const settings = await this.settingsService.deleteSettings(username);
      let userSuccess = true;
      await this.UserModel.deleteOne({ username })
        .exec()
        .catch(_ => {
          userSuccess = false;
        });

      return {
        subscriptions: subscriptions.success,
        history: history.success,
        settings: settings.success,
        user: userSuccess
      };
    }
  }

  async createDataExport(username: string): Promise<Readable> {
    if (username) {
      const userData = { username, subscriptions: {}, history: {}, settings: {} };

      const userSubscriptions = await this.subscriptionsService.getSubscribedChannels(
        username,
        0,
        0,
        Common.convertSortParams<ChannelBasicInfoDto>(''),
        ''
      );

      if (userSubscriptions) {
        userData.subscriptions = userSubscriptions;
      }

      const userHistory = await this.historyService.getHistory(username, null, 0, 'ASC');

      if (userHistory) {
        userData.history = userHistory;
      }

      const userSettings = await this.settingsService.getSettings(username);

      if (userSettings) {
        userData.settings = userSettings;
      }
      const exportUserData = JSON.stringify(userData, null, 2);

      const user = await this.UserModel.findOne({ username });

      try {
        const archive = archiver('zip', {
          zlib: { level: 9 }
        });

        archive.append(exportUserData, { name: 'user.json' });

        if (user.profileImage && fs.existsSync(user.profileImage)) {
          let fileStream = fs.createReadStream(user.profileImage);
          if (this.configService.get('NODE_ENV') === 'production') {
            fileStream = fs.createReadStream(path.join(global.__basedir, user.profileImage));
          }
          archive.append(fileStream, { name: user.profileImage });
        }

        archive.on('error', error => {
          throw new InternalServerErrorException(error);
        });

        archive.finalize();

        return archive;
      } catch (error) {
        throw new InternalServerErrorException(error);
      }
    }
  }
}
