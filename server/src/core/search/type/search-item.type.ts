import { Mix, Playlist, Movie, Refinement, Shelf } from 'ytsr';
import { ChannelBasicInfoDto } from 'server/core/channels/dto/channel-basic-info.dto';
import { VideoBasicInfoDto } from 'server/core/videos/dto/video-basic-info.dto';

export type SearchItem =
  | Mix
  | Playlist
  | ChannelBasicInfoDto
  | VideoBasicInfoDto
  | Movie
  | Refinement
  | Shelf;
