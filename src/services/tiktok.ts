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

const defaultWatermark = {
    text: 'Samuel',
    font: 'Arial',
    fontSize: 24,
    color: 'white',
    opacity: 0.48,
    position: 'bottom-right',
};

const tempDir = path.join(os.tmpdir(), 'televerse-tiktok');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function checkDependencies() {
    try {
        await promisify(exec)('ffmpeg -version');
    } catch (error) {
        console.error('FFmpeg not found! Please install FFmpeg.');
        throw new Error('Required dependency FFmpeg is not installed on the server.');
    }
    try {
        require('sharp');
    } catch (error) {
        console.error('Sharp not found! Please run `npm install sharp`');
        throw new Error('Required dependency Sharp is not installed on the server.');
    }
}
checkDependencies();

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function extractVideoId(url: string) {
    const patterns = [
        /\/video\/(\d+)/,
        /\/v\/(\d+)/,
        /tiktok\.com\/.*\/video\/(\d+)/,
        /vm\.tiktok\.com\/(\w+)/,
        /vt\.tiktok\.com\/(\w+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
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

async function extractMediaData(result: any) {
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

async function downloadSingleFile(url: string, filename: string) {
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
                fs.unlinkSync(tempPath);
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

async function downloadMediaFiles(mediaData: { type: 'video' | 'image', url: string, index: number }[], method = 'unknown') {
    const downloadedFiles: { path: string, type: 'video' | 'image', index: number }[] = [];
    for (const media of mediaData) {
        const extension = media.type === 'video' ? 'mp4' : 'jpg';
        const filePath = await downloadSingleFile(media.url, `${method}_${media.type}_${media.index}.${extension}`);
        downloadedFiles.push({ path: filePath, type: media.type, index: media.index });
    }
    return downloadedFiles;
}

async function downloadWithTobyAPI(url: string) {
    const result = await tiktokdl.Downloader(url, { version: "v3" }).catch(() => tiktokdl.Downloader(url, { version: "v1" }));
    if (result.status !== 'success') throw new Error(result.message || 'API returned unsuccessful status');
    const mediaData = await extractMediaData(result.result);
    if (mediaData.length === 0) throw new Error('No media found in API response');
    return downloadMediaFiles(mediaData, 'toby_api');
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
    const methods = [() => downloadWithTobyAPI(url), () => downloadWithAlternativeAPI(url)];
    for (const method of methods) {
        try {
            return await method();
        } catch (error: any) {
            console.log(`Download method failed: ${error.message}`);
        }
    }
    throw new Error('All download methods failed.');
}

function generateWatermarkFilter(settings: typeof defaultWatermark) {
    const { text, fontSize, color, opacity, position } = settings;
    const positions: { [key: string]: string } = {
        'top-left': 'x=50:y=50', 'top-right': 'x=W-tw-50:y=50',
        'bottom-left': 'x=50:y=H-th-50', 'bottom-right': 'x=W-tw-50:y=H-th-50',
        'center': 'x=(W-tw)/2:y=(H-th)/2'
    };
    const pos = positions[position] || positions['bottom-right'];
    return `drawtext=text='${text.replace(/'/g, `''`)}':fontsize=${fontSize}:fontcolor=${color}@${opacity}:${pos}:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
}

async function addWatermarkToVideo(inputPath: string, outputPath: string, watermarkSettings: typeof defaultWatermark) {
    return new Promise((resolve, reject) => {
        const filter = generateWatermarkFilter(watermarkSettings);
        ffmpeg(inputPath)
            .videoFilter(filter)
            .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a copy'])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
            .run();
    });
}

async function addWatermarkToImage(inputPath: string, outputPath: string, watermarkSettings: typeof defaultWatermark) {
    const { text, fontSize, color, opacity, position } = watermarkSettings;
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Could not read image metadata.");
    
    const textWidth = text.length * (fontSize * 0.6);
    const textHeight = fontSize;
    let gravity;
    switch(position) {
        case 'top-left': gravity = 'northwest'; break;
        case 'top-right': gravity = 'northeast'; break;
        case 'bottom-left': gravity = 'southwest'; break;
        case 'center': gravity = 'center'; break;
        default: gravity = 'southeast';
    }

    const watermarkSvg = `<svg><text x="0" y="${textHeight}" font-family="Arial" font-size="${fontSize}" fill="${color}" fill-opacity="${opacity}">${text}</text></svg>`;
    
    await image
        .composite([{ input: Buffer.from(watermarkSvg), gravity }])
        .jpeg({ quality: 90 })
        .toFile(outputPath);

    return outputPath;
}

async function processMediaFiles(mediaFiles: { path: string, type: 'video' | 'image', index: number }[], watermarkSettings: typeof defaultWatermark) {
    const processedFiles: { path: string, type: 'video' | 'image', index: number, originalPath: string }[] = [];
    for (const mediaFile of mediaFiles) {
        const outputPath = path.join(path.dirname(mediaFile.path), `watermarked_${path.basename(mediaFile.path)}`);
        if (mediaFile.type === 'video') {
            await addWatermarkToVideo(mediaFile.path, outputPath, watermarkSettings);
        } else {
            await addWatermarkToImage(mediaFile.path, outputPath, watermarkSettings);
        }
        processedFiles.push({ path: outputPath, type: mediaFile.type, index: mediaFile.index, originalPath: mediaFile.path });
    }
    return processedFiles;
}

export async function processTikTokUrl(url: string) {
    const mediaFiles = await downloadTikTokMedia(url);
    const processedFiles = await processMediaFiles(mediaFiles, defaultWatermark);

    const results = [];
    for (const file of processedFiles) {
        const fileBuffer = fs.readFileSync(file.path);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = file.type === 'video' ? 'video/mp4' : 'image/jpeg';
        const caption = processedFiles.length > 1 ? `${file.type.toUpperCase()} ${file.index + 1}/${processedFiles.length}` : `Watermarked ${file.type}`;
        
        results.push({
            type: file.type,
            url: `data:${mimeType};base64,${base64Data}`,
            caption
        });
    }

    // Cleanup
    [...mediaFiles, ...processedFiles].forEach(file => {
        try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            if ('originalPath' in file && fs.existsSync(file.originalPath)) {
                fs.unlinkSync(file.originalPath);
            }
        } catch (e) {
            console.error(`Failed to clean up file: ${(e as Error).message}`);
        }
    });

    return results;
}
