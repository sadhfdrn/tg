
import * as fs from 'fs';
import * as path from 'path';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';

const parseCookieFile = (filePath: string) => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');

        const cookies: { [domain: string]: string } = {};
        let currentDomain = '';

        for (const line of lines) {
            if (line.trim().length === 0 || line.startsWith('#')) {
                continue;
            }

            // Check for domain headers
            if (line.includes('Cookie') || line.includes('cokkie')) {
                currentDomain = line.split(' ')[0].toLowerCase();
                cookies[currentDomain] = '';
            } else if (currentDomain) {
                cookies[currentDomain] += line;
            }
        }
        
        return {
            animepahe: cookies['animepahe.ru'] || '',
            pahewin: cookies['pahewin'] || '',
            kwik: cookies['kwik'] || '',
        };

    } catch (error) {
        console.error("Could not read or parse cookie file", error);
        return { animepahe: '', pahewin: '', kwik: '' };
    }
}

const cookieFilePath = path.join(process.cwd(), 'r4gwb7.txt');
const parsedCookies = parseCookieFile(cookieFilePath);

export const ANIMEPAHE_COOKIE = parsedCookies.animepahe;
export const PAHEWIN_COOKIE = parsedCookies.pahewin;
export const KWIK_COOKIE = parsedCookies.kwik;
