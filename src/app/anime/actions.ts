
'use server';

import AnimeOwl from '@/lib/anime-scrapper/animeowl';
import AnimePahe from '@/lib/anime-scrapper/animepahe';
import { IAnimeInfo, IAnimeResult, ISearch, ISource } from '@/lib/anime-scrapper/models';

const animeProviders = {
  animeowl: new AnimeOwl(),
  animepahe: new AnimePahe(),
};

type Provider = keyof typeof animeProviders;

export async function searchAnime(query: string, provider: Provider = 'animeowl'): Promise<ISearch<IAnimeResult>> {
  try {
    const res = await animeProviders[provider].search(query);
    const validResults = res.results.filter(item => item.image && (item.image.startsWith('http') || item.image.startsWith('https://')));
    return { ...res, results: validResults };
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || `Failed to search for anime on ${provider}.`);
  }
}

export async function getAnimeInfo(id: string, provider: Provider = 'animeowl'): Promise<IAnimeInfo> {
  try {
    const res = await animeProviders[provider].fetchAnimeInfo(id);
    return res;
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || `Failed to get anime info from ${provider}.`);
  }
}

export async function getEpisodeSources(episodeId: string, provider: Provider = 'animeowl'): Promise<ISource> {
  try {
    const res = await animeProviders[provider].fetchEpisodeSources(episodeId);
    return res;
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || `Failed to get episode sources from ${provider}.`);
  }
}
