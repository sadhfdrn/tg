// By setting this env var, we are instructing the 'aniwatch-fork' library 
// to disable its pino logger, which is incompatible with the Next.js runtime.
process.env.ANIME_LOGS = 'false';

import { HiAnime } from 'aniwatch-fork';

export const hianime = new HiAnime.Scraper();
