import { Controller, Get, Param, Res, CacheInterceptor, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { MetricsInterceptor } from 'server/metrics/metrics.interceptor';
import { ChannelsService } from './channels.service';
import { ChannelDto } from './dto/channel.dto';

@ApiTags('Core')
@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}
  @Get(':id/thumbnail/tiny.jpg')
  getTinyThumbnailJpg(@Res() reply: FastifyReply, @Param('id') id: string) {
    this.channelsService.getTinyThumbnail(reply, id);
  }

  @Get(':id/thumbnail/tiny.webp')
  getTinyThumbnailWebp(@Res() reply: FastifyReply, @Param('id') id: string) {
    this.channelsService.getTinyThumbnail(reply, id);
  }

  @Get(':id')
  @UseInterceptors(MetricsInterceptor)
  @UseInterceptors(CacheInterceptor)
  getChannel(@Param('id') channelId: string): Promise<ChannelDto> {
    return this.channelsService.getChannel(channelId);
  }
}
