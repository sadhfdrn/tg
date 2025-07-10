
'use server';

import axios from 'axios';

const consumetApi = axios.create({
    baseURL: 'https://consumet-api-ayh8.onrender.com'
});

export interface AnimeSearchResult {
    id: string;
    title: string;
    image: string;
    releaseDate: string | number;
    subOrDub: string;
}

export interface AnimeDetails {
    id: string;
    title: string;
    image: string;
    description: string;
    genres: string[];
    status: string;
    releaseDate: string | number;
    totalEpisodes: number;
    episodes: {
        id: string;
        number: number;
        title?: string;
        url?: string;
    }[];
}

export interface EpisodeSource {
    url: string;
    quality?: string;
}

export async function searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
        const { data } = await consumetApi.get(`/anime/gogoanime/${encodeURIComponent(query)}`);
        return data.results.map((item: any) => ({
            id: item.id,
            title: item.title,
            image: item.image,
            releaseDate: item.releaseDate,
            subOrDub: item.subOrDub,
        }));
    } catch (error) {
        console.error("Error searching anime with Consumet API:", error);
        return [];
    }
}

export async function getAnimeDetails(animeId: string): Promise<AnimeDetails | null> {
    try {
        const { data } = await consumetApi.get(`/anime/gogoanime/info/${animeId}`);
        return {
            id: data.id,
            title: data.title,
            image: data.image,
            description: data.description,
            genres: data.genres,
            status: data.status,
            releaseDate: data.releaseDate,
            totalEpisodes: data.totalEpisodes,
            episodes: data.episodes.map((ep: any) => ({
                id: ep.id,
                number: ep.number,
                url: ep.url
            })),
        };
    } catch (error) {
        console.error("Error getting anime details with Consumet API:", error);
        return null;
    }
}

export async function getEpisodeSources(episodeId: string): Promise<EpisodeSource[]> {
    try {
        const { data } = await consumetApi.get(`/anime/gogoanime/watch/${episodeId}`);
        const referer = data.headers?.Referer || data.headers?.referer || 'https://gogoanime.lu';

        return data.sources.map((source: any) => ({
            quality: source.quality,
            url: `/api/anime-proxy?url=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(referer)}`
        }));
    } catch (error) {
        console.error("Error getting episode sources with Consumet API:", error);
        return [];
    }
}
