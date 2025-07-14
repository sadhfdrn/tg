
import { CheerioAPI, load } from 'cheerio';
import {
  ISearch,
  IAnimeInfo,
  IAnimeResult,
  ISource,
  IEpisodeServer,
  StreamingServers,
  MediaFormat,
  SubOrSub,
  IAnimeEpisode,
  MediaStatus,
  WatchListType,
} from './models';
import AnimeParser from './anime-parser';
import Luffy from './luffy';
import axios from 'axios';

class AnimeOwl extends AnimeParser {
  override readonly name = 'AnimeOwl';
  protected override baseUrl = 'https://animeowl.me';
  protected apiUrl = 'https://animeowl.me/api';
  protected override logo = 'https://animeowl.me/images/favicon-96x96.png';
  protected override classPath = 'ANIME.AnimeOwl';

  constructor(customBaseURL?: string) {
    super();
    if (customBaseURL) {
      if (customBaseURL.startsWith('http://') || customBaseURL.startsWith('https://')) {
        this.baseUrl = customBaseURL;
      } else {
        this.baseUrl = `http://${customBaseURL}`;
      }
    } else {
      this.baseUrl = this.baseUrl;
    }
    this.client = axios.create();
  }

  override search = async (query: string, page: number = 1): Promise<ISearch<IAnimeResult>> => {
    if (0 >= page) {
      page = 1;
    }

    const { data } = await this.client.post(`${this.apiUrl}/advance-search`, {
      clicked: false,
      limit: 24,
      page: page - 1,
      pageCount: 1,
      value: query,
      selected: {
        type: [],
        genre: [],
        year: [],
        country: [],
        season: [],
        status: [],
        sort: [],
        language: [],
      },
      results: [],
      lang22: 3,
      sortt: 4,
    });

    const res: ISearch<IAnimeResult> = {
      currentPage: page,
      hasNextPage: page < Math.ceil(data.total / 24),
      totalPages: Math.ceil(data.total / 24),
      results: [],
    };
    res.results = data.results.map(
      (item: any): IAnimeResult => ({
        id: `${item.anime_slug}$${item.anime_id}`,
        title: item.en_name || item.anime_name,
        url: `${this.baseUrl}/anime/${item.anime_slug}`,
        image:
          `${this.baseUrl}${item.image}` ||
          `${this.baseUrl}${item.thumbnail}` ||
          `${this.baseUrl}${item.webp}`,
        japaneseTitle: item.jp_name,
        sub: parseInt(item.total_episodes) || 0,
        dub: parseInt(item.total_dub_episodes) || 0,
        episodes: parseInt(item.total_episodes) || 0,
        lastChapter: item.total_episodes ? `Total episodes: ${item.total_episodes}` : 'N/A',
      })
    );
    return res;
  };

  override fetchAnimeInfo = async (id: string): Promise<IAnimeInfo> => {
    const info: IAnimeInfo = {
      id: id,
      title: '',
    };
    try {
      const { data } = await this.client.get(`${this.baseUrl}/anime/${id.split('$')[0]}`);
      const $ = load(data);

      info.title = $('h1.anime-name').text();
      info.japaneseTitle = $('h2.anime-romaji').text();
      info.image = `${this.baseUrl}${$('div.cover-img-container >img').attr('src')}`;
      info.description = $('div.anime-desc')
        .text()
        .replace(/\s*\n\s*/g, ' ')
        .trim();
      info.type = $('div.type > a').text().toUpperCase() as MediaFormat;
      info.url = `${this.baseUrl}/anime/${id.split('$')[0]}`;
      
      const hasSub: boolean =
        $('div#anime-cover-sub-content > div.nav-container > ul#episode-list > li.nav-item').length > 0;
      const hasDub: boolean =
        $('div#anime-cover-dub-content > div.nav-container > ul#episode-list > li.nav-item').length > 0;

      if (hasSub) {
        info.hasSub = hasSub;
      }
      if (hasDub) {
        info.hasDub = hasDub;
      }
      
      info.genres = [];
      $('div.genre')
        .find('a')
        .each(function () {
          const genre = $(this).text().trim();
          if (genre != undefined) info.genres?.push(genre);
        });

      switch ($('div.status > span').text().trim()) {
        case 'Finished Airing':
          info.status = MediaStatus.COMPLETED;
          break;
        case 'Currently Airing':
          info.status = MediaStatus.ONGOING;
          break;
        case 'Not yet aired':
          info.status = MediaStatus.NOT_YET_AIRED;
          break;
        default:
          info.status = MediaStatus.UNKNOWN;
          break;
      }

      info.season = $('div.premiered')
        .text()
        .replace(/\s*\n\s*/g, ' ')
        .replace('Premiered: ', '')
        .trim();
      let totalSubEpisodes = parseInt(
        $('div#anime-cover-sub-content > div.nav-container > ul#episode-list > li.nav-item')
          .last()
          .text()
          .split('-')[1]
          ?.trim() ?? '0'
      );
      let totalDubEpisodes = parseInt(
        $('div#anime-cover-dub-content > div.nav-container > ul#episode-list > li.nav-item')
          .last()
          .text()
          .split('-')[1]
          ?.trim() ?? '0'
      );
      info.totalEpisodes = totalSubEpisodes > totalDubEpisodes ? totalSubEpisodes : totalDubEpisodes;
      if (isNaN(info.totalEpisodes)) info.totalEpisodes = 0;
      
      info.episodes = [];

      const subEpisodes = this.parseEpisodes($, '#anime-cover-sub-content .episode-node', SubOrSub.SUB);
      const dubEpisodes = this.parseEpisodes($, '#anime-cover-dub-content .episode-node', SubOrSub.DUB);

      const groupedMap = new Map<string, IAnimeEpisode>();
      
      for (const sub of subEpisodes) {
        groupedMap.set(sub.title!, {
          id: `${id.split('$')[0]}$${sub.id!}`,
          title: sub.title!,
          number: sub.number!,
          url: sub.url,
          isSubbed: true,
          isDubbed: false,
        });
      }

      for (const dub of dubEpisodes) {
        if (groupedMap.has(dub.title!)) {
          const entry = groupedMap.get(dub.title!)!;
          entry.id = `${entry.id}&${dub.id}`; 
          entry.isDubbed = true;
        } else {
          groupedMap.set(dub.title!, {
            id: `${id.split('$')[0]}$${dub.id!}`,
            title: dub.title!,
            number: sub.number!,
            url: dub.url,
            isSubbed: false,
            isDubbed: true,
          });
        }
      }

      info.episodes = Array.from(groupedMap.values());

      return info;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeSources = async (
    episodeId: string,
    server: StreamingServers = StreamingServers.Luffy,
    subOrDub: SubOrSub = SubOrSub.SUB
  ): Promise<ISource> => {
    if (episodeId.startsWith('http')) {
      const serverUrl = new URL(episodeId);
      switch (server) {
        case StreamingServers.Luffy:
          return {
            headers: { Referer: serverUrl.href },
            sources: await new Luffy().extract(serverUrl),
          };
        default:
          return {
            headers: { Referer: serverUrl.href },
            sources: await new Luffy().extract(serverUrl),
          };
      }
    }

    try {
      const servers = await this.fetchEpisodeServers(episodeId, subOrDub);
      const i = servers.findIndex(s => s.name.toLowerCase() === server.toLowerCase());

      if (i === -1) {
        throw new Error(`Server ${server} not found`);
      }

      const serverUrl: URL = new URL(servers[i].url);
      const sources = await this.fetchEpisodeSources(serverUrl.href, server, subOrDub);
      return sources;
    } catch (err) {
      throw err;
    }
  };
  
  override fetchEpisodeServers = async (
    episodeId: string,
    subOrDub: SubOrSub = SubOrSub.SUB
  ): Promise<IEpisodeServer[]> => {
    const justTheId = episodeId.split('$')[1];
    const id = episodeId.split('$')[0];
    const { data } = await this.client.get(`${this.baseUrl}/anime/${id}`);
    const $ = load(data);
  
    const findEpisode = (selector: string, targetId: string) => {
      const episodes = this.parseEpisodes($, selector, subOrDub);
      return episodes.find(item => item.id?.endsWith(targetId));
    };

    let episode;
    if (subOrDub === SubOrSub.SUB) {
        const subId = justTheId.split('&')[0];
        episode = findEpisode('#anime-cover-sub-content .episode-node', subId);
    } else {
        const dubId = justTheId.split('&')[1] ?? justTheId;
        episode = findEpisode('#anime-cover-dub-content .episode-node', dubId);
    }
    
    if (!episode?.url) {
      throw new Error('Episode not found or URL is missing.');
    }

    let directLink: string | undefined = '';

    const { data: intermediary } = await this.client.get(episode.url);
    const $intermediary = load(intermediary);
    directLink = $intermediary('button#hot-anime-tab')?.attr('data-source');
  
    if (!directLink) {
        throw new Error('Could not find the direct link to the server.');
    }
    
    const { data: server } = await this.client.get(`${this.baseUrl}${directLink}`);
    const servers: IEpisodeServer[] = [];
    server['luffy']?.map((item: any) => {
      servers.push({
        name: 'luffy',
        url: `${this.baseUrl}${directLink!}`,
      });
    });

    return servers;
  };

  private parseEpisodes = ($: any, selector: string, subOrDub: SubOrSub): IAnimeEpisode[] => {
    return $(selector)
      .map((idx: number, el: CheerioAPI) => {
        const $el = $(el);
        const title = $el.attr('title') ?? '';
        const id = $el.attr('id') ?? '';
        const url = $el.attr('href')?.startsWith('http') ? $el.attr('href')! : this.baseUrl + $el.attr('href');
        const episodeNumber = Number(title);
        
        if (!Number.isInteger(episodeNumber)) {
          return null;
        }

        return {
          id: id,
          number: parseInt(title),
          title: `Ep-${title}`,
          url: url || '',
          isSubbed: subOrDub === SubOrSub.SUB,
          isDubbed: subOrDub === SubOrSub.DUB,
        };
      })
      .get()
      .filter(Boolean);
  };
}

export default AnimeOwl;
