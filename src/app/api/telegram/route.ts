
import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { handleMessage } from '@/app/actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// We will store user states in memory for this example.
// In a production app, this would be in a database.
type WatermarkPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

interface UserState {
    step: 'idle' | 'awaiting_main_menu_choice' | 'awaiting_url' | 'awaiting_download_option' | 'awaiting_preset_management_action' | 'awaiting_preset_name' | 'awaiting_preset_text' | 'awaiting_preset_style' | 'awaiting_preset_position' | 'awaiting_preset_to_delete';
    urlBuffer?: string;
    presetNameBuffer?: string;
    presetStyleBuffer?: string;
    presetPositionBuffer?: WatermarkPosition;
    presets: Record<string, { text: string; style: string; position: WatermarkPosition }>;
}

const userStates: Record<string, UserState> = {};

// Available watermark styles
const WATERMARK_STYLES = ['style1.svg', 'style2.svg', 'style3.svg', 'style4.svg', 'style5.svg'];
const WATERMARK_POSITIONS: Record<string, WatermarkPosition> = {
    '↖️ Top Left': 'top-left',
    '↗️ Top Right': 'top-right',
    '⏺️ Center': 'center',
    '↙️ Bottom Left': 'bottom-left',
    '↘️ Bottom Right': 'bottom-right',
}

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

async function sendMessage(chatId: string | number, text: string, reply_markup?: any): Promise<number | null> {
    await sendTypingAction(chatId);
    try {
        const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup });
        if (response.data.ok && response.data.result) {
            return response.data.result.message_id;
        }
    } catch (error) {
        console.error('Failed to send message:', error);
    }
    return null;
}

async function editMessage(chatId: string | number, messageId: number, text: string) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        // Don't log "message is not modified" errors, as they are common and not critical.
        const errorResponse = (error as any).response?.data?.description;
        if (!errorResponse || !errorResponse.includes('message is not modified')) {
            console.error('Failed to edit message:', errorResponse || (error as Error).message);
        }
    }
}

async function deleteMessage(chatId: string | number, messageId: number) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/deleteMessage`, {
            chat_id: chatId,
            message_id: messageId,
        });
    } catch (error) {
        console.error('Failed to delete message:', error);
    }
}

// --- Keyboards ---

function getMainMenuKeyboard() {
    return {
        keyboard: [
            [{ text: '🎶 TikTok' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
}

function getTikTokMenuKeyboard() {
    return {
         keyboard: [
            [{ text: '📥 Download Video' }, { text: '🎨 Manage Presets' }],
            [{ text: '🔙 Back to Main Menu'}]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
}

function getManagePresetsKeyboard() {
    return {
        keyboard: [
            [{ text: '➕ Create Preset' }, { text: '🗑️ Delete Preset' }],
            [{ text: '🔙 Back to Main Menu' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
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
    const presetButtons = Object.keys(state.presets).map(name => ({ text: name }));
    
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

function getWatermarkPositionKeyboard() {
    const positionButtons = Object.keys(WATERMARK_POSITIONS).map(p => ({ text: p }));
    const positionRows = [
        positionButtons.slice(0, 2),
        [positionButtons[2]],
        positionButtons.slice(3, 5),
    ];
    return {
         keyboard: [
            ...positionRows,
            [{ text: '❌ Cancel' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
}

function getDeletePresetKeyboard(state: UserState) {
    const presetButtons = Object.keys(state.presets).map(name => ({ text: `Delete: ${name}` }));

    const presetRows = [];
    for (let i = 0; i < presetButtons.length; i += 2) {
        presetRows.push(presetButtons.slice(i, i + 2));
    }

    return {
        keyboard: [
            ...presetRows,
            [{ text: '❌ Cancel' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
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
        state.presetPositionBuffer = undefined;
        await sendMessage(chatId, "Action cancelled. Returning to the main menu.", getMainMenuKeyboard());
        return;
    }

    // --- State Machine ---
    switch(state.step) {
        case 'awaiting_url':
            if (trimmedText.includes('tiktok.com')) {
                state.urlBuffer = trimmedText;
                state.step = 'awaiting_download_option';
                await sendMessage(chatId, "Got it! How do you want to download this video? You can select one of your presets or download without a watermark.", getDownloadOptionsKeyboard(state));
            } else {
                await sendMessage(chatId, "That doesn't look like a valid TikTok URL. Please try again or cancel.", getCancelKeyboard());
            }
            return;
        
        case 'awaiting_main_menu_choice':
             if (trimmedText === '📥 Download Video') {
                state.step = 'awaiting_url';
                await sendMessage(chatId, "Please send me the TikTok URL you'd like to download.", getCancelKeyboard());
            } else if (trimmedText === '🎨 Manage Presets') {
                state.step = 'awaiting_preset_management_action';
                const presetNames = Object.keys(state.presets);
                let message = "You can create a new preset or delete an existing one.\n";
                if (presetNames.length > 0) {
                    message += `\nYour current presets:\n- ${presetNames.join('\n- ')}`;
                } else {
                    message += "\nYou don't have any presets saved yet.";
                }
                await sendMessage(chatId, message, getManagePresetsKeyboard());
            } else {
                await sendMessage(chatId, 'Please choose an option from the keyboard.', getTikTokMenuKeyboard());
            }
            return;


        case 'awaiting_download_option':
            const preset = state.presets[trimmedText];
            if (!state.urlBuffer) {
                // This case should ideally not be hit if the flow is correct
                await sendMessage(chatId, "Something went wrong, I seem to have lost the URL. Please start over.", getMainMenuKeyboard());
                state.step = 'idle';
                return;
            }
            if (trimmedText === '💧 No Watermark') {
                await processAndSendMedia(chatId, state.urlBuffer);
                state.urlBuffer = undefined;
                state.step = 'idle';
            } else if (preset) {
                await processAndSendMedia(chatId, state.urlBuffer, preset.text, preset.style, preset.position);
                state.urlBuffer = undefined;
                state.step = 'idle';
            } else {
                await sendMessage(chatId, "Invalid option. Please choose a download option from the keyboard.", getDownloadOptionsKeyboard(state));
            }
            return;

        case 'awaiting_preset_management_action':
            if (trimmedText === '➕ Create Preset') {
                state.step = 'awaiting_preset_name';
                await sendMessage(chatId, 'What would you like to name your new preset?', getCancelKeyboard());
            } else if (trimmedText === '🗑️ Delete Preset') {
                const presetNames = Object.keys(state.presets);
                if (presetNames.length === 0) {
                     await sendMessage(chatId, "You don't have any presets to delete.", getManagePresetsKeyboard());
                     state.step = 'awaiting_main_menu_choice';
                } else {
                    state.step = 'awaiting_preset_to_delete';
                    await sendMessage(chatId, 'Which preset would you like to delete?', getDeletePresetKeyboard(state));
                }
            } else {
                await sendMessage(chatId, 'Please choose an option from the keyboard.', getManagePresetsKeyboard());
            }
            return;

        case 'awaiting_preset_to_delete':
            if (trimmedText.startsWith('Delete: ')) {
                const presetNameToDelete = trimmedText.substring(8); // Length of "Delete: "
                if (state.presets[presetNameToDelete]) {
                    delete state.presets[presetNameToDelete];
                    state.step = 'idle';
                    await sendMessage(chatId, `✅ Preset "${presetNameToDelete}" has been deleted.`, getMainMenuKeyboard());
                } else {
                    await sendMessage(chatId, `Preset "${presetNameToDelete}" not found. Please choose a preset to delete from the keyboard.`, getDeletePresetKeyboard(state));
                }
            } else {
                 await sendMessage(chatId, 'Invalid selection. Please choose a preset to delete from the keyboard.', getDeletePresetKeyboard(state));
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
            state.step = 'awaiting_preset_position';
            await sendMessage(chatId, `Style selected! Now pick a position for the watermark.`, getWatermarkPositionKeyboard());
            return;

        case 'awaiting_preset_position':
            const position = WATERMARK_POSITIONS[trimmedText];
            if (!position) {
                 await sendMessage(chatId, 'Invalid position. Please select one of the options from the keyboard.', getWatermarkPositionKeyboard());
                return;
            }
            state.presetPositionBuffer = position;
            state.step = 'awaiting_preset_text';
            await sendMessage(chatId, `Position set! Finally, what text should this watermark have?`, getCancelKeyboard());
            return;

        case 'awaiting_preset_text':
            const presetName = state.presetNameBuffer;
            const presetStyle = state.presetStyleBuffer;
            const presetPosition = state.presetPositionBuffer;
            const presetText = trimmedText;

            if (!presetName || !presetStyle || !presetPosition) {
                 state.step = 'idle';
                 await sendMessage(chatId, 'Something went wrong, please start over.', getMainMenuKeyboard());
                 return;
            }
            state.presets[presetName] = { text: presetText, style: presetStyle, position: presetPosition };
            state.step = 'idle';
            state.presetNameBuffer = undefined;
            state.presetStyleBuffer = undefined;
            state.presetPositionBuffer = undefined;
            await sendMessage(chatId, `✅ Preset "${presetName}" saved! You can now use it when downloading videos.`, getMainMenuKeyboard());
            return;
    }


    // --- Idle State Command/Button Handling ---
    if (trimmedText === '/start') {
        await sendMessage(chatId, 'Welcome! Use the menu below to get started.', getMainMenuKeyboard());
        return;
    }

    if (trimmedText === '🎶 TikTok') {
        state.step = 'awaiting_main_menu_choice';
        await sendMessage(chatId, 'What would you like to do?', getTikTokMenuKeyboard());
        return;
    }
    
    // Fallback for any other text in idle state
    if (trimmedText.includes('tiktok.com')) {
        state.urlBuffer = trimmedText;
        state.step = 'awaiting_download_option';
        await sendMessage(chatId, "Got it! How do you want to download this video?", getDownloadOptionsKeyboard(state));
    } else {
        await sendMessage(chatId, "I'm not sure what to do with that. Please use the menu below or send a TikTok URL.", getMainMenuKeyboard());
    }
}

async function processAndSendMedia(chatId: string, url: string, watermarkText?: string, watermarkStyle?: string, watermarkPosition?: WatermarkPosition) {
    const state = getUserState(chatId);
    state.step = 'idle'; // Reset state after starting processing
    
    const statusMessageId = await sendMessage(chatId, '⏳ Starting up...', getMainMenuKeyboard());
    if (!statusMessageId) {
        await sendMessage(chatId, 'Could not start the process. Please try again.', getMainMenuKeyboard());
        return;
    }

    const onProgress = async (progress: { message: string, percentage?: number }) => {
        let text = `⏳ ${progress.message}`;
        if (progress.percentage !== undefined) {
            text += ` ${progress.percentage.toFixed(0)}%`;
        }
        await editMessage(chatId, statusMessageId, text);
    };

    let command = '/tiktok';
    if(watermarkText && watermarkStyle && watermarkPosition) {
        command = `/tiktok-wm ${url} ${watermarkStyle} ${watermarkPosition} ${watermarkText}`;
    } else {
        command = `/tiktok ${url}`;
    }

    try {
        const response = await handleMessage(command, onProgress);

        if (response.text && (!response.media || response.media.length === 0)) {
            await editMessage(chatId, statusMessageId, `⚠️ ${response.text}`);
            return;
        }

        if (response.media && response.media.length > 0) {
            await editMessage(chatId, statusMessageId, `✅ Found ${response.media.length} media file(s). Sending now...`);

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
             await deleteMessage(chatId, statusMessageId);
        }
    } catch(error: any) {
        console.error("Error processing and sending media:", error);
        let errorMessage = "An unexpected error occurred while processing your request.";
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
            errorMessage = `Failed to send media: ${error.response.data.description}`;
        } else {
            errorMessage = `An unexpected error occurred: ${error.message}`;
        }
        await editMessage(chatId, statusMessageId, `❌ ${errorMessage}`);
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

    } catch (error: any)
{
        console.error("Error processing webhook:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
