import { CacheModule, Module, ModuleMetadata } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { General, GeneralSchema } from 'server/common/general.schema';
import { CacheConfigService } from 'server/cache-config.service';
import { ApiRequest, ApiRequestSchema } from 'server/metrics/schemas/api-request.schema';
import { User, UserSchema } from 'server/user/schemas/user.schema';
import { VideosController } from './videos/videos.controller';
import { VideosService } from './videos/videos.service';
import { VideoplaybackController } from './videoplayback/videoplayback.controller';
import { VideoplaybackService } from './videoplayback/videoplayback.service';
import { AutocompleteModule } from './autocomplete/autocomplete.module';
import { Video, VideoSchema } from './videos/schemas/video.schema';
import { VideoBasicInfo, VideoBasicInfoSchema } from './videos/schemas/video-basic-info.schema';
import {
  ChannelBasicInfo,
  ChannelBasicInfoSchema
} from './channels/schemas/channel-basic-info.schema';
import { SearchModule } from './search/search.module';
import { ChannelsModule } from './channels/channels.module';
import { HomepageModule } from './homepage/homepage.module';
import { ProxyModule } from './proxy/proxy.module';
import { CommentsModule } from './comments/comments.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { StatisticsController } from './statistics/statistics.controller';
import { StatisticsService } from './statistics/statistics.service';

const moduleMetadata: ModuleMetadata = {
  imports: [
    MongooseModule.forFeature([
      {
        name: Video.name,
        schema: VideoSchema,
        collection: 'videos'
      },
      {
        name: VideoBasicInfo.name,
        schema: VideoBasicInfoSchema,
        collection: 'videos-basicinfo'
      },
      {
        name: ChannelBasicInfo.name,
        schema: ChannelBasicInfoSchema,
        collection: 'channel-basicinfo'
      },
      {
        name: General.name,
        schema: GeneralSchema,
        collection: 'general'
      },
      {
        name: ApiRequest.name,
        schema: ApiRequestSchema,
        collection: 'api-requests'
      },
      {
        name: User.name,
        schema: UserSchema,
        collection: 'users'
      }
    ]),
    CacheModule.registerAsync({
      useClass: CacheConfigService
    }),
    AutocompleteModule,
    ConfigModule.forRoot(),
    SearchModule,
    ChannelsModule,
    HomepageModule,
    ProxyModule,
    CommentsModule,
    PlaylistsModule
  ],
  controllers: [VideosController, VideoplaybackController, StatisticsController],
  providers: [VideosService, VideoplaybackService, StatisticsService],
  exports: [VideosService, VideoplaybackService, StatisticsService]
};
@Module(moduleMetadata)
export class CoreModule {}
