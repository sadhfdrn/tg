
'use server';

const AnimeOwl = require('./lib/animeowl');

const animeowl = new AnimeOwl();

async function searchAnime(query) {
  try {
    const res = await animeowl.search(query);
    const validResults = res.results.filter(item => item.image && (item.image.startsWith('http') || item.image.startsWith('https://')));
    return { ...res, results: validResults };
  } catch (err) {
    console.error(`Error in searchAnime for provider animeowl:`, err);
    throw new Error((err).message || `Failed to search for anime on animeowl. Check server logs for details.`);
  }
}

async function getAnimeInfo(id) {
  try {
    const res = await animeowl.fetchAnimeInfo(id);
    return res;
  } catch (err) {
    console.error(`Error in getAnimeInfo for provider animeowl:`, err);
    throw new Error((err).message || `Failed to get anime info from animeowl. Check server logs for details.`);
  }
}

async function getEpisodeSources(episodeId) {
  try {
    const res = await animeowl.fetchEpisodeSources(episodeId);
    return res;
  } catch (err) {
    console.error(`Error in getEpisodeSources for provider animeowl:`, err);
    throw new Error((err).message || `Failed to get episode sources from animeowl. Check server logs for details.`);
  }
}

module.exports = {
    searchAnime,
    getAnimeInfo,
    getEpisodeSources
};
