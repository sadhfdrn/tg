
'use server';

const CONSUMET_API_URL = process.env.CONSUMET_API_URL || 'https://anime-two-hazel.vercel.app';

export interface AnimeSearchResult {
    id: string;
    title: string;
    image: string;
    releaseDate: string;
    type: string;
}

export interface AnimeDetails {
    id: string;
    title: string;
    image: string;
    description: string;
    status: string;
    totalEpisodes: number;
    episodes: {
        id: string;
        number: number;
        session: string;
        url: string;
    }[];
}

export interface EpisodeSource {
    url: string;
    quality: string;
}

export async function searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
        const response = await fetch(`${CONSUMET_API_URL}/anime/animepahe/${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Consumet API returned an error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error("Error searching anime:", error);
        return [];
    }
}

export async function getAnimeDetails(animeId: string): Promise<AnimeDetails | null> {
    try {
        const response = await fetch(`${CONSUMET_API_URL}/anime/animepahe/info/${animeId}`);
        if (!response.ok) {
            throw new Error(`Consumet API returned an error: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error getting anime details:", error);
        return null;
    }
}

export async function getEpisodeSources(episodeId: string): Promise<EpisodeSource[]> {
    try {
        const response = await fetch(`${CONSUMET_API_URL}/anime/animepahe/watch/${episodeId}`);
        if (!response.ok) {
            throw new Error(`Consumet API returned an error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.sources || [];
    } catch (error) {
        console.error("Error getting episode sources:", error);
        return [];
    }
}
