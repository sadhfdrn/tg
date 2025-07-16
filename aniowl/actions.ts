
'use server';

import AnimeOwl from './lib/animeowl';
import { IAnimeInfo, IAnimeResult, ISearch, ISource } from './lib/models';

const animeowl = new AnimeOwl();

export async function searchAnime(query: string): Promise<ISearch<IAnimeResult>> {
  try {
    const res = await animeowl.search(query);
    const validResults = res.results.filter(item => item.image && (item.image.startsWith('http') || item.image.startsWith('https://')));
    return { ...res, results: validResults };
  } catch (err) {
    console.error(`Error in searchAnime for provider animeowl:`, err);
    throw new Error((err as Error).message || `Failed to search for anime on animeowl. Check server logs for details.`);
  }
}

export async function getAnimeInfo(id: string): Promise<IAnimeInfo> {
  try {
    const res = await animeowl.fetchAnimeInfo(id);
    return res;
  } catch (err) {
    console.error(`Error in getAnimeInfo for provider animeowl:`, err);
    throw new Error((err as Error).message || `Failed to get anime info from animeowl. Check server logs for details.`);
  }
}

export async function getEpisodeSources(episodeId: string): Promise<ISource> {
  try {
    const res = await animeowl.fetchEpisodeSources(episodeId);
    return res;
  } catch (err) {
    console.error(`Error in getEpisodeSources for provider animeowl:`, err);
    throw new Error((err as Error).message || `Failed to get episode sources from animeowl. Check server logs for details.`);
  }
}
