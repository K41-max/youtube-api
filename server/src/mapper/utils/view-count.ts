import { parseShortenedNumber } from './shortened-number';

export const parseViewCount = (viewCount: string) => {
  if (viewCount) {
    let views = parseShortenedNumber(viewCount);

    views = views.replace('views', '').replace(',', '').trim();
    return parseInt(views);
  }
};
