
// A simple test script to demonstrate usage of the scraper
const { searchAnime, getAnimeInfo, getEpisodeSources } = require('./actions');

async function runTest() {
    try {
        console.log("--- Testing Anime Search ---");
        const searchResults = await searchAnime("Dandadan");
        if (searchResults.results.length === 0) {
            throw new Error("Search returned no results.");
        }
        console.log(`Search successful. Found ${searchResults.results.length} results.`);
        
        const firstResult = searchResults.results[0];
        console.log(`\n--- Testing Fetch Anime Info for: ${firstResult.title} (ID: ${firstResult.id}) ---`);
        
        const animeInfo = await getAnimeInfo(firstResult.id);
        if (!animeInfo.episodes || animeInfo.episodes.length === 0) {
            throw new Error("Could not fetch anime info or no episodes found.");
        }
        console.log(`Successfully fetched info. Title: ${animeInfo.title}, Episodes: ${animeInfo.episodes.length}`);

        const firstEpisode = animeInfo.episodes[0];
        console.log(`\n--- Testing Fetch Episode Sources for Episode ${firstEpisode.number} ---`);

        // Note: The getEpisodeSources function now requires a running proxy.
        // This test script will fail unless you start the local proxy server first.
        // Run `npm start` in a separate terminal before running `npm test`.

        const localProxyUrl = `http://localhost:3001/api/anime-proxy`;
        
        const servers = await getEpisodeSources(firstEpisode.id);
        const sourceUrl = servers.sources[0]?.url;

        if (!sourceUrl) {
            throw new Error("Could not get a source URL from the episode servers.");
        }
        
        console.log("Episode source URL obtained. Now attempting to fetch via local proxy...");

        const proxiedUrl = `${localProxyUrl}?url=${encodeURIComponent(sourceUrl)}`;
        
        const response = await fetch(proxiedUrl);
        
        console.log(`Proxy Response Status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch from proxy. Status: ${response.status}. Body: ${errorText}`);
        }
        
        const contentLength = response.headers.get('content-length');
        console.log(`Successfully fetched from proxy. Content-Length: ${contentLength || 'Unknown'}`);
        console.log("\n✅ All tests passed!");

    } catch (error) {
        console.error("\n❌ Test Failed:", error.message);
    }
}

runTest();
