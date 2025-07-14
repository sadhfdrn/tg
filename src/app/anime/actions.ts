
'use server';

import AnimeOwl from '@/lib/anime-scrapper/animeowl';
import AnimePahe from '@/lib/anime-scrapper/animepahe';
import { IAnimeInfo, IAnimeResult, ISearch, ISource } from '@/lib/anime-scrapper/models';

const animeowl = new AnimeOwl();
const animepahe = new AnimePahe();

type AnimeProvider = 'animeowl' | 'animepahe';

function getProvider(provider: AnimeProvider) {
    switch (provider) {
        case 'animeowl':
            return animeowl;
        case 'animepahe':
            return animepahe;
        default:
            return animeowl;
    }
}

export async function searchAnime(query: string, provider: AnimeProvider): Promise<ISearch<IAnimeResult>> {
  try {
    const activeProvider = getProvider(provider);
    const res = await activeProvider.search(query);
    const validResults = res.results.filter(item => item.image && (item.image.startsWith('http') || item.image.startsWith('https://')));
    return { ...res, results: validResults };
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || 'Failed to search for anime.');
  }
}

export async function getAnimeInfo(id: string, provider: AnimeProvider): Promise<IAnimeInfo> {
  try {
    const activeProvider = getProvider(provider);
    const res = await activeProvider.fetchAnimeInfo(id);
    return res;
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || 'Failed to get anime info.');
  }
}

export async function getEpisodeSources(episodeId: string, provider: AnimeProvider): Promise<ISource> {
  try {
    const activeProvider = getProvider(provider);
    const res = await activeProvider.fetchEpisodeSources(episodeId);
    return res;
  } catch (err: any) {
    console.error(err);
    throw new Error(err.message || 'Failed to get episode sources.');
  }
}
