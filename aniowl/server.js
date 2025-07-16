
const express = require('express');
const { searchAnime, getAnimeInfo, getEpisodeSources } = require('./actions.js');

const app = express();
const port = 3001;

app.use(express.json());

// Root endpoint with API description
app.get('/anime', (req, res) => {
    res.status(200).json({
        message: 'Welcome to the AniOwl API!',
        description: 'This API allows you to search for anime, get detailed information, and find episode streaming sources.',
        endpoints: {
            search: '/anime/search/:query',
            info: '/anime/info/:animeId',
            sources: '/anime/sources/:episodeId'
        },
        example: {
            search: '/anime/search/dandadan',
            info: '/anime/info/dandadan$18979',
            sources: '/anime/sources/dandadan$225134'
        }
    });
});

// Search for an anime
app.get('/anime/search/:query', async (req, res) => {
    const { query } = req.params;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required.' });
    }
    try {
        const results = await searchAnime(query);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get anime info (details and episode list)
app.get('/anime/info/:animeId', async (req, res) => {
    const { animeId } = req.params;
    if (!animeId) {
        return res.status(400).json({ error: 'Anime ID parameter is required.' });
    }
    try {
        const results = await getAnimeInfo(animeId);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get episode streaming sources
app.get('/anime/sources/:episodeId', async (req, res) => {
    const { episodeId } = req.params;
     if (!episodeId) {
        return res.status(400).json({ error: 'Episode ID parameter is required.' });
    }
    try {
        const results = await getEpisodeSources(episodeId);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`AniOwl API server listening at http://localhost:${port}`);
});
