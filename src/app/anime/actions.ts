
'use server';

import { hianime } from '@/lib/anime-provider';

export interface AnimeSearchResult {
    id: string;
    name: string;
    poster: string;
    sub: number;
    dub: number;
    type: string;
}

export interface AnimeDetails {
    id: string;
    name: string;
    poster: string;
    description: string;
    stats: {
        type: string;
        episodes: {
            sub: number;
            dub: number;
        };
        duration: string;
        rating: string;
    };
    episodes: {
        episodeId: string;
        number: number;
        title: string;
    }[];
}

export interface EpisodeSource {
    url: string;
    quality?: string;
}

export async function searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
        const data = await hianime.search(query);
        return data.animes.map((item: any) => ({
            id: item.id,
            name: item.name,
            poster: item.poster,
            sub: item.episodes.sub,
            dub: item.episodes.dub,
            type: item.type,
        }));
    } catch (error) {
        console.error("Error searching anime with aniwatch-fork:", error);
        return [];
    }
}

export async function getAnimeDetails(animeId: string): Promise<AnimeDetails | null> {
    try {
        const [details, episodesData] = await Promise.all([
            hianime.getInfo(animeId),
            hianime.getEpisodes(animeId)
        ]);

        return {
            id: details.anime.info.id,
            name: details.anime.info.name,
            poster: details.anime.info.poster,
            description: details.anime.info.description,
            stats: details.anime.info.stats,
            episodes: episodesData.episodes.map((ep: any) => ({
                episodeId: ep.episodeId,
                number: ep.number,
                title: ep.title,
            })),
        };
    } catch (error) {
        console.error("Error getting anime details with aniwatch-fork:", error);
        return null;
    }
}

export async function getEpisodeSources(episodeId: string, category: 'sub' | 'dub'): Promise<EpisodeSource[]> {
     try {
        const data = await hianime.getEpisodeSources(episodeId, "vidstreaming", category);

        if (!data.sources || data.sources.length === 0) {
            return [];
        }

        const referer = data.headers?.Referer || data.headers?.referer || 'https://hianime.to';

        return data.sources.map((source: any) => ({
            quality: source.quality,
            url: `/api/anime-proxy?url=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(referer)}`
        }));

    } catch (error) {
        console.error("Error getting episode sources with aniwatch-fork:", error);
        return [];
    }
}
