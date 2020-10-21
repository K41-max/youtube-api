import { VideoThumbnailDto } from 'shared/dto/video/video-thumbnail.dto';

export class VideoBasicInfoDto {
  videoId: string;
  title: string;
  published?: number;
  publishedText: string;
  author: string;
  authorId: string;
  videoThumbnails: Array<VideoThumbnailDto>;
  description?: string;
  viewCount: number;
  likeCount?: number;
  dislikeCount?: number;
  lengthSeconds?: number;
  lengthString?: string;
  live?: boolean;
}
