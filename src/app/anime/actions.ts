
'use server';

import { Meta, Anime } from 'hakai-extensions';

const anilist = new Meta.Anilist();
const hianime = new Anime.HiAnime();

export interface AnimeSearchResult {
    id: string;
    title: string;
    image: string;
    releaseDate: string | number;
    subOrDub: 'sub' | 'dub';
}

export interface AnimeDetails {
    id: string;
    title: string;
    image: string;
    description: string;
    genres: string[];
    status: string;
    releaseDate: number;
    totalEpisodes: number;
    episodes: {
        id: string;
        number: number;
        title?: string;
    }[];
}

export interface EpisodeSource {
    url: string;
    quality?: string;
}

export async function searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
        const data = await anilist.search(query);
        return data.results.map((item: any) => ({
            id: item.id,
            title: item.title.english || item.title.romaji,
            image: item.image,
            releaseDate: item.releaseDate,
            subOrDub: item.subOrDub,
        }));
    } catch (error) {
        console.error("Error searching anime with hakai-extensions:", error);
        return [];
    }
}

export async function getAnimeDetails(animeId: string): Promise<AnimeDetails | null> {
    try {
        const data = await anilist.fetchAnilistInfoById(animeId);
        
        return {
            id: data.id,
            title: data.title.english || data.title.romaji,
            image: data.image,
            description: data.description,
            genres: data.genres,
            status: data.status,
            releaseDate: data.releaseDate,
            totalEpisodes: data.totalEpisodes,
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
