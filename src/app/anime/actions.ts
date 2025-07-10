
'use server';

import { Meta, Anime } from 'hakai-extensions';

const anilist = new Meta.Anilist();
const hianime = new Anime.HiAnime();

export interface AnimeSearchResult {
    id: string;
    title: string;
    image: string;
    releaseDate: string | null;
    malId: number | null;
}

export interface AnimeDetails {
    id: string;
    title: string;
    image: string;
    description: string;
    status: string;
    totalEpisodes: number;
    releaseDate: number | null;
    malId: number | null;
    episodes: {
        id: string;
        number: number;
        title: string | null;
    }[];
}

export interface EpisodeSource {
    url: string;
    quality: string;
}

export async function searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
        const data = await anilist.search(query);
        return data.results.map((item: any) => ({
            id: item.id,
            title: item.title.romaji || item.title.english || item.title.native,
            image: item.image,
            releaseDate: item.releaseDate,
            malId: item.malId,
        }));
    } catch (error) {
        console.error("Error searching anime with hakai-extensions:", error);
        return [];
    }
}

export async function getAnimeDetails(animeId: string): Promise<AnimeDetails | null> {
    try {
        const data = await anilist.fetchAnimeInfo(animeId);
        return {
            id: data.id,
            title: data.title.romaji || data.title.english || data.title.native,
            image: data.image,
            description: data.description,
            status: data.status,
            totalEpisodes: data.totalEpisodes,
            releaseDate: data.releaseDate,
            malId: data.malId,
            episodes: data.episodes.map((ep: any) => ({
                id: ep.id,
                number: ep.number,
                title: ep.title,
            })),
        };
    } catch (error) {
        console.error("Error getting anime details with hakai-extensions:", error);
        return null;
    }
}

export async function getEpisodeSources(episodeId: string): Promise<EpisodeSource[]> {
    try {
        const data = await hianime.fetchEpisodeSources(episodeId);

        if (!data.sources || data.sources.length === 0) {
            return [];
        }

        const referer = data.headers?.Referer || data.headers?.referer || 'https://hianime.to';

        return data.sources.map((source: any) => ({
            quality: source.quality,
            url: `/api/anime-proxy?url=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(referer)}`
        }));

    } catch (error) {
        console.error("Error getting episode sources with hakai-extensions:", error);
        return [];
    }
}
