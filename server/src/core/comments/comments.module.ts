import { Module, CacheModule, ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheConfigService } from 'server/cache-config.service';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

const moduleMetadata: ModuleMetadata = {
  providers: [CommentsService],
  controllers: [CommentsController],
  imports: [
    ConfigModule.forRoot(),
    CacheModule.registerAsync({
      useClass: CacheConfigService
    })
  ]
};

@Module(moduleMetadata)
export class CommentsModule {}
