
import { promises as fs } from 'fs';
import path from 'path';

let cachedCookies: Record<string, string> | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 25 * 60 * 1000; // 25 minutes

async function fetchAndParseCookies(): Promise<Record<string, string>> {
  const cookieApiUrl = process.env.COOKIE_API_URL;
  if (!cookieApiUrl) {
    // Fallback to local file for testing if API is not set
    const filePath = path.join(process.cwd(), 'r4gwb7.txt');
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const cookies: Record<string, string> = {};
      const lines = fileContent.split('\n');
      lines.forEach(line => {
        if(line.startsWith('animepahe:')) cookies.animepahe = line.replace('animepahe:', '').trim();
        if(line.startsWith('pahewin:')) cookies.pahewin = line.replace('pahewin:', '').trim();
        if(line.startsWith('kwik:')) cookies.kwik = line.replace('kwik:', '').trim();
      });
      return cookies;
    } catch (error) {
      throw new Error("Local cookie file not found and COOKIE_API_URL is not set. Cannot proceed.");
    }
  }

  try {
    const response = await fetch(cookieApiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch cookies: ${response.statusText}`);
    }
    const cookies = await response.json();
    return cookies;
  } catch (error) {
    console.error("Error fetching cookies from API:", error);
    throw new Error("Failed to retrieve fresh cookies from the Puppeteer service.");
  }
}

export async function getCookies(): Promise<{ animepahe: string; pahewin: string; kwik: string }> {
  const now = Date.now();
  if (!cachedCookies || (now - lastFetchTime > CACHE_DURATION_MS)) {
    console.log("Fetching new cookies...");
    cachedCookies = await fetchAndParseCookies();
    lastFetchTime = now;
  } else {
    console.log("Using cached cookies.");
  }

  if (!cachedCookies?.animepahe || !cachedCookies?.pahewin || !cachedCookies?.kwik) {
    throw new Error("One or more required cookies (animepahe, pahewin, kwik) are missing.");
  }

  return cachedCookies as { animepahe: string; pahewin: string; kwik: string };
}
