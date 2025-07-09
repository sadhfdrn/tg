
import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { handleMessage } from '@/app/actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// We will store user states in memory for this example.
// In a production app, this would be in a database.
interface UserState {
    step: 'idle' | 'awaiting_url' | 'awaiting_download_option' | 'awaiting_preset_name' | 'awaiting_preset_text' | 'awaiting_preset_style';
    urlBuffer?: string;
    presetNameBuffer?: string;
    presetStyleBuffer?: string;
    presets: Record<string, { text: string; style: string }>; // { presetName: { text: 'watermark', style: 'style1.svg' } }
}

const userStates: Record<string, UserState> = {};

// Available watermark styles
const WATERMARK_STYLES = ['style1.svg', 'style2.svg', 'style3.svg', 'style4.svg', 'style5.svg'];

function getUserState(chatId: string): UserState {
    if (!userStates[chatId]) {
        userStates[chatId] = { step: 'idle', presets: {} };
    }
    return userStates[chatId];
}

async function sendTypingAction(chatId: string | number) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/sendChatAction`, { chat_id: chatId, action: 'typing' });
    } catch (e) {
        console.error("Failed to send typing action:", e);
    }
}

async function sendMessage(chatId: string | number, text: string, reply_markup?: any) {
    await sendTypingAction(chatId);
    return axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup });
}

// --- Keyboards ---

function getMainMenuKeyboard() {
    return {
        keyboard: [
            [{ text: '⬇️ Download Video' }],
            [{ text: '🎨 Manage Presets' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

function getCancelKeyboard() {
    return {
        keyboard: [[{ text: '❌ Cancel' }]],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

function getDownloadOptionsKeyboard(state: UserState) {
    const presetButtons = Object.keys(state.presets).map(name => ({ text: `Preset: ${name}` }));
    
    // Group presets into rows of 2
    const presetRows = [];
    for (let i = 0; i < presetButtons.length; i += 2) {
        presetRows.push(presetButtons.slice(i, i + 2));
    }

    return {
        keyboard: [
            [{ text: '💧 No Watermark' }],
            ...presetRows,
            [{ text: '❌ Cancel' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

function getPresetManagementKeyboard() {
     return {
        keyboard: [
            [{ text: '➕ Create Preset' }, { text: '🗑️ Delete Preset' }],
            [{ text: '🔙 Back to Main Menu' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
}

function getStyleSelectionKeyboard() {
    const styleButtons = WATERMARK_STYLES.map(style => ({ text: style }));
    const styleRows = [];
    for (let i = 0; i < styleButtons.length; i += 2) {
        styleRows.push(styleButtons.slice(i, i + 2));
    }
    return {
        keyboard: [
            ...styleRows,
            [{ text: '❌ Cancel' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
}


async function processIncomingMessage(chatId: string, text: string) {
    const state = getUserState(chatId);
    const trimmedText = text.trim();

    // --- Universal Cancel / Back ---
    if (trimmedText === '❌ Cancel' || trimmedText === '🔙 Back to Main Menu') {
        state.step = 'idle';
        state.urlBuffer = undefined;
        state.presetNameBuffer = undefined;
        state.presetStyleBuffer = undefined;
        await sendMessage(chatId, "Action cancelled. What would you like to do?", getMainMenuKeyboard());
        return;
    }

    // --- State Machine ---
    switch(state.step) {
        case 'awaiting_url':
            if (trimmedText.includes('tiktok.com')) {
                state.urlBuffer = trimmedText;
                state.step = 'awaiting_download_option';
                await sendMessage(chatId, "Got it! How do you want to download this video?", getDownloadOptionsKeyboard(state));
            } else {
                await sendMessage(chatId, "That doesn't look like a valid TikTok URL. Please try again or cancel.", getCancelKeyboard());
            }
            return;

        case 'awaiting_download_option':
            if (trimmedText === '💧 No Watermark') {
                if (!state.urlBuffer) {
                    await sendMessage(chatId, "I don't have a URL to download. Please start again.", getMainMenuKeyboard());
                    return;
                }
                await sendMessage(chatId, "Processing your video without a watermark...", getMainMenuKeyboard());
                await processAndSendMedia(chatId, state.urlBuffer);
                state.urlBuffer = undefined;
                state.step = 'idle';
            } else if (trimmedText.startsWith('Preset:')) {
                const presetName = trimmedText.replace('Preset:', '').trim();
                const preset = state.presets[presetName];
                if (!state.urlBuffer || !preset) {
                    await sendMessage(chatId, "Something went wrong. I couldn't find that preset or the URL. Please start again.", getMainMenuKeyboard());
                    return;
                }
                await sendMessage(chatId, `Processing with the "${presetName}" preset...`, getMainMenuKeyboard());
                await processAndSendMedia(chatId, state.urlBuffer, preset.text, preset.style);
                state.urlBuffer = undefined;
                state.step = 'idle';
            } else {
                await sendMessage(chatId, "Invalid option. Please choose from the keyboard.", getDownloadOptionsKeyboard(state));
            }
            return;

        case 'awaiting_preset_name':
            if (state.presets[trimmedText]) {
                await sendMessage(chatId, `A preset named "${trimmedText}" already exists. Please choose a different name.`, getCancelKeyboard());
                return;
            }
            state.presetNameBuffer = trimmedText;
            state.step = 'awaiting_preset_style';
            await sendMessage(chatId, `Great! Now, choose a watermark style for the "${trimmedText}" preset.`, getStyleSelectionKeyboard());
            return;

        case 'awaiting_preset_style':
            if (!WATERMARK_STYLES.includes(trimmedText)) {
                await sendMessage(chatId, 'Invalid style. Please select one of the options from the keyboard.', getStyleSelectionKeyboard());
                return;
            }
            state.presetStyleBuffer = trimmedText;
            state.step = 'awaiting_preset_text';
            await sendMessage(chatId, `Style selected! Now, what text should this watermark have?`, getCancelKeyboard());
            return;

        case 'awaiting_preset_text':
            const presetName = state.presetNameBuffer;
            const presetStyle = state.presetStyleBuffer;
            const presetText = trimmedText;

            if (!presetName || !presetStyle) {
                 state.step = 'idle';
                 await sendMessage(chatId, 'Something went wrong, please start over.', getMainMenuKeyboard());
                 return;
            }
            state.presets[presetName] = { text: presetText, style: presetStyle };
            state.step = 'idle';
            state.presetNameBuffer = undefined;
            state.presetStyleBuffer = undefined;
            await sendMessage(chatId, `✅ Preset "${presetName}" saved!`, getMainMenuKeyboard());
            return;
    }


    // --- Idle State Command/Button Handling ---
    if (trimmedText === '/start') {
        await sendMessage(chatId, 'Welcome! Use the menu below to get started.', getMainMenuKeyboard());
        return;
    }

    if (trimmedText === '⬇️ Download Video') {
        state.step = 'awaiting_url';
        await sendMessage(chatId, "Please send me the TikTok URL.", getCancelKeyboard());
        return;
    }
    
    if (trimmedText === '🎨 Manage Presets') {
        await sendMessage(chatId, "Here you can create or delete presets.", getPresetManagementKeyboard());
        return;
    }

    if (trimmedText === '➕ Create Preset') {
        state.step = 'awaiting_preset_name';
        await sendMessage(chatId, 'What would you like to name your new preset?', getCancelKeyboard());
        return;
    }
    
    // Fallback for any other text in idle state
    if (trimmedText.includes('tiktok.com')) {
        state.urlBuffer = trimmedText;
        state.step = 'awaiting_download_option';
        await sendMessage(chatId, "Got it! How do you want to download this video?", getDownloadOptionsKeyboard(state));
    } else {
        await sendMessage(chatId, "I'm not sure what to do with that. Please use the menu below.", getMainMenuKeyboard());
    }
}

async function processAndSendMedia(chatId: string, url: string, watermarkText?: string, watermarkStyle?: string) {
    const state = getUserState(chatId);
    state.step = 'idle'; // Reset state after processing
    
    let command = '/tiktok';
    if(watermarkText && watermarkStyle) {
        command = `/tiktok-wm ${url} ${watermarkStyle} ${watermarkText}`;
    } else {
        command = `/tiktok ${url}`;
    }

    try {
        const response = await handleMessage(command);

        if (response.text && (!response.media || response.media.length === 0)) {
            await sendMessage(chatId, response.text, getMainMenuKeyboard());
        }

        if (response.media && response.media.length > 0) {
            await sendMessage(chatId, `Found ${response.media.length} media file(s). Sending now...`, getMainMenuKeyboard());
            for (const item of response.media) {
                const form = new FormData();
                form.append('chat_id', String(chatId));

                const base64Data = item.url.split(';base64,').pop();
                if (!base64Data) continue;

                const fileBuffer = Buffer.from(base64Data, 'base64');
                const fileName = item.type === 'video' ? 'video.mp4' : 'image.jpg';
                const fileOptions = { filename: fileName, contentType: item.type === 'video' ? 'video/mp4' : 'image/jpeg' };

                if (item.type === 'video') {
                    form.append('video', fileBuffer, fileOptions);
                    if (item.caption) form.append('caption', item.caption);
                    await axios.post(`${TELEGRAM_API_URL}/sendVideo`, form, { headers: form.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity });
                } else {
                    form.append('photo', fileBuffer, fileOptions);
                    if (item.caption) form.append('caption', item.caption);
                    await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, form, { headers: form.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity });
                }
            }
        }
    } catch(error: any) {
        console.error("Error processing and sending media:", error);
         if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
            await sendMessage(chatId, `Failed to send media: ${error.response.data.description}`, getMainMenuKeyboard());
        } else {
            await sendMessage(chatId, "An unexpected error occurred while sending your file. It might be too large.", getMainMenuKeyboard());
        }
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

        if (body.message && body.message.chat && body.message.text) {
            const chatId = body.message.chat.id.toString();
            const incomingText = body.message.text;
            await processIncomingMessage(chatId, incomingText);
        } else {
             console.log("Update is not a standard text message, skipping.");
        }

    } catch (error: any) {
        console.error("Error processing webhook:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
