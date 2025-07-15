
import axios from 'axios';

let cachedCookies: Record<string, string> | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 25 * 60 * 1000; // 25 minutes

async function fetchAndParseCookies(): Promise<Record<string, string>> {
  const cookieApiUrl = process.env.COOKIE_API_URL;

  if (!cookieApiUrl) {
    throw new Error('COOKIE_API_URL environment variable must be set.');
  }

  const endpoint = `${cookieApiUrl}/api/cookies`;

  try {
    const response = await axios.get(endpoint, {
      timeout: 15000, // 15-second timeout
    });

    if (response.data && response.data.success && typeof response.data.cookies === 'object') {
      console.log('Successfully fetched new cookies.');
      return response.data.cookies;
    } else {
      console.error('Invalid response format from cookie service:', response.data);
      throw new Error(`Failed to fetch cookies from API: ${response.data?.error || 'Invalid response format'}`);
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        // Extract the specific error message from the cookie service if available
        const serverErrorMessage = errorData?.error || JSON.stringify(errorData);
        console.error('Axios error fetching cookies from API:', {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
            data: serverErrorMessage
        });
        // Pass the specific error from the cookie service back to the client
        throw new Error(`Failed to connect to cookie service: ${serverErrorMessage || error.message}`);
    }
    console.error('Generic error fetching cookies from API:', error);
    throw new Error('Failed to retrieve fresh cookies from the Puppeteer service.');
  }
}

export async function getCookies(): Promise<{ animepahe: string; pahewin: string; kwik: string }> {
  const now = Date.now();
  if (!cachedCookies || (now - lastFetchTime > CACHE_DURATION_MS)) {
    console.log('Cache expired or empty. Fetching new cookies from service...');
    cachedCookies = await fetchAndParseCookies();
    lastFetchTime = now;
  } else {
    console.log('Using cached cookies.');
  }

  const { animepahe, pahewin, kwik } = cachedCookies;

  if (!animepahe || !pahewin || !kwik) {
    cachedCookies = null; 
    throw new Error('One or more required cookies (animepahe, pahewin, kwik) are missing from the API response.');
  }

  return { animepahe, pahewin, kwik };
}
