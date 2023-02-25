import {
  CacheInterceptor,
  CacheKey,
  CacheTTL,
  Controller,
  Get,
  Header,
  UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HomeFeed } from 'youtubei.js/dist/src/parser/youtube';
import { PopularDto } from './dto/popular.dto';
import { HomepageService } from './homepage.service';

@ApiTags('Core')
@UseInterceptors(CacheInterceptor)
@Controller('homepage')
export class HomepageController {
  constructor(private homepageService: HomepageService) {}

  @Get('popular')
  @CacheTTL(43200)
  @CacheKey('popular')
  @Header('Cache-Control', 'public, max-age=43200')
  getPopular(): Promise<PopularDto> {
    return this.homepageService.getPopular();
  }

  @Get('homefeed')
  @CacheTTL(43200)
  @CacheKey('homefeed')
  @Header('Cache-Control', 'public, max-age=43200')
  getHomeFeed() {
    return this.homepageService.getHomeFeed();
  }
}
