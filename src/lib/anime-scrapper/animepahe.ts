
'use client';

import { load } from 'cheerio';
import {
  AnimeParser,
  ISearch,
  IAnimeInfo,
  MediaStatus,
  IAnimeResult,
  ISource,
  IAnimeEpisode,
  IEpisodeServer,
  MediaFormat,
} from './models';
import Kwik from './kwik';
import { USER_AGENT } from './utils';
import { getCookies } from './cookie-service';

class AnimePahe extends AnimeParser {
  override readonly name = 'AnimePahe';
  protected override baseUrl = 'https://animepahe.ru';
  protected override logo = 'https://animepahe.com/pikacon.ico';
  protected override classPath = 'ANIME.AnimePahe';

  private async Headers(sessionId?: string, referer?: string) {
    const cookies = await getCookies();
    return {
      authority: 'animepahe.ru',
      'user-agent': USER_AGENT,
      accept: 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      dnt: '1',
      cookie: cookies.animepahe,
      referer: referer || (sessionId ? `${this.baseUrl}/anime/${sessionId}` : `${this.baseUrl}/`),
    };
  }

  override search = async (query: string): Promise<ISearch<IAnimeResult>> => {
    try {
      const { data } = await this.client.get(`${this.baseUrl}/api?m=search&q=${encodeURIComponent(query)}`, {
        headers: await this.Headers(),
      });

      const res = {
        results: data.data.map((item: any) => ({
          id: item.session,
          title: item.title,
          image: item.poster,
          rating: item.score,
          releaseDate: item.year.toString(),
          type: item.type,
        })),
      };

      return res;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchAnimeInfo = async (id: string, episodePage: number = -1): Promise<IAnimeInfo> => {
    const animeInfo: IAnimeInfo = {
      id: id,
      title: '',
    };

    try {
      const res = await this.client.get(`${this.baseUrl}/anime/${id}`, { headers: await this.Headers(id) });
      const $ = load(res.data);

      animeInfo.title = $('div.title-wrapper > h1 > span').first().text();
      animeInfo.image = $('div.anime-poster a').attr('href');
      animeInfo.cover = `https:${$('div.anime-cover').attr('data-src')}`;
      animeInfo.description = $('div.anime-summary').text().trim();
      animeInfo.genres = $('div.anime-genre ul li')
        .map((i, el) => $(el).find('a').attr('title'))
        .get();

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
      animeInfo.releaseDate = $('div.anime-info > p:contains("Aired:")')
        .text()
        .split('to')[0]
        .replace('Aired:', '')
        .trim();
      animeInfo.studios = $('div.anime-info > p:contains("Studio:")')
        .text()
        .replace('Studio:', '')
        .trim()
        .split('\n');

      animeInfo.totalEpisodes = parseInt(
        $('div.anime-info > p:contains("Episodes:")').text().replace('Episodes:', '')
      );

      animeInfo.episodes = [];
      if (episodePage < 0) {
        const {
          data: { last_page, data },
        } = await this.client.get(`${this.baseUrl}/api?m=release&id=${id}&sort=episode_asc&page=1`, {
          headers: await this.Headers(id),
        });

        animeInfo.episodePages = last_page;

        animeInfo.episodes.push(
          ...data.map(
            (item: any) =>
              ({
                id: `${id}/${item.session}`,
                number: item.episode,
                title: item.title,
                image: item.snapshot,
                duration: item.duration,
                url: `${this.baseUrl}/play/${id}/${item.session}`,
              } as IAnimeEpisode)
          )
        );

        for (let i = 1; i < last_page; i++) {
          animeInfo.episodes.push(...(await this.fetchEpisodes(id, i + 1)));
        }
      } else {
        animeInfo.episodes.push(...(await this.fetchEpisodes(id, episodePage)));
      }

      return animeInfo;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeSources = async (episodeId: string): Promise<ISource> => {
    try {
      const { data } = await this.client.get(`${this.baseUrl}/play/${episodeId}`, {
        headers: await this.Headers(episodeId.split('/')[0]),
      });

      const $ = load(data);

      const links = $('div#resolutionMenu > button').map((i, el) => ({
        url: $(el).attr('data-src')!,
        quality: $(el).text(),
        audio: $(el).attr('data-audio'),
      }));
      
      const iSource: ISource = {
        headers: {
          Referer: 'https://kwik.si/',
        },
        sources: [],
      };

      for (const link of links) {
        // Here we handle the pahe.win redirect
        const paheWinUrl = new URL(link.url);
        const paheWinRes = await this.client.get(paheWinUrl.href, { 
            headers: { 
                'Referer': `${this.baseUrl}/`,
                'Cookie': (await getCookies()).pahewin
            } 
        });
        const $$ = load(paheWinRes.data);
        const kwikUrl = $$('body > script').html()?.match(/"([^"]+)"/)?.[1];

        if(!kwikUrl) throw new Error("Could not extract kwik url from pahe.win")
        
        const res = await new Kwik().extract(new URL(kwikUrl));
        res[0].quality = link.quality;
        res[0].isDub = link.audio === 'eng';
        iSource.sources.push(res[0]);
      }
      return iSource;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  private fetchEpisodes = async (session: string, page: number): Promise<IAnimeEpisode[]> => {
    const res = await this.client.get(
      `${this.baseUrl}/api?m=release&id=${session}&sort=episode_asc&page=${page}`,
      { headers: await this.Headers(session) }
    );

    const epData = res.data.data;

    return [
      ...epData.map(
        (item: any): IAnimeEpisode => ({
          id: `${session}/${item.session}`,
          number: item.episode,
          title: item.title,
          image: item.snapshot,
          duration: item.duration,
          url: `${this.baseUrl}/play/${session}/${item.session}`,
        })
      ),
    ] as IAnimeEpisode[];
  };

  override fetchEpisodeServers = (episodeLink: string): Promise<IEpisodeServer[]> => {
    throw new Error('Method not implemented.');
  };
}

export default AnimePahe;
