
import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: URL is missing');
        return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname !== '/api/anime-proxy') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }

    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: "url" query parameter is missing');
        return;
    }

    try {
        const target = new URL(targetUrl);
        const protocol = target.protocol === 'https:' ? https : http;

        const proxyReq = protocol.request(target, {
            method: req.method,
            headers: {
                ...req.headers,
                host: target.host, // Important: set the host header to the target's host
                referer: 'https://animeowl.me/' // Add referer header
            },
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode!, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        req.pipe(proxyReq, { end: true });

        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Bad Gateway');
        });

    } catch (err) {
        console.error('Error parsing target URL:', err);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: Invalid target URL');
    }
});

server.listen(PORT, () => {
    console.log(`AnimeOwl Test Server running on http://localhost:${PORT}`);
    console.log(`Proxy endpoint is available at /api/anime-proxy`);
});
