
import { load } from 'cheerio';
import {
  ISearch,
  IAnimeInfo,
  MediaStatus,
  IAnimeResult,
  ISource,
  IAnimeEpisode,
  IEpisodeServer,
  MediaFormat,
} from './models';
import AnimeParser from './anime-parser';
import Kwik from './kwik';
import { USER_AGENT } from './utils';
import fs from 'fs';
import path from 'path';

class AnimePahe extends AnimeParser {
  override readonly name = 'AnimePahe';
  protected override baseUrl = 'https://animepahe.ru';
  protected override logo = 'https://animepahe.com/pikacon.ico';
  protected override classPath = 'ANIME.AnimePahe';

  private Headers() {
    // Reading the cookie from an environment variable is more robust
    // than trying to parse a file that might change format.
    const cookie = process.env.ANIMEPAHE_COOKIE || '';

    if (!cookie) {
        console.warn('ANIMEPAHE_COOKIE environment variable is not set. This may result in 403 errors.');
    }

    return {
      'User-Agent': USER_AGENT,
      'Referer': `${this.baseUrl}/`, // Set a consistent Referer
      'Cookie': cookie,
    };
  }

  override search = async (query: string): Promise<ISearch<IAnimeResult>> => {
    try {
      const { data } = await this.client.get(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`,
        {
          headers: this.Headers(),
        }
      );
      const $ = load(data);

      const res: ISearch<IAnimeResult> = {
        results: [],
      };

      $('div.timeline-content > .timeline-item').each((i, el) => {
        res.results.push({
            id: $(el).find('a.timeline-poster').attr('href')?.split('/')[2]!,
            title: $(el).find('div.timeline-body > h5 > a').text()?.trim()!,
            image: $(el).find('a.timeline-poster > img').attr('src')!,
            rating: parseFloat($(el).find('div.timeline-body > div > p > strong').text()?.trim()) || 0,
            releaseDate: $(el).find('div.timeline-body > p:nth-child(2)').text()?.trim(),
            type: $(el).find('div.timeline-body > div > p > a').text()?.trim() as MediaFormat,
        });
      });

      return res;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchAnimeInfo = async (id: string): Promise<IAnimeInfo> => {
    const animeInfo: IAnimeInfo = {
      id: id,
      title: '',
    };

    try {
      const res = await this.client.get(`${this.baseUrl}/anime/${id}`, { headers: this.Headers() });
      const $ = load(res.data);

      animeInfo.title = $('div.title-wrapper > h1 > span').first().text();
      animeInfo.image = $('div.anime-poster a').attr('href');
      animeInfo.description = $('div.anime-summary').text().trim();
      animeInfo.genres = $('div.anime-genre ul li')
        .map((i, el) => $(el).find('a').attr('title'))
        .get();
      animeInfo.hasSub = true;

      switch ($('div.anime-info p:icontains("Status:") a').text().trim()) {
        case 'Currently Airing':
          animeInfo.status = MediaStatus.ONGOING;
          break;
        case 'Finished Airing':
          animeInfo.status = MediaStatus.COMPLETED;
          break;
        default:
          animeInfo.status = MediaStatus.UNKNOWN;
      }
      animeInfo.type = $('div.anime-info > p:contains("Type:") > a')
        .text()
        .trim()
        .toUpperCase() as MediaFormat;

      const { data } = await this.client.get(
        `${this.baseUrl}/api?m=release&id=${id}&sort=episode_asc&page=1`,
        { headers: this.Headers() }
      );

      animeInfo.totalEpisodes = data.total;
      animeInfo.episodes = data.data.map(
        (item: any): IAnimeEpisode => ({
          id: `${id}/${item.session}`,
          number: item.episode,
          title: item.title,
          image: item.snapshot,
          duration: item.duration,
          url: `${this.baseUrl}/play/${id}/${item.session}`,
        })
      );

      return animeInfo;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeSources = async (episodeId: string): Promise<ISource> => {
    try {
      const { data } = await this.client.get(`${this.baseUrl}/play/${episodeId}`, {
        headers: this.Headers(),
      });

      const $ = load(data);

      const links = $('div#resolutionMenu > button')
        .map((i, el) => ({
          url: $(el).attr('data-src')!,
          quality: $(el).text(),
          audio: $(el).attr('data-audio'),
        }))
        .get();

      const iSource: ISource = {
        headers: { Referer: 'https://kwik.cx/' },
        sources: [],
      };

      const extractor = new Kwik();
      for (const link of links) {
        const res = await extractor.extract(new URL(link.url));
        if (res[0]) {
          res[0].quality = link.quality;
          iSource.sources.push(res[0]);
        }
      }

      return iSource;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeServers = (episodeLink: string): Promise<IEpisodeServer[]> => {
    throw new Error('Method not implemented.');
  };
}

export default AnimePahe;
