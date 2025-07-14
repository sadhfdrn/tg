
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

class AnimePahe extends AnimeParser {
  override readonly name = 'AnimePahe';
  protected override baseUrl = 'https://animepahe.ru';
  protected override logo = 'https://animepahe.com/pikacon.ico';
  protected override classPath = 'ANIME.AnimePahe';

  override search = async (query: string): Promise<ISearch<IAnimeResult>> => {
    try {
      const { data } = await this.client.get(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`, {
        headers: this.Headers(),
      });

      const $ = load(data);

      const res: ISearch<IAnimeResult> = {
        results: [],
      };

      $('div.search-results > .item-container > .item-box').each((i, el) => {
        const id = $(el).find('a.item-cover').attr('href')?.split('/').pop() ?? '';
        res.results.push({
          id: id,
          title: $(el).find('a.item-title').text().trim(),
          image: $(el).find('a.item-cover > img').attr('src'),
          releaseDate: $(el).find('p.item-meta > span:nth-child(1)').text().trim(),
          type: $(el).find('p.item-meta > span:nth-child(2)').text().trim() as MediaFormat,
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
      animeInfo.type = $('div.anime-info > p:contains("Type:") > a').text().trim().toUpperCase() as MediaFormat;
      
      const { data } = await this.client.get(`${this.baseUrl}/api?m=release&id=${id}&sort=episode_asc&page=1`, {
        headers: this.Headers(id),
      });

      animeInfo.totalEpisodes = data.total;
      animeInfo.episodes = data.data.map(
        (item: any) => ({
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
      const { data } = await this.client.get(`${this.baseUrl}/play/${episodeId}`);

      const $ = load(data);

      const links = $('div#resolutionMenu > button').map((i, el) => ({
        url: $(el).attr('data-src')!,
        quality: $(el).text(),
        audio: $(el).attr('data-audio'),
      })).get();

      const iSource: ISource = {
        headers: { Referer: 'https://kwik.cx/' },
        sources: [],
      };
      
      const extractor = new Kwik();
      for (const link of links) {
        const res = await extractor.extract(new URL(link.url));
        if(res[0]) {
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
  
  private Headers(sessionId?: string | false) {
    return {
      'User-Agent': USER_AGENT,
      'Referer': sessionId ? `${this.baseUrl}/anime/${sessionId}` : this.baseUrl,
      'Cookie': 'cf_clearance=Q7BsjH27Ke2v_3zGgw4ZcaxpDXtTbUPpBqWj.BSJdlo-1725301880-1.0.1.1-p4CqgW55lQvjYfFjcgx2QaqWd40pMf9y9z51S9u8W01dJv2B.7k1qj39V.mK4P22qN12p4gM2.2g.4; __ddg2=;'
    };
  }
}

export default AnimePahe;
