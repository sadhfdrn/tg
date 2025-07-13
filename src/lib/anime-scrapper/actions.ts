'use server';

import AnimeOwl from './animeowl';
import { IAnimeInfo, IAnimeResult, ISearch, ISource } from './models';

const animeowl = new AnimeOwl();

export async function searchAnime(query: string): Promise<ISearch<IAnimeResult>> {
  try {
    const res = await animeowl.search(query);
    const validResults = res.results.filter(item => item.image && (item.image.startsWith('http') || item.image.startsWith('https://')));
    return { ...res, results: validResults };
  } catch (err) {
    console.error(err);
    throw new Error('Failed to search for anime.');
  }
}

export async function getAnimeInfo(id: string): Promise<IAnimeInfo> {
  try {
    const res = await animeowl.fetchAnimeInfo(id);
    return res;
  } catch (err) {
    console.error(err);
    throw new Error('Failed to get anime info.');
  }
}

export async function getEpisodeSources(episodeId: string): Promise<ISource> {
  try {
    const res = await animeowl.fetchEpisodeSources(episodeId);
    return res;
  } catch (err) {
    console.error(err);
    throw new Error('Failed to get episode sources.');
  }
}
