'use server';

import Enhanced9AnimePlugin from '@/services/9anime.js';

const animePlugin = new Enhanced9AnimePlugin();

export async function searchAnime(query: string) {
  try {
    const results = await animePlugin.search(query);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Error searching anime:', error);
    return { success: false, error: error.message };
  }
}

export async function getAnimeDetails(animeId: string) {
  try {
    const details = await animePlugin.getAnimeDetails(animeId);
    // This is a proxy to avoid CORS issues in the browser with scraped images.
    details.poster = `/api/image-proxy?url=${encodeURIComponent(details.poster)}`;
    return { success: true, data: details };
  } catch (error: any) {
    console.error('Error getting anime details:', error);
    return { success: false, error: error.message };
  }
}

export async function getAnimeSeason(animeId: string) {
  try {
    // For now, we are fetching the whole season.
    // In the future, you could add quality and type selection.
    const seasonLinks = await animePlugin.downloadSeason(animeId);
    return { success: true, data: seasonLinks };
  } catch (error: any) {
    console.error('Error getting anime season:', error);
    return { success: false, error: error.message };
  }
}

    