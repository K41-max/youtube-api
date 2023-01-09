import { ApiDto } from 'viewtube/shared';

type PlaylistType = Omit<ApiDto<'PlaylistResultDto'>, 'visibility'> & {
  visibility: 'unlisted' | 'everyone';
};

export const useGetPlaylists = (id: string, { pages = 1 }) => {
  const { apiUrl } = useApiUrl();

  const urlPart = `playlists/${id}?pages=${pages}`;

  return useLazyAsyncData<PlaylistType>(urlPart, () => $fetch(`${apiUrl}${urlPart}`));
};
