
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import tiktokdl from '@tobyg74/tiktok-api-dl';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type WatermarkPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
type ProgressCallback = (progress: { message: string, percentage?: number }) => Promise<void>;

const userAgents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const tempDir = path.join(os.tmpdir(), 'televerse-tiktok');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

let ffmpeg: FFmpeg | null = null;
async function getFFmpeg(onProgress?: ProgressCallback) {
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            // console.log(message); // Useful for debugging ffmpeg commands
        });
        await onProgress?.({ message: 'Loading video processor...' });
        await ffmpeg.load({
             coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
        });
        await onProgress?.({ message: 'Video processor loaded!' });
    }
    return ffmpeg;
}

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function parseCookie(cookieInput: string): string {
    if (!cookieInput) return '';
    if (cookieInput.includes('# Netscape HTTP Cookie File')) {
        return cookieInput.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
            return null;
        }).filter(Boolean).join('; ');
    }
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
        responseType: 'arraybuffer', // Fetch as buffer for ffmpeg
        timeout: 60000,
        headers: { 'User-Agent': getRandomUserAgent(), 'Referer': 'https://www.tiktok.com/' }
    });
    const tempPath = path.join(tempDir, filename);
    await fs.promises.writeFile(tempPath, response.data);
    return tempPath;
}

async function downloadMediaFiles(mediaData: { type: 'video' | 'image', url: string, index: number }[], onProgress?: ProgressCallback, method = 'unknown'): Promise<{ path: string, type: 'video' | 'image', index: number }[]> {
    const downloadedFiles: { path: string, type: 'video' | 'image', index: number }[] = [];
    for (const [i, media] of mediaData.entries()) {
        if(onProgress) await onProgress({ message: `Downloading file ${i + 1} of ${mediaData.length}...`});
        const extension = media.type === 'video' ? 'mp4' : 'jpg';
        const filePath = await downloadSingleFile(media.url, `${method}_${Date.now()}_${media.type}_${media.index}.${extension}`);
        downloadedFiles.push({ path: filePath, type: media.type, index: media.index });
    }
    return downloadedFiles;
}

async function downloadWithTobyAPI(url: string, cookie: string, onProgress?: ProgressCallback) {
    if(onProgress) await onProgress({ message: 'Attempting primary API...' });
    const versions = ['v3', 'v1'];
    for (const version of versions) {
        try {
            const result = await tiktokdl.Downloader(url, { version, cookie });
            if (result.status === 'success' && result.result) {
                 const mediaData = await extractMediaData(result.result);
                if (mediaData.length === 0) continue;
                return downloadMediaFiles(mediaData, onProgress, `toby_api_${version}`);
            }
        } catch(e) {
             console.log(`Toby API ${version} failed: ${(e as Error).message}`);
        }
    }
    throw new Error('All Toby API versions failed');
}


async function downloadWithAlternativeAPI(url: string, onProgress?: ProgressCallback) {
    if(onProgress) await onProgress({ message: 'Attempting fallback API...' });
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
            data.images.forEach((string: string, index: number) => mediaData.push({ type: 'image', url: string, index }));
        }
        if (mediaData.length > 0) return downloadMediaFiles(mediaData, onProgress, 'alternative_api');
    }
    throw new Error('Alternative API failed');
}

async function downloadTikTokMedia(url: string, onProgress?: ProgressCallback) {
    const cookie = parseCookie(process.env.TIKTOK_COOKIE || '');
    
    const methods = [
        () => downloadWithTobyAPI(url, cookie, onProgress), 
        () => downloadWithAlternativeAPI(url, onProgress)
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
    const devPath = path.join(process.cwd(), 'src/assets', style);
    if (!fs.existsSync(devPath)) {
        throw new Error(`Watermark style ${style} not found.`);
    }
    const svgTemplate = await fs.promises.readFile(devPath, 'utf-8');
    const finalSvg = svgTemplate.replace(/TEXT_PLACEHOLDER/g, text);
    // Cannot use sharp, must use ffmpeg for everything.
    // Instead of rendering SVG to PNG, we'll try to use the SVG directly if possible,
    // or find a pure JS way to convert it if needed.
    // For now, let's assume ffmpeg can handle SVG overlays if we write it to a file.
    const tempSvgPath = path.join(tempDir, `watermark_${Date.now()}.svg`);
    await fs.promises.writeFile(tempSvgPath, finalSvg);
    return fs.promises.readFile(tempSvgPath);
}

function getFfmpegOverlay(position: WatermarkPosition = 'bottom-right'): string {
    const margin = 10;
    switch(position) {
        case 'top-left': return `overlay=${margin}:${margin}`;
        case 'top-right': return `overlay=W-w-${margin}:${margin}`;
        case 'center': return `overlay=(W-w)/2:(H-h)/2`;
        case 'bottom-left': return `overlay=${margin}:H-h-${margin}`;
        case 'bottom-right':
        default:
             return `overlay=W-w-${margin}:H-h-${margin}`;
    }
}

async function addWatermarkToVideo(inputPath: string, outputPath: string, watermarkText: string, watermarkStyle: string, watermarkPosition: WatermarkPosition, onProgress?: ProgressCallback): Promise<string> {
    const ffmpeg = await getFFmpeg(onProgress);
    
    // We get a buffer, but it's an SVG buffer. Let's write it to a file ffmpeg can read.
    const svgBuffer = await getWatermarkBuffer(watermarkText, watermarkStyle);
    
    const inputFilename = `input_${path.basename(inputPath)}`;
    const watermarkFilename = `watermark_${Date.now()}.svg`;

    await ffmpeg.writeFile(inputFilename, await fetchFile(inputPath));
    await ffmpeg.writeFile(watermarkFilename, svgBuffer);
    
    const overlayCommand = getFfmpegOverlay(watermarkPosition);

    ffmpeg.on('progress', (progress) => {
        if (onProgress) {
            onProgress({ message: 'Applying watermark...', percentage: progress.progress * 100 });
        }
    });

    await ffmpeg.exec(['-i', inputFilename, '-i', watermarkFilename, '-filter_complex', `[1:v]scale=iw*0.25:-1[wm];[0:v][wm]${overlayCommand}`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'copy', 'output.mp4']);
    
    if(onProgress) await onProgress({ message: 'Watermark applied!', percentage: 100 });

    const data = await ffmpeg.readFile('output.mp4');
    await fs.promises.writeFile(outputPath, data as Uint8Array);

    // Cleanup files in wasm memory
    await ffmpeg.deleteFile(inputFilename);
    await ffmpeg.deleteFile(watermarkFilename);
    await ffmpeg.deleteFile('output.mp4');
    
    return outputPath;
}

async function processMediaFiles(mediaFiles: { path: string, type: 'video' | 'image', index: number }[], onProgress: ProgressCallback | undefined, watermarkText: string, watermarkStyle: string, watermarkPosition: WatermarkPosition) {
    const processedFiles: { path: string, type: 'video' | 'image', index: number, originalPath: string }[] = [];
    for (const [i, mediaFile] of mediaFiles.entries()) {
        const outputPath = path.join(tempDir, `watermarked_${path.basename(mediaFile.path)}`);
        
        const singleFileProgress: ProgressCallback | undefined = onProgress 
            ? async (progress) => {
                const baseMessage = `Processing file ${i + 1} of ${mediaFiles.length}`;
                await onProgress({ message: `${baseMessage}: ${progress.message}`, percentage: progress.percentage });
              }
            : undefined;

        try {
            if (mediaFile.type === 'video') {
                await addWatermarkToVideo(mediaFile.path, outputPath, watermarkText, watermarkStyle, watermarkPosition, singleFileProgress);
            } else {
                 if(onProgress) await onProgress({ message: `Skipping watermark for image ${i + 1}` });
                 await fs.promises.copyFile(mediaFile.path, outputPath);
            }
            processedFiles.push({ path: outputPath, type: mediaFile.type, index: mediaFile.index, originalPath: mediaFile.path });
        } catch (error) {
            console.error(`Failed to process ${mediaFile.type} at ${mediaFile.path}:`, error);
            throw error;
        }
    }
    return processedFiles;
}

export async function processTikTokUrl(url: string, onProgress?: ProgressCallback, watermarkText?: string, watermarkStyle?: string, watermarkPosition?: WatermarkPosition): Promise<{ path: string, originalPath: string, type: 'video' | 'image', caption: string }[]> {
    const mediaFiles = await downloadTikTokMedia(url, onProgress);
    if(onProgress) await onProgress({ message: 'Download complete.' });


    if (!watermarkText || !watermarkStyle || !watermarkPosition) {
        return mediaFiles.map(file => ({
            path: file.path,
            originalPath: '',
            type: file.type,
            caption: mediaFiles.length > 1 ? `${file.type.toUpperCase()} ${file.index + 1}/${mediaFiles.length}` : `Downloaded ${file.type}`
        }));
    }
    
    const processedFiles = await processMediaFiles(mediaFiles, onProgress, watermarkText, watermarkStyle, watermarkPosition);

    const results = processedFiles.map(file => ({
        path: file.path,
        originalPath: file.originalPath,
        type: file.type,
        caption: processedFiles.length > 1 ? `${file.type.toUpperCase()} ${file.index + 1}/${processedFiles.length}` : `Watermarked ${file.type}`
    }));

    // Clean up original downloaded files after successful watermarking.
    mediaFiles.forEach(file => {
         try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (e) {
            console.error(`Failed to clean up original downloaded file: ${(e as Error).message}`);
        }
    });

    return results;
}
