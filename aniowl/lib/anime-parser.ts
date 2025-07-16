

const BaseParser = require('./base-parser');

class AnimeParser extends BaseParser {
  isDubAvailableSeparately = false;
  
  fetchAnimeInfo(animeId, ...args) {
    throw new Error('Method not implemented.');
  }

  fetchEpisodeSources(episodeId, ...args) {
    throw new Error('Method not implemented.');
  }

  fetchEpisodeServers(episodeId, ...args) {
    throw new Error('Method not implemented.');
  }

  search(query, ...args) {
    throw new Error('Method not implemented.');
  }
}

module.exports = AnimeParser;
