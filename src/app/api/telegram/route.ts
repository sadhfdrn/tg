
import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { handleMessage } from '@/app/actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// We will store user states in memory for this example.
// In a production app, you'd want to use a database (e.g., Firestore, Redis).
interface UserState {
    step: 'idle' | 'awaiting_url' | 'awaiting_preset_name';
    lastUrl?: string;
    presets: Record<string, string>; // name -> watermark_text
}
const userStates: Record<string, UserState> = {};

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
    return axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text, reply_markup });
}

function getMainReplyKeyboard() {
    return {
        keyboard: [
            [{ text: '🎶 TikTok' }],
            [{ text: '🎨 Preset' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

function getPresetActionInlineKeyboard(state: UserState) {
    const presetButtons = Object.keys(state.presets).map(name => ({ text: name, callback_data: `preset_${name}` }));
    
    // Group presets into rows of 2
    const presetRows = [];
    for (let i = 0; i < presetButtons.length; i += 2) {
        presetRows.push(presetButtons.slice(i, i + 2));
    }
    
    return {
        inline_keyboard: [
            ...presetRows,
            [{ text: '➕ Create New Preset', callback_data: 'create_preset' }],
            [{ text: 'Cancel', callback_data: 'cancel' }]
        ]
    };
}


function getDownloadActionInlineKeyboard(state: UserState) {
    const presetButtons = Object.keys(state.presets).map(name => ({ text: name, callback_data: `download_preset_${name}` }));

    const presetRows = [];
    for (let i = 0; i < presetButtons.length; i += 2) {
        presetRows.push(presetButtons.slice(i, i + 2));
    }

    return {
        inline_keyboard: [
            [{ text: 'Download (No Watermark)', callback_data: 'download_no_wm' }],
            ...presetRows,
            [{ text: 'Cancel', callback_data: 'cancel' }]
        ]
    };
}


async function processIncomingMessage(chatId: string, text: string) {
    const state = getUserState(chatId);

    // If user sends a command, cancel any pending action
    if (text.startsWith('/')) {
        if (state.step !== 'idle') {
            state.step = 'idle';
            state.lastUrl = undefined;
            await sendMessage(chatId, "Action cancelled.");
        }
    }
    
    // --- State-based handling ---
    if (state.step === 'awaiting_preset_name') {
        const presetName = text;
        if (state.presets[presetName]) {
             await sendMessage(chatId, `A preset named "${presetName}" already exists. Please choose a different name.`);
             return;
        }
        // For simplicity, we'll use the preset name as the watermark text.
        // A more complex bot could ask for the text separately.
        state.presets[presetName] = presetName; 
        state.step = 'idle';
        await sendMessage(chatId, `✅ Preset "${presetName}" saved!`, getMainReplyKeyboard());
        return;
    }

    if (state.step === 'awaiting_url') {
        if (text.includes('tiktok.com')) {
            state.lastUrl = text;
            state.step = 'idle';
            await sendMessage(chatId, 'Got it! What would you like to do?', getDownloadActionInlineKeyboard(state));
        } else {
            await sendMessage(chatId, 'That does not look like a TikTok URL. Please send a valid link.');
        }
        return;
    }
    
    // --- Command and button handling ---
    if (text === '/start') {
        await sendMessage(chatId, 'Welcome! Send me a TikTok URL to get started, or use the keyboard below.', getMainReplyKeyboard());
        return;
    }
    
    if (text === '🎶 TikTok') {
        state.step = 'awaiting_url';
        await sendMessage(chatId, 'Please send me the TikTok URL you want to download.', { remove_keyboard: true });
        return;
    }

    if (text === '🎨 Preset') {
        await sendMessage(chatId, 'Manage your watermark presets:', getPresetActionInlineKeyboard(state));
        return;
    }
    
    // Default URL handling
    if (text.includes('tiktok.com')) {
        state.lastUrl = text;
        await sendMessage(chatId, 'Got it! What would you like to do?', getDownloadActionInlineKeyboard(state));
        return;
    }

    // Fallback for any other text
    await sendMessage(chatId, "I'm not sure what you mean. Please send a TikTok URL or use the command buttons.", getMainReplyKeyboard());
}

async function processCallbackQuery(chatId: string, data: string) {
    const state = getUserState(chatId);

    if (data === 'cancel') {
        state.step = 'idle';
        state.lastUrl = undefined;
        return { text: "Action cancelled.", action: 'delete_message' };
    }
    
    // --- Preset management callbacks ---
    if (data === 'create_preset') {
        state.step = 'awaiting_preset_name';
        return { text: "What would you like to name your new preset?", action: 'edit_message' };
    }
    
    if (data.startsWith('preset_')) {
        const presetName = data.replace('preset_', '');
        // In a real app, you might add options to delete or edit.
        return { text: `You selected the preset "${presetName}".`, action: 'answer_query' };
    }

    // --- Download action callbacks ---
    if (data === 'download_no_wm') {
        if (!state.lastUrl) return { text: "Sorry, I lost the URL. Please send it again.", action: 'edit_message' };
        await sendMessage(chatId, "Processing your video without a watermark...", getMainReplyKeyboard());
        return { url: state.lastUrl, watermark: undefined, action: 'process_media' };
    }
    
    if (data.startsWith('download_preset_')) {
        const presetName = data.replace('download_preset_', '');
        const watermarkText = state.presets[presetName];
        if (!state.lastUrl || !watermarkText) {
             return { text: "Sorry, something went wrong. Please try again.", action: 'edit_message' };
        }
        await sendMessage(chatId, `Processing with the "${presetName}" watermark...`, getMainReplyKeyboard());
        return { url: state.lastUrl, watermark: watermarkText, action: 'process_media' };
    }

    return { text: "Unknown action", action: 'answer_query' };
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

        } else if (body.callback_query) {
            const chatId = body.callback_query.message.chat.id.toString();
            const messageId = body.callback_query.message.message_id;
            const data = body.callback_query.data;
            
            // Acknowledge the button press immediately
            await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, { callback_query_id: body.callback_query.id });

            const result = await processCallbackQuery(chatId, data);
            
            if (result.action === 'edit_message') {
                 await axios.post(`${TELEGRAM_API_URL}/editMessageText`, { chat_id: chatId, message_id: messageId, text: result.text });
            }
            if (result.action === 'delete_message') {
                await axios.post(`${TELEGRAM_API_URL}/deleteMessage`, { chat_id: chatId, message_id: messageId });
                await sendMessage(chatId, result.text, getMainReplyKeyboard());
            }
            if (result.action === 'process_media' && result.url) {
                // Delete the inline keyboard message
                await axios.post(`${TELEGRAM_API_URL}/deleteMessage`, { chat_id: chatId, message_id: messageId });

                const response = await handleMessage(`/tiktok-wm ${result.url} ${result.watermark || ''}`.trim());
                
                if (response.text) {
                     await sendMessage(chatId, response.text, getMainReplyKeyboard());
                }
                if (response.media && response.media.length > 0) {
                    for (const item of response.media) {
                        const form = new FormData();
                        form.append('chat_id', String(chatId));

                        const base64Data = item.url.split(';base64,').pop();
                        if (!base64Data) continue;

                        const fileBuffer = Buffer.from(base64Data, 'base64');
                        const fileName = item.type === 'video' ? 'video.mp4' : 'image.jpg';

                        if (item.type === 'video') {
                            form.append('video', fileBuffer, { filename: fileName });
                            if (item.caption) form.append('caption', item.caption);
                            await axios.post(`${TELEGRAM_API_URL}/sendVideo`, form, { headers: form.getHeaders() });
                        } else {
                            form.append('photo', fileBuffer, { filename: fileName });
                            if (item.caption) form.append('caption', item.caption);
                            await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, form, { headers: form.getHeaders() });
                        }
                    }
                }
                const state = getUserState(chatId);
                state.step = 'idle';
                state.lastUrl = undefined;
            }
        } else {
             console.log("Update is not a standard text message or callback, skipping.");
        }

    } catch (error: any) {
        console.error("Error processing webhook:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
