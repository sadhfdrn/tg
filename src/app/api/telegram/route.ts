import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { processTikTokUrl } from '@/services/tiktok';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: number, text: string) {
    return axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
    });
}

async function sendMedia(chatId: number, media: { path: string; type: 'video' | 'image'; caption: string }) {
    const url = media.type === 'video' ? `${TELEGRAM_API_URL}/sendVideo` : `${TELEGRAM_API_URL}/sendPhoto`;
    
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', media.caption);
    form.append(media.type, fs.createReadStream(media.path));

    try {
        await axios.post(url, form, {
            headers: form.getHeaders(),
        });
    } finally {
        // Clean up the processed file
        try {
            if (fs.existsSync(media.path)) {
                fs.unlinkSync(media.path);
            }
        } catch (e) {
            console.error(`Failed to clean up processed file: ${(e as Error).message}`);
        }
    }
}

async function handleTikTokCommand(chatId: number, args: string[]) {
    if (!args[0]) {
        await sendMessage(chatId, 'Please provide a TikTok URL.\nUsage: `/tiktok <url>`');
        return;
    }

    const url = args[0];
    await sendMessage(chatId, '⏳ Downloading and processing TikTok media...');

    try {
        const processedMedia = await processTikTokUrl(url);

        if (processedMedia.length === 0) {
            await sendMessage(chatId, 'Could not process the TikTok video. It might be private, deleted, or the URL is invalid.');
            return;
        }
        
        await sendMessage(chatId, `🎨 Found ${processedMedia.length} media file(s). Applying watermark and sending...`);

        for (const media of processedMedia) {
            try {
                await sendMedia(chatId, media);
            } catch (error: any) {
                console.error('Error sending media:', error.response?.data || error.message);
                await sendMessage(chatId, `❌ Failed to send one of the media files. Error: ${error.response?.data?.description || error.message}`);
            }
        }
    } catch (error: any) {
        console.error('Error in handleTikTokCommand:', error);
        await sendMessage(chatId, `❌ An error occurred: ${error.message}`);
    }
}


export async function POST(request: Request) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
        return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log("Received update:", JSON.stringify(body, null, 2));

        if (body.message) {
            const message = body.message;
            const chatId = message.chat.id;
            const text = message.text || '';

            if (text.startsWith('/')) {
                const [command, ...args] = text.split(' ');

                switch (command) {
                    case '/start':
                        await sendMessage(chatId, 'Welcome to TeleVerse! Use `/tiktok <url>` to download a video or image gallery with a watermark.');
                        break;
                    case '/tiktok':
                        await handleTikTokCommand(chatId, args);
                        break;
                    default:
                        await sendMessage(chatId, "I don't recognize that command. Try `/tiktok`.");
                        break;
                }
            }
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
    }

    return NextResponse.json({ status: 'ok' });
}
