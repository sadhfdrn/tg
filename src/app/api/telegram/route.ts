import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { processTikTokUrl } from '@/services/tiktok';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --- In-memory stores for user state and data ---
// Store user's current conversational state (e.g., awaiting_preset_name)
const userStates = new Map<number, { state: string, data?: any }>();
// Store user's saved watermark presets
const userPresets = new Map<number, Map<string, string>>();
// Store user's last sent URL and the bot's message ID for editing
const userMessages = new Map<number, { lastUrl?: string, lastBotMessageId?: number }>();

// --- Helper Functions ---
async function apiRequest(method: string, payload: any) {
    try {
        const response = await axios.post(`${TELEGRAM_API_URL}/${method}`, payload);
        return response.data;
    } catch (error: any) {
        console.error(`Telegram API error on method ${method}:`, error.response?.data || error.message);
        return null;
    }
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
    return apiRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
    });
}

async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: any) {
    return apiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
    });
}

async function sendMedia(chatId: number, media: { path: string; type: 'video' | 'image'; caption: string }) {
    const url = media.type === 'video' ? `${TELEGRAM_API_URL}/sendVideo` : `${TELEGRAM_API_URL}/sendPhoto`;
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', media.caption);
    form.append(media.type, fs.createReadStream(media.path));
    try {
        await axios.post(url, form, { headers: form.getHeaders() });
    } finally {
        // Clean up the processed file
        try {
            if (fs.existsSync(media.path)) fs.unlinkSync(media.path);
        } catch (e) {
            console.error(`Failed to clean up processed file: ${(e as Error).message}`);
        }
    }
}

function getUserPresets(chatId: number): Map<string, string> {
    if (!userPresets.has(chatId)) {
        userPresets.set(chatId, new Map());
    }
    return userPresets.get(chatId)!;
}

function buildMainMenuKeyboard(chatId: number) {
    const presets = getUserPresets(chatId);
    const presetButtons = Array.from(presets.keys()).map(presetName => (
        [{ text: ` preset: ${presetName}`, callback_data: `preset:${presetName}` }]
    ));

    return {
        inline_keyboard: [
            [{ text: '🎶 Download (No Watermark)', callback_data: 'download_no_watermark' }],
            ...presetButtons,
            [{ text: '🎨 Create New Preset', callback_data: 'create_preset' }],
        ],
    };
}

// --- Main Handlers ---

async function handleStartCommand(chatId: number) {
    const welcomeText = "Welcome to TeleVerse!\n\nSend me a TikTok URL to get started, or create a custom watermark preset.";
    await sendMessage(chatId, welcomeText, {
        inline_keyboard: [
            [{ text: '🎨 Create New Preset', callback_data: 'create_preset' }],
        ]
    });
}

async function handleIncomingUrl(chatId: number, url: string) {
    const messageData = await sendMessage(chatId, "Processing URL...");
    if (messageData?.result?.message_id) {
        const messageId = messageData.result.message_id;
        userMessages.set(chatId, { lastUrl: url, lastBotMessageId: messageId });
        await editMessageText(chatId, messageId, "Choose an option for this TikTok:", buildMainMenuKeyboard(chatId));
    }
}

async function handleCallbackQuery(query: any) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const userInfo = userMessages.get(chatId);
    const url = userInfo?.lastUrl;

    if (data === 'create_preset') {
        userStates.set(chatId, { state: 'AWAITING_PRESET_NAME' });
        await editMessageText(chatId, messageId, "Please enter a name for your new preset (e.g., 'MyLogo').");
        return;
    }
    
    if (!url) {
        await editMessageText(chatId, messageId, "Sorry, I lost the URL. Please send it again.");
        return;
    }

    let watermarkText: string | undefined = undefined;

    if (data === 'download_no_watermark') {
        await editMessageText(chatId, messageId, "⏳ Downloading without watermark...");
    } else if (data.startsWith('preset:')) {
        const presetName = data.split(':')[1];
        const presets = getUserPresets(chatId);
        watermarkText = presets.get(presetName);
        if (!watermarkText) {
            await editMessageText(chatId, messageId, `Preset "${presetName}" not found. Please try again.`);
            return;
        }
        await editMessageText(chatId, messageId, `⏳ Downloading with preset "${presetName}"...`);
    } else {
         await editMessageText(chatId, messageId, `Unknown action. Please start over.`);
         return;
    }
    
    try {
        const processedMedia = await processTikTokUrl(url, watermarkText);

        if (processedMedia.length === 0) {
            await editMessageText(chatId, messageId, 'Could not process the TikTok video. It might be private, deleted, or the URL is invalid.');
            return;
        }

        await editMessageText(chatId, messageId, `✅ Found ${processedMedia.length} media file(s). Sending...`);

        for (const media of processedMedia) {
            try {
                await sendMedia(chatId, media);
            } catch (error: any) {
                console.error('Error sending media:', error.response?.data || error.message);
                await sendMessage(chatId, `❌ Failed to send one of the media files.`);
            } finally {
                 if (media.originalPath && fs.existsSync(media.originalPath)) {
                    fs.unlinkSync(media.originalPath);
                }
            }
        }
    } catch (error: any) {
        console.error('Error in processing flow:', error);
        await editMessageText(chatId, messageId, `❌ An error occurred: ${error.message}`);
    } finally {
        userMessages.delete(chatId);
    }
}

async function handleConversationalState(message: any) {
    const chatId = message.chat.id;
    const text = message.text;
    const userState = userStates.get(chatId);

    if (!userState) return false;

    if (userState.state === 'AWAITING_PRESET_NAME') {
        const presetName = text.trim();
        if (presetName.length > 20 || presetName.length < 1) {
            await sendMessage(chatId, "Preset name must be between 1 and 20 characters. Please try again.");
            return true;
        }
        userStates.set(chatId, { state: 'AWAITING_PRESET_TEXT', data: { presetName } });
        await sendMessage(chatId, `Great! Now, what text should the "${presetName}" watermark have?`);
        return true;
    }

    if (userState.state === 'AWAITING_PRESET_TEXT') {
        const watermarkText = text.trim();
        const presetName = userState.data.presetName;
        if (watermarkText.length > 30 || watermarkText.length < 1) {
            await sendMessage(chatId, "Watermark text must be between 1 and 30 characters. Please try again.");
            return true;
        }
        
        const presets = getUserPresets(chatId);
        presets.set(presetName, watermarkText);
        userPresets.set(chatId, presets);
        
        userStates.delete(chatId);
        await sendMessage(chatId, `✅ Preset "${presetName}" saved! You can now use it from the menu when you send a URL.`);
        return true;
    }

    return false;
}

export async function POST(request: Request) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
        return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log("Received update:", JSON.stringify(body, null, 2));

        if (body.callback_query) {
            await handleCallbackQuery(body.callback_query);
        } else if (body.message) {
            const message = body.message;
            const chatId = message.chat.id;
            const text = message.text || '';

            if (await handleConversationalState(message)) {
                return NextResponse.json({ status: 'ok' });
            }

            if (text.startsWith('/start')) {
                await handleStartCommand(chatId);
            } else if (text.match(/https?:\/\/(?:www\.)?tiktok\.com/)) {
                await handleIncomingUrl(chatId, text);
            } else {
                 await sendMessage(chatId, "I don't understand that. Please send a TikTok URL or use /start to see options.");
            }
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
    }

    return NextResponse.json({ status: 'ok' });
}
