
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import tiktokdl from '@tobyg74/tiktok-api-dl';
import sharp from 'sharp';

const userAgents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0',
    'TikTok 26.2.0 rv:262018 (iPhone; iOS 16.5; en_US) Cronet'
];

const tempDir = path.join(os.tmpdir(), 'televerse-tiktok');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

(async () => {
    try {
        await promisify(exec)('ffmpeg -version');
    } catch (error) {
        console.error('FFmpeg not found! Please install FFmpeg.');
    }
})();

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function parseCookie(cookieInput: string): string {
    if (!cookieInput) return '';

    // Check if it's likely a Netscape cookie file content
    if (cookieInput.includes('# Netscape HTTP Cookie File')) {
        return cookieInput
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split('\t');
                if (parts.length >= 7) {
                    return `${parts[5]}=${parts[6]}`;
                }
                return null;
            })
            .filter(Boolean)
            .join('; ');
    }
    
    // Assume it's a header string or needs no parsing
    return cookieInput.replace(/\r\n/g, '').replace(/\n/g, '');
}

function extractVideoUrl(result: any) {
    const possibleUrls = [
        result.video?.playAddr?.[0], result.video?.downloadAddr?.[0],
        result.video1, result.video2, result.play, result.wmplay,
        result.video?.play, result.video?.wmplay
    ];
    for (const url of possibleUrls) {
        if (url && typeof url === 'string') return url;
    }
    return null;
}

async function extractMediaData(result: any): Promise<{ type: 'video' | 'image', url: string, index: number }[]> {
    const mediaData: { type: 'video' | 'image', url: string, index: number }[] = [];
    const videoUrl = extractVideoUrl(result);
    if (videoUrl) {
        mediaData.push({ type: 'video', url: videoUrl, index: 0 });
    }
    if (result.images && Array.isArray(result.images)) {
        result.images.forEach((imageUrl, index) => {
            if (imageUrl) mediaData.push({ type: 'image', url: imageUrl, index });
        });
    }
    return mediaData;
}

async function downloadSingleFile(url: string, filename: string): Promise<string> {
    const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 60000,
        headers: { 'User-Agent': getRandomUserAgent(), 'Referer': 'https://www.tiktok.com/' }
    });
    const tempPath = path.join(tempDir, filename);
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => {
            if (fs.statSync(tempPath).size === 0) {
                try { fs.unlinkSync(tempPath); } catch (e) {}
                return reject(new Error('Downloaded file is empty'));
            }
            resolve(tempPath);
        });
        writer.on('error', (err) => {
            try { fs.unlinkSync(tempPath); } catch (e) {}
            reject(err);
        });
    });
}

async function downloadMediaFiles(mediaData: { type: 'video' | 'image', url: string, index: number }[], method = 'unknown'): Promise<{ path: string, type: 'video' | 'image', index: number }[]> {
    const downloadedFiles: { path: string, type: 'video' | 'image', index: number }[] = [];
    for (const media of mediaData) {
        const extension = media.type === 'video' ? 'mp4' : 'jpg';
        const filePath = await downloadSingleFile(media.url, `${method}_${Date.now()}_${media.type}_${media.index}.${extension}`);
        downloadedFiles.push({ path: filePath, type: media.type, index: media.index });
    }
    return downloadedFiles;
}

async function downloadWithTobyAPI(url: string, cookie: string) {
    const versions = ['v3', 'v1'];
    for (const version of versions) {
        try {
            const result = await tiktokdl.Downloader(url, { version, cookie });
            if (result.status === 'success' && result.result) {
                 const mediaData = await extractMediaData(result.result);
                if (mediaData.length === 0) continue; // Try next version if no media found
                return downloadMediaFiles(mediaData, `toby_api_${version}`);
            }
        } catch(e) {
             console.log(`Toby API ${version} failed: ${(e as Error).message}`);
        }
    }
    throw new Error('All Toby API versions failed');
}


async function downloadWithAlternativeAPI(url: string) {
    const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await axios.get(endpoint, {
        timeout: 15000,
        headers: { 'User-Agent': getRandomUserAgent(), 'Accept': 'application/json', 'Referer': 'https://tikwm.com/' }
    });
    if (response.data?.code === 0 && response.data.data) {
        const data = response.data.data;
        const mediaData: { type: 'video' | 'image', url: string, index: number }[] = [];
        if (data.play || data.wmplay) mediaData.push({ type: 'video', url: data.play || data.wmplay, index: 0 });
        if (data.images && Array.isArray(data.images)) {
            data.images.forEach((imageUrl: string, index: number) => mediaData.push({ type: 'image', url: imageUrl, index }));
        }
        if (mediaData.length > 0) return downloadMediaFiles(mediaData, 'alternative_api');
    }
    throw new Error('Alternative API failed');
}

async function downloadTikTokMedia(url: string) {
    const cookie = parseCookie(process.env.TIKTOK_COOKIE || '');
    
    const methods = [
        () => downloadWithTobyAPI(url, cookie), 
        () => downloadWithAlternativeAPI(url)
    ];

    for (const method of methods) {
        try {
            const result = await method();
            if (result && result.length > 0) return result;
        } catch (error: any) {
            console.log(`Download method failed: ${error.message}`);
        }
    }
    throw new Error('All download methods failed.');
}


async function getWatermarkBuffer(text: string, style: string): Promise<Buffer> {
    const svgPath = path.join(process.cwd(), 'src', 'assets', style);
    if (!fs.existsSync(svgPath)) {
        throw new Error(`Watermark style ${style} not found.`);
    }
    const svgTemplate = await fs.promises.readFile(svgPath, 'utf-8');
    const finalSvg = svgTemplate.replace(/TEXT_PLACEHOLDER/g, text);
    return Buffer.from(finalSvg);
}

async function addWatermarkToVideo(inputPath: string, outputPath: string, watermarkText: string, watermarkStyle: string): Promise<string> {
    await promisify(exec)('ffmpeg -version').catch(() => { throw new Error('FFmpeg not found! Please install FFmpeg.') });
    
    const svgBuffer = await getWatermarkBuffer(watermarkText, watermarkStyle);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    const watermarkPngPath = path.join(tempDir, `watermark_${Date.now()}.png`);
    await fs.promises.writeFile(watermarkPngPath, pngBuffer);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .input(watermarkPngPath)
            .complexFilter("[1:v]scale=iw*0.25:-1[wm];[0:v][wm]overlay=W-w-10:H-h-10")
            .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a copy'])
            .output(outputPath)
            .on('end', () => {
                try { fs.unlinkSync(watermarkPngPath); } catch (e) {}
                resolve(outputPath);
            })
            .on('error', (err) => {
                try { fs.unlinkSync(watermarkPngPath); } catch (e) {}
                reject(new Error(`FFmpeg error: ${err.message}`));
            })
            .run();
    });
}

async function addWatermarkToImage(inputPath: string, outputPath: string, watermarkText: string, watermarkStyle: string): Promise<string> {
    const imageBuffer = await fs.promises.readFile(inputPath);
    const svgBuffer = await getWatermarkBuffer(watermarkText, watermarkStyle);

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const imageWidth = metadata.width || 800;
    
    const watermarkResized = await sharp(svgBuffer)
        .resize({ width: Math.round(imageWidth * 0.3) })
        .toBuffer();

    await sharp(imageBuffer)
        .composite([{ input: watermarkResized, gravity: 'southeast', dx: 20, dy: 20 }])
        .jpeg({ quality: 90 })
        .toFile(outputPath);

    return outputPath;
}

async function processMediaFiles(mediaFiles: { path: string, type: 'video' | 'image', index: number }[], watermarkText: string, watermarkStyle: string) {
    const processedFiles: { path: string, type: 'video' | 'image', index: number, originalPath: string }[] = [];
    for (const mediaFile of mediaFiles) {
        const outputPath = path.join(tempDir, `watermarked_${path.basename(mediaFile.path)}`);
        try {
            if (mediaFile.type === 'video') {
                await addWatermarkToVideo(mediaFile.path, outputPath, watermarkText, watermarkStyle);
            } else {
                await addWatermarkToImage(mediaFile.path, outputPath, watermarkText, watermarkStyle);
            }
            processedFiles.push({ path: outputPath, type: mediaFile.type, index: mediaFile.index, originalPath: mediaFile.path });
        } catch (error) {
            console.error(`Failed to process ${mediaFile.type} at ${mediaFile.path}:`, error);
        }
    }
    return processedFiles;
}

export async function processTikTokUrl(url: string, watermarkText?: string, watermarkStyle?: string): Promise<{ path: string, originalPath: string, type: 'video' | 'image', caption: string }[]> {
    const mediaFiles = await downloadTikTokMedia(url);

    if (!watermarkText || !watermarkStyle) {
        return mediaFiles.map(file => ({
            path: file.path,
            originalPath: '',
            type: file.type,
            caption: mediaFiles.length > 1 ? `${file.type.toUpperCase()} ${file.index + 1}/${mediaFiles.length}` : `Downloaded ${file.type}`
        }));
    }
    
    const processedFiles = await processMediaFiles(mediaFiles, watermarkText, watermarkStyle);

    const results = processedFiles.map(file => ({
        path: file.path,
        originalPath: file.originalPath,
        type: file.type,
        caption: processedFiles.length > 1 ? `${file.type.toUpperCase()} ${file.index + 1}/${processedFiles.length}` : `Watermarked ${file.type}`
    }));

    processedFiles.forEach(file => {
         try {
            if (fs.existsSync(file.originalPath)) fs.unlinkSync(file.originalPath);
        } catch (e) {
            console.error(`Failed to clean up original file: ${(e as Error).message}`);
        }
    });

    return results;
}
