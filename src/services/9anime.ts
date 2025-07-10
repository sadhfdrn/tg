
import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import UserAgent from 'user-agents';

// Define interfaces for our data structures
export interface SearchResult {
    title: string;
    url: string;
    id: string;
    poster: string;
    year: string;
    status: string;
    type: string;
}

export interface PopularAnime {
    title: string;
    url: string;
    id: string;
    poster: string;
    year: string;
    status: string;
    episodes: string;
}

export interface AnimeDetails {
    title: string;
    description: string;
    poster: string;
    year: string;
    status: string;
    genres: string[];
    episodes: string;
    duration: string;
    studio: string;
    score: string;
}

export interface DownloadLink {
    server: string;
    url: string;
    quality: string;
    type: 'sub' | 'dub';
    episode: number;
}

export interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    searchWorking?: boolean;
    error?: string;
}

export interface PluginInfo {
    name: string;
    displayName: string;
    description: string;
    version: string;
    features: string[];
}

class Enhanced9AnimePlugin {
    public name: string;
    public displayName: string;
    public icon: string;
    public description: string;
    private baseUrl: string;
    private searchEndpoint: string;
    private browserlessUrl: string;
    private maxRetries: number;
    private retryDelay: number;
    private realUserAgent: string;
    private proxyList: string[];
    private serverPriorities: Record<string, number>;
    private qualityPriorities: Record<string, number>;

    constructor() {
        this.name = '9anime';
        this.displayName = '9Anime TV';
        this.icon = '🎬';
        this.description = 'Advanced anime streaming from 9anime.to with multiple server support';
        this.baseUrl = 'https://9animetv.to';
        this.searchEndpoint = '/search';
        this.browserlessUrl = `https://browserless-rj4p.onrender.com`;
        this.maxRetries = 3;
        this.retryDelay = 2000;

        this.realUserAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

        this.proxyList = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];

        this.serverPriorities = {
            'vidstreaming': 1,
            'mycloud': 2,
            'mp4upload': 3,
            'streamtape': 4,
            'doodstream': 5
        };

        this.qualityPriorities = {
            '1080p': 1,
            '720p': 2,
            '480p': 3,
            '360p': 4
        };
    }

    private getRandomProxy(): string | null {
        if (!this.proxyList || this.proxyList.length === 0) return null;
        const index = Math.floor(Math.random() * this.proxyList.length);
        return this.proxyList[index];
    }

    private async createStealthBrowser(retryCount = 0): Promise<{ browser: Browser, page: Page }> {
        const userAgent = this.realUserAgent;
        const proxy = this.getRandomProxy();

        const browserOptions: PuppeteerLaunchOptions & { browserWSEndpoint?: string } = {
            browserWSEndpoint: `${this.browserlessUrl}?stealth&blockAds&token=${process.env.BROWSERLESS_TOKEN || ''}`,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
            ]
        };

        if (proxy) {
            browserOptions.args?.push(`--proxy-server=${proxy}`);
        }

        try {
            const browser = await puppeteer.connect(browserOptions);
            const page = await browser.newPage();

            await page.setUserAgent(userAgent);
            await page.setViewport({ width: 1920, height: 1080 });

            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            return { browser, page };

        } catch (error) {
            console.error(`Browser creation failed (attempt ${retryCount + 1}):`, error);
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.createStealthBrowser(retryCount + 1);
            }
            throw error;
        }
    }

    private async bypassCloudflare(page: Page): Promise<boolean> {
        // Cloudflare bypass logic can be complex and might need adjustments.
        // For Browserless, it's often handled automatically. This is a basic check.
        try {
            await page.waitForSelector('body', { timeout: 30000 });
            const title = await page.title();
            if (title.includes('Just a moment...')) {
                console.log('Cloudflare page detected, waiting for bypass...');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
            }
            return true;
        } catch (error) {
            console.error('Cloudflare bypass failed:', error);
            throw new Error('Failed to bypass Cloudflare');
        }
    }

    public async search(query: string, retryCount = 0): Promise<SearchResult[]> {
        let browser: Browser | null = null;
        try {
            const { browser: b, page } = await this.createStealthBrowser();
            browser = b;

            const searchUrl = `${this.baseUrl}${this.searchEndpoint}?keyword=${encodeURIComponent(query)}`;
            console.log(`Searching for: ${query}`);

            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector('.film_list-wrap', { timeout: 15000 });

            const results = await page.evaluate((): SearchResult[] => {
                const items = Array.from(document.querySelectorAll('.flw-item')).slice(0, 15);
                return items.map(item => {
                    const titleElement = item.querySelector('.film-name a');
                    const posterElement = item.querySelector('.film-poster img');
                    
                    const infoDiv = item.querySelector('.film-detail .fd-infor');
                    const year = infoDiv?.querySelector('.fdi-item:not(.fdi-duration):not(.fdi-type)')?.textContent?.trim() || 'N/A';
                    const type = infoDiv?.querySelector('.fdi-type')?.textContent?.trim() || 'TV';

                    const url = titleElement?.getAttribute('href') || '';
                    
                    return {
                        title: titleElement?.textContent?.trim() || 'Unknown',
                        url: url,
                        id: url.split('/').pop()?.split('?')[0] || '',
                        poster: posterElement?.getAttribute('data-src') || posterElement?.getAttribute('src') || '',
                        year: year,
                        status: 'Unknown', // Status is not available on search page
                        type: type
                    };
                });
            });

            console.log(`Found ${results.length} search results`);
            return results.filter(r => r.id);
        } catch (error) {
            console.error(`Search failed (attempt ${retryCount + 1}):`, error);
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.search(query, retryCount + 1);
            }
            throw new Error(`Search failed after ${this.maxRetries + 1} attempts: ${(error as Error).message}`);
        } finally {
            await browser?.close();
        }
    }

    public async getAnimeDetails(animeId: string, retryCount = 0): Promise<AnimeDetails> {
        let browser: Browser | null = null;
        try {
            const { browser: b, page } = await this.createStealthBrowser();
            browser = b;

            const animeUrl = `${this.baseUrl}/watch/${animeId}`;
            console.log(`Fetching details for: ${animeId}`);

            await page.goto(animeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector('.anisc-detail', { timeout: 15000 });

            const details = await page.evaluate((): AnimeDetails => {
                const title = document.querySelector('.anisc-detail .film-name')?.textContent?.trim() || 'Unknown';
                const description = document.querySelector('.anisc-detail .film-description')?.textContent?.trim() || 'No description.';
                const poster = document.querySelector('.anisc-poster .film-poster-img')?.getAttribute('src') || '';
                
                const infoItems: Record<string, string> = {};
                document.querySelectorAll('.anisc-info .item-head').forEach(itemHead => {
                    const key = itemHead?.textContent?.trim().toLowerCase().replace(':', '') || '';
                    const valueContainer = itemHead.nextElementSibling;
                    const value = valueContainer?.textContent?.trim() || '';
                    if (key) infoItems[key] = value;
                });
                
                const genres = Array.from(document.querySelectorAll('.anisc-info .genres a')).map(el => el.textContent?.trim() || '').filter(Boolean);

                return {
                    title,
                    description,
                    poster,
                    year: infoItems['premiered'] || 'N/A',
                    status: infoItems['status'] || 'Unknown',
                    genres,
                    episodes: infoItems['total episode'] || 'N/A',
                    duration: infoItems['duration'] || 'N/A',
                    studio: infoItems['studios'] || 'N/A',
                    score: 'N/A' // Score is not consistently available
                };
            });

            console.log(`Successfully fetched details for: ${details.title}`);
            return details;
        } catch (error) {
            console.error(`Get anime details failed (attempt ${retryCount + 1}):`, error);
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.getAnimeDetails(animeId, retryCount + 1);
            }
            throw new Error(`Get anime details failed after ${this.maxRetries + 1} attempts: ${(error as Error).message}`);
        } finally {
            await browser?.close();
        }
    }

    public async getStreamingLinks(animeId: string, episodeNumber: number, type: 'sub' | 'dub' = 'sub', retryCount = 0): Promise<DownloadLink[]> {
        let browser: Browser | null = null;
        try {
            const { browser: b, page } = await this.createStealthBrowser();
            browser = b;

            // Scrape the server page to get data-id for the episode
            const animeWatchUrl = `${this.baseUrl}/watch/${animeId}`;
            await page.goto(animeWatchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            const episodeServerId = await page.evaluate((epNum, epType) => {
                const epSelector = epType === 'dub' ? '#episodes-dub .ep-item' : '#episodes-sub .ep-item';
                const episodeElement = Array.from(document.querySelectorAll(epSelector)).find(el => el.getAttribute('data-number') === String(epNum));
                return episodeElement?.getAttribute('data-id') || null;
            }, episodeNumber, type);

            if (!episodeServerId) {
                throw new Error(`Could not find server ID for episode ${episodeNumber} (${type})`);
            }

            // Fetch server URLs using the scraped ID
            const serversUrl = `${this.baseUrl}/ajax/episode/servers?episodeId=${episodeServerId}`;
            await page.goto(serversUrl, { waitUntil: 'networkidle2' });
            const serversData = await page.evaluate(() => JSON.parse(document.body.textContent || '{}'));
            
            if (serversData.status !== true) {
                throw new Error('Failed to fetch server list from AJAX endpoint');
            }
            
            const servers = await page.evaluate(() => {
                const serverElements = document.querySelectorAll('.ps_-buttons .item');
                return Array.from(serverElements).map(el => ({
                    name: el.querySelector('span')?.textContent?.trim() || 'Unknown',
                    id: el.getAttribute('data-id') || ''
                }));
            });

            if (servers.length === 0) throw new Error('No servers found on page.');

            const sortedServers = servers.sort((a, b) => this.getServerPriority(a.name) - this.getServerPriority(b.name));
            
            const downloadLinks: DownloadLink[] = [];

            for (const server of sortedServers) {
                try {
                    console.log(`Trying server: ${server.name}`);
                    const streamUrl = `${this.baseUrl}/ajax/episode/sources?id=${server.id}`;
                    await page.goto(streamUrl, { waitUntil: 'networkidle2' });
                    const streamData = await page.evaluate(() => JSON.parse(document.body.textContent || '{}'));

                    if(streamData.status === true && streamData.result?.url) {
                         downloadLinks.push({
                            server: server.name,
                            url: streamData.result.url,
                            quality: 'HD', // Assume best, can be refined
                            type: type,
                            episode: episodeNumber
                        });
                        console.log(`Successfully extracted link from: ${server.name}`);
                        break; 
                    }
                } catch (serverError) {
                    console.error(`Failed to extract from server ${server.name}:`, serverError);
                }
            }
             if (downloadLinks.length === 0) throw new Error('No streaming links found from any server');
            
            return downloadLinks;

        } catch (error) {
            console.error(`Get streaming links failed (attempt ${retryCount + 1}):`, error);
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.getStreamingLinks(animeId, episodeNumber, type, retryCount + 1);
            }
            throw new Error(`Get streaming links failed after ${this.maxRetries + 1} attempts: ${(error as Error).message}`);
        } finally {
            await browser?.close();
        }
    }
    
    private getServerPriority(serverName?: string): number {
        const name = serverName?.toLowerCase() || '';
        for (const [key, priority] of Object.entries(this.serverPriorities)) {
            if (name.includes(key)) {
                return priority;
            }
        }
        return 999;
    }

    public async downloadSeason(animeId: string, quality = '1080p', type: 'sub' | 'dub' = 'sub'): Promise<DownloadLink[]> {
        try {
            console.log(`Starting season download for: ${animeId}`);
            const details = await this.getAnimeDetails(animeId);
            const totalEpisodes = parseInt(details.episodes, 10);

            if (isNaN(totalEpisodes) || totalEpisodes <= 0) {
                throw new Error('Could not determine the number of episodes.');
            }
            
            console.log(`Detected ${totalEpisodes} episodes for season download`);
            
            const allLinks: DownloadLink[] = [];
            for (let i = 1; i <= totalEpisodes; i++) {
                try {
                    const links = await this.getStreamingLinks(animeId, i, type);
                    if (links.length > 0) {
                        allLinks.push(links[0]); // Add the highest priority link
                    }
                    await this.delay(1000); // Small delay between episode requests
                } catch (epError) {
                    console.error(`Failed to get links for episode ${i}:`, epError);
                }
            }
            
            return allLinks;

        } catch (error) {
            console.error('Download season failed:', error);
            throw new Error(`Download season failed: ${(error as Error).message}`);
        }
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async healthCheck(): Promise<HealthCheckResult> {
        try {
            const testSearch = await this.search('test');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                searchWorking: testSearch.length > 0
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: (error as Error).message
            };
        }
    }

    public getInfo(): PluginInfo {
        return {
            name: this.name,
            displayName: this.displayName,
            description: this.description,
            version: '2.0.0-ts',
            features: [
                'TypeScript Conversion',
                'Advanced Cloudflare bypass',
                'Multiple server support',
                'Batch episode downloading',
                'SUB/DUB support',
                'Automatic episode detection',
                'Retry mechanism',
                'Proxy rotation'
            ]
        };
    }
}

export default Enhanced9AnimePlugin;
