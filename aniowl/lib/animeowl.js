

const { load } = require('cheerio');
const {
  StreamingServers,
  MediaFormat,
  SubOrSub,
  MediaStatus,
} = require('./models.js');
const AnimeParser = require('./anime-parser.js');
const Luffy = require('./luffy.js');
const axios = require('axios');

class AnimeOwl extends AnimeParser {
  name = 'AnimeOwl';
  baseUrl = 'https://animeowl.me';
  apiUrl = 'https://animeowl.me/api';
  logo = 'https://animeowl.me/images/favicon-96x96.png';
  classPath = 'ANIME.AnimeOwl';

  constructor(customBaseURL) {
    super();
    if (customBaseURL) {
      this.baseUrl = customBaseURL.startsWith('http') ? customBaseURL : `http://${customBaseURL}`;
    }
    this.client = axios.create();
  }

  search = async (query, page = 1) => {
    const safePage = Math.max(1, page);

    const { data } = await this.client.post(`${this.apiUrl}/advance-search`, {
      clicked: false,
      limit: 24,
      page: safePage - 1,
      pageCount: 1,
      value: query,
      selected: { type: [], genre: [], year: [], country: [], season: [], status: [], sort: [], language: [] },
      results: [],
      lang22: 3,
      sortt: 4,
    });

    const totalPages = Math.ceil(data.total / 24);
    return {
      currentPage: safePage,
      hasNextPage: safePage < totalPages,
      totalPages: totalPages,
      results: data.results.map(
        (item) => ({
          id: `${item.anime_slug}$${item.anime_id}`,
          title: item.en_name || item.anime_name,
          url: `${this.baseUrl}/anime/${item.anime_slug}`,
          image: `${this.baseUrl}${item.image || item.thumbnail || item.webp}`,
          japaneseTitle: item.jp_name,
          sub: parseInt(item.total_episodes) || 0,
          dub: parseInt(item.total_dub_episodes) || 0,
          episodes: parseInt(item.total_episodes) || 0,
        })
      ),
    };
  };

  fetchAnimeInfo = async (id) => {
    const info = { id, title: '' };
    try {
      const animeSlug = id.split('$')[0];
      const { data } = await this.client.get(`${this.baseUrl}/anime/${animeSlug}`);
      const $ = load(data);

      info.title = $('h1.anime-name').text();
      info.japaneseTitle = $('h2.anime-romaji').text();
      info.image = `${this.baseUrl}${$('div.cover-img-container >img').attr('src')}`;
      info.description = $('div.anime-desc').text().replace(/\s*\n\s*/g, ' ').trim();
      info.type = ($('div.type > a').text().toUpperCase()) || MediaFormat.UNKNOWN;
      info.url = `${this.baseUrl}/anime/${animeSlug}`;

      info.hasSub = $('#anime-cover-sub-content .episode-node').length > 0;
      info.hasDub = $('#anime-cover-dub-content .episode-node').length > 0;

      info.genres = $('div.genre a').map((_, el) => $(el).text().trim()).get();

      const statusText = $('div.status > span').text().trim();
      switch (statusText) {
        case 'Finished Airing': info.status = MediaStatus.COMPLETED; break;
        case 'Currently Airing': info.status = MediaStatus.ONGOING; break;
        case 'Not yet aired': info.status = MediaStatus.NOT_YET_AIRED; break;
        default: info.status = MediaStatus.UNKNOWN; break;
      }

      info.season = $('div.premiered').text().replace(/\s*\n\s*/g, ' ').replace('Premiered: ', '').trim();
      
      const subEpisodes = this.parseEpisodes($, '#anime-cover-sub-content .episode-node', SubOrSub.SUB);
      const dubEpisodes = this.parseEpisodes($, '#anime-cover-dub-content .episode-node', SubOrSub.DUB);

      info.totalEpisodes = Math.max(subEpisodes.length, dubEpisodes.length, 0);

      const groupedMap = new Map();
      
      subEpisodes.forEach(sub => {
        groupedMap.set(sub.number, {
          ...sub,
          id: `${animeSlug}$${sub.id}`,
        });
      });

      dubEpisodes.forEach(dub => {
        const entry = groupedMap.get(dub.number);
        if (entry) {
          entry.id = `${entry.id}&${dub.id}`;
          entry.isDubbed = true;
        } else {
          groupedMap.set(dub.number, {
            ...dub,
            id: `${animeSlug}$${dub.id}`,
          });
        }
      });

      info.episodes = Array.from(groupedMap.values()).sort((a, b) => a.number - b.number);

      return info;
    } catch (err) {
      console.error(`Failed to fetch anime info for ${id}:`, err);
      throw new Error(`Could not fetch anime info. ${(err).message}`);
    }
  };

  fetchEpisodeSources = async (episodeId, server = StreamingServers.Luffy) => {
    if (episodeId.startsWith('http')) {
      return {
        headers: { Referer: episodeId },
        sources: await new Luffy().extract(new URL(episodeId)),
      };
    }

    try {
      const servers = await this.fetchEpisodeServers(episodeId);
      const serverUrlStr = servers.find(s => s.name.toLowerCase() === server.toLowerCase())?.url;
      if (!serverUrlStr) throw new Error(`Server ${server} not found for episode ${episodeId}`);
      
      const serverUrl = new URL(serverUrlStr);
      return this.fetchEpisodeSources(serverUrl.href, server);
    } catch (err) {
      console.error(`Failed to fetch episode sources for ${episodeId}:`, err);
      throw err;
    }
  };
  
  fetchEpisodeServers = async (episodeIdWithSlug) => {
    try {
      const parts = episodeIdWithSlug.split('$');
      const animeSlug = parts[0];
      const episodeIds = parts[1];
      
      const subId = episodeIds?.split('&')[0];
      const dubId = episodeIds?.split('&')[1] || subId;
  
      const episodePathId = subId || dubId;

      if (!episodePathId) {
          throw new Error('No valid episode ID found in the provided string.');
      }
      
      const { data: animePageData } = await this.client.get(`${this.baseUrl}/anime/${animeSlug}`);
      const $ = load(animePageData);
      
      const episodePath = $(`a#${episodePathId}`).attr('href');

      if (!episodePath) throw new Error('Episode path not found on page.');

      const intermediaryUrl = episodePath.startsWith('http') ? episodePath : `${this.baseUrl}${episodePath}`;
      const { data: intermediary } = await this.client.get(intermediaryUrl);
      const $intermediary = load(intermediary);
      const directLink = $intermediary('button#hot-anime-tab')?.attr('data-source');
  
      if (!directLink) throw new Error('Could not find the direct link to the server.');
    
      const serverUrl = directLink.startsWith('http') ? directLink : `${this.baseUrl}${directLink}`;

      return [{ name: 'luffy', url: serverUrl }];
    } catch (err) {
      console.error(`Failed to fetch episode servers for ${episodeIdWithSlug}:`, err);
      throw new Error(`Could not fetch episode servers. ${(err).message}`);
    }
  };

  parseEpisodes = ($, selector, subOrDub) => {
    return $(selector).map((_, el) => {
        const $el = $(el);
        const title = $el.attr('title');
        const episodeNumber = title ? parseInt(title, 10) : NaN;

        if (!title || isNaN(episodeNumber)) return null;

        return {
          id: $el.attr('id') || '',
          number: episodeNumber,
          title: `Ep ${title}`,
          url: `${this.baseUrl}${$el.attr('href')}`,
          isSubbed: subOrDub === SubOrSub.SUB,
          isDubbed: subOrDub === SubOrSub.DUB,
        };
      })
      .get()
      .filter((v) => v !== null);
  };
}

module.exports = AnimeOwl;
