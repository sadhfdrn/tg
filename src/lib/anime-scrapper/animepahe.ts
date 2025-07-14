
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

  private Headers(sessionId: string | false = false) {
    let cookie = '';
    try {
        const cookiePath = path.join(process.cwd(), 'xiq1ww.txt');
        const cookieFile = fs.readFileSync(cookiePath, 'utf-8');

        // Parse Netscape cookie file format
        cookie = cookieFile
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')) // ignore comments and empty lines
            .map(line => {
                const parts = line.split('\t');
                if (parts.length >= 7) {
                    const name = parts[5];
                    const value = parts[6];
                    return `${name}=${value}`;
                }
                return null;
            })
            .filter(Boolean) // remove nulls
            .join('; ');

    } catch (err) {
        console.warn('Could not read or parse animepahe cookie file.', err);
    }
    
    return {
      'User-Agent': USER_AGENT,
      'Referer': this.baseUrl,
      'Cookie': cookie,
    };
  }

  override search = async (query: string): Promise<ISearch<IAnimeResult>> => {
    try {
      const { data } = await this.client.get(
        `${this.baseUrl}/api?m=search&q=${encodeURIComponent(query)}`, {
            headers: this.Headers()
        }
      );

      const res: ISearch<IAnimeResult> = {
        results: data.data.map((item: any) => ({
          id: item.session,
          title: item.title,
          image: item.poster,
          rating: item.score,
          releaseDate: item.year,
          type: item.type as MediaFormat,
        })),
      };

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
      const res = await this.client.get(`${this.baseUrl}/anime/${id}`, { headers: this.Headers(id) });
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
        { headers: this.Headers(id) }
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
        headers: this.Headers(episodeId.split('/')[0]),
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
