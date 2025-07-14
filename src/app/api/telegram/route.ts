
import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { handleMessage } from '@/app/actions';
import { getAnimeInfo, getEpisodeSources, searchAnime } from '@/lib/anime-scrapper/actions';
import { IAnimeResult, IAnimeInfo, SubOrSub, IAnimeEpisode } from '@/lib/anime-scrapper/models';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// We will store user states in memory for this example.
// In a production app, this would be in a database.
type WatermarkPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';

interface UserState {
    step: 'idle' | 'awaiting_main_menu_choice' | 'awaiting_url' | 'awaiting_download_option' | 'awaiting_preset_management_action' | 'awaiting_preset_name' | 'awaiting_preset_text' | 'awaiting_preset_style' | 'awaiting_preset_position' | 'awaiting_preset_to_delete' | 'awaiting_anime_name' | 'awaiting_anime_selection' | 'awaiting_subdub_selection' | 'awaiting_episode_group_selection' | 'awaiting_episode_selection';
    urlBuffer?: string;
    presetNameBuffer?: string;
    presetStyleBuffer?: string;
    presetPositionBuffer?: WatermarkPosition;
    presets: Record<string, { text: string; style: string; position: WatermarkPosition }>;
    animeSearchResults?: IAnimeResult[];
    animeSearchIndex?: number;
    animeInfo?: IAnimeInfo;
    currentMessageId?: number;
    selectedSubOrDub?: SubOrSub;
    episodePage: number;
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
const EPISODE_GROUP_SIZE = 50;


function getUserState(chatId: string): UserState {
    if (!userStates[chatId]) {
        userStates[chatId] = { step: 'idle', presets: {}, episodePage: 0 };
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
        console.error('Failed to send message:', (error as any).response?.data || (error as any).message);
    }
    return null;
}

async function sendPhoto(chatId: string | number, photo: string, caption: string, reply_markup?: any): Promise<number | null> {
    await sendTypingAction(chatId);
    try {
        const response = await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, { chat_id: chatId, photo, caption, parse_mode: 'Markdown', reply_markup });
         if (response.data.ok && response.data.result) {
            return response.data.result.message_id;
        }
    } catch (error) {
        console.error('Failed to send photo:', (error as any).response?.data || (error as any).message);
    }
    return null;
}


async function editMessage(chatId: string | number, messageId: number, text: string, reply_markup?: any) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'Markdown',
            reply_markup: reply_markup
        });
    } catch (error) {
        // Don't log "message is not modified" errors, as they are common and not critical.
        const errorResponse = (error as any).response?.data?.description;
        if (!errorResponse || !errorResponse.includes('message is not modified')) {
            console.error('Failed to edit message text:', errorResponse || (error as Error).message);
        }
    }
}

async function editMessageMedia(chatId: string | number, messageId: number, media: any, reply_markup?: any) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/editMessageMedia`, {
            chat_id: chatId,
            message_id: messageId,
            media: media,
            reply_markup: reply_markup
        });
    } catch (error) {
        console.error('Failed to edit message media:', (error as any).response?.data || (error as any).message);
    }
}

async function editMessageCaption(chatId: string | number, messageId: number, caption: string, reply_markup?: any) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/editMessageCaption`, {
            chat_id: chatId,
            message_id: messageId,
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: reply_markup
        });
    } catch (error) {
        const errorResponse = (error as any).response?.data?.description;
         if (!errorResponse || !errorResponse.includes('message is not modified')) {
            console.error('Failed to edit message caption:', errorResponse || (error as Error).message);
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
        console.error('Failed to delete message:', (error as any).response?.data || (error as any).message);
    }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string, show_alert: boolean = false) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
            callback_query_id: callbackQueryId,
            text: text,
            show_alert: show_alert
        });
    } catch (error) {
        console.error('Failed to answer callback query:', (error as any).response?.data || (error as any).message);
    }
}


// --- Keyboards ---

function getMainMenuKeyboard() {
    return {
        keyboard: [
            [{ text: '🎶 TikTok' }, { text: '😎 Anime' }],
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

function getAnimeNavigationKeyboard(currentIndex: number, totalResults: number) {
    const buttons = [];
    if (currentIndex > 0) {
        buttons.push({ text: '⬅️ Back', callback_data: 'anime_prev' });
    }
    buttons.push({ text: '✅ Select', callback_data: 'anime_select' });
    if (currentIndex < totalResults - 1) {
        buttons.push({ text: 'Next ➡️', callback_data: 'anime_next' });
    }

    return {
        inline_keyboard: [
            buttons,
            [{ text: '❌ Cancel', callback_data: 'anime_cancel_search'}]
        ]
    };
}


function getSubDubKeyboard(info: IAnimeInfo) {
    const buttons = [];
    if (info.hasSub) buttons.push({ text: 'Subbed', callback_data: 'anime_subdub_sub'});
    if (info.hasDub) buttons.push({ text: 'Dubbed', callback_data: 'anime_subdub_dub'});

    return {
        inline_keyboard: [
            buttons,
            [{ text: '🔙 Back to Search', callback_data: 'anime_back_to_search'}]
        ]
    };
}


async function sendOrEditAnimeMessage(chatId: string, state: UserState) {
    const results = state.animeSearchResults;
    if (!results || results.length === 0) {
        await sendMessage(chatId, "No anime found for your query.");
        state.step = 'idle';
        return;
    }

    const currentIndex = state.animeSearchIndex ?? 0;
    const currentAnime = results[currentIndex];
    
    // Pre-fetch anime info
    let animeInfo: IAnimeInfo | null = null;
    let infoError = false;
    try {
        animeInfo = await getAnimeInfo(currentAnime.id);
        state.animeInfo = animeInfo; // Store it in the state for the 'select' action
    } catch(e) {
        console.error("Could not pre-fetch anime info", e);
        infoError = true;
    }
    
    const title = typeof currentAnime.title === 'string' ? currentAnime.title : (currentAnime.title as any).english || (currentAnime.title as any).romaji;
    
    let caption = `*${title}*\n\n`;
    if (animeInfo) {
        caption += `*Episodes:* ${animeInfo.totalEpisodes || 'N/A'}\n\n`;
        caption += `*Description:* ${animeInfo.description || 'Not available.'}`;
    } else if (infoError) {
        caption += `Could not fetch full details for this anime.`;
    } else {
         caption += `*Episodes:* ${currentAnime.episodes || 'N/A'}\n\n*Description:* Not available for this provider.`;
    }

    const photoUrl = currentAnime.image || 'https://via.placeholder.com/225x350.png?text=No+Image';
    const reply_markup = getAnimeNavigationKeyboard(currentIndex, results.length);

    if (state.currentMessageId) {
        try {
             await editMessageMedia(chatId, state.currentMessageId, {
                type: 'photo',
                media: photoUrl,
                caption: caption,
                parse_mode: 'Markdown'
            }, reply_markup);
        } catch (e) {
            console.error("Editing media failed, sending new message.", (e as any).response?.data || (e as any).message);
            // If editing fails (e.g., changing media type), delete and send a new one.
            await deleteMessage(chatId, state.currentMessageId);
            const newMessageId = await sendPhoto(chatId, photoUrl, caption, reply_markup);
            if (newMessageId) state.currentMessageId = newMessageId;
        }

    } else {
        const messageId = await sendPhoto(chatId, photoUrl, caption, reply_markup);
        if (messageId) state.currentMessageId = messageId;
    }
}

async function presentEpisodeGroups(chatId: string, state: UserState) {
    if (!state.animeInfo || !state.selectedSubOrDub) {
        await sendMessage(chatId, "Something went wrong, please start the anime search again.");
        state.step = 'idle';
        return;
    }
    const info = state.animeInfo;
    const availableEpisodes = info.episodes?.filter(ep => 
        state.selectedSubOrDub === SubOrSub.SUB ? ep.isSubbed : ep.isDubbed
    ) || [];
    
    const title = typeof info.title === 'string' ? info.title : (info.title as any).english || (info.title as any).romaji;

    if (availableEpisodes.length === 0) {
        await editMessageCaption(chatId, state.currentMessageId!, `*${title}*\n\nSorry, no episodes found for the selected version.`, getSubDubKeyboard(info));
        state.step = 'awaiting_subdub_selection';
        return;
    }

    if (availableEpisodes.length <= EPISODE_GROUP_SIZE) {
        // No grouping needed, go straight to episode selection
        state.episodePage = 0;
        await presentEpisodeSelection(chatId, state);
        return;
    }
    
    state.step = 'awaiting_episode_group_selection';

    const groupButtons: {text: string, callback_data: string}[] = [];
    for (let i = 0; i < availableEpisodes.length; i += EPISODE_GROUP_SIZE) {
        const start = i + 1;
        const end = Math.min(i + EPISODE_GROUP_SIZE, availableEpisodes.length);
        groupButtons.push({ text: `Episodes ${start}-${end}`, callback_data: `anime_epgroup_${i}` });
    }

    const rows = [];
    for (let i = 0; i < groupButtons.length; i += 2) {
        rows.push(groupButtons.slice(i, i + 2));
    }
    
    rows.push([{ text: '🔙 Back to Sub/Dub', callback_data: 'anime_back_to_subdub'}]);

    const reply_markup = { inline_keyboard: rows };
    await editMessageCaption(chatId, state.currentMessageId!, `*${title}* has a lot of episodes! Please select a range to view.`, reply_markup);

}

async function presentEpisodeSelection(chatId: string, state: UserState) {
    if (!state.animeInfo || !state.selectedSubOrDub) {
        await sendMessage(chatId, "Something went wrong, please start the anime search again.");
        state.step = 'idle';
        return;
    }
    state.step = 'awaiting_episode_selection';
    const info = state.animeInfo;
    const title = typeof info.title === 'string' ? info.title : (info.title as any).english || (info.title as any).romaji;

    const allAvailableEpisodes = info.episodes?.filter(ep => 
        state.selectedSubOrDub === SubOrSub.SUB ? ep.isSubbed : ep.isDubbed
    ).sort((a,b) => a.number - b.number) || [];

    const start = state.episodePage * EPISODE_GROUP_SIZE;
    const end = start + EPISODE_GROUP_SIZE;
    const episodesToShow = allAvailableEpisodes.slice(start, end);

    if (episodesToShow.length === 0) {
        await editMessageCaption(chatId, state.currentMessageId!, `*${title}*\n\nSorry, no episodes found for this selection.`, getSubDubKeyboard(info));
        state.step = 'awaiting_subdub_selection';
        return;
    }

    const episodeButtons = episodesToShow.map(ep => {
        const episodeIds = ep.id.split('$')[1];
        const subId = episodeIds.split('&')[0] || '';
        const dubId = episodeIds.split('&')[1] || '';
        const finalId = state.selectedSubOrDub === SubOrSub.SUB ? subId : dubId;
        return { text: `Ep ${ep.number}`, callback_data: `anime_ep_${ep.id.split('$')[0]}$${finalId}` }
    });
    
    const rows = [];
    for (let i = 0; i < episodeButtons.length; i += 4) { // 4 buttons per row
        rows.push(episodeButtons.slice(i, i + 4));
    }

    const episodeRangeEnd = Math.min(end, allAvailableEpisodes.length);
    const allEpisodeIds = episodesToShow.map(ep => {
         const episodeIds = ep.id.split('$')[1];
         const subId = episodeIds.split('&')[0] || '';
         const dubId = episodeIds.split('&')[1] || '';
         const finalId = state.selectedSubOrDub === SubOrSub.SUB ? subId : dubId;
         return `${ep.id.split('$')[0]}$${finalId}`;
    });

    if (episodesToShow.length > 1) {
       rows.push([{ text: `All ${start + 1}-${episodeRangeEnd}`, callback_data: `anime_ep_all_${allEpisodeIds.join('&')}` }]);
    }
    
    const navButtons = [];
    if (allAvailableEpisodes.length > EPISODE_GROUP_SIZE) {
         navButtons.push({ text: '🔙 Back to Groups', callback_data: 'anime_back_to_epgroup' });
    } else {
        navButtons.push({ text: '🔙 Back to Sub/Dub', callback_data: 'anime_back_to_subdub' });
    }
    rows.push(navButtons);

    const reply_markup = { inline_keyboard: rows };
    const messageText = `*${title}*\nSelect episodes to download (${state.selectedSubOrDub}):`;

    await editMessageCaption(chatId, state.currentMessageId!, messageText, reply_markup);
}


async function processIncomingMessage(chatId: string, text: string) {
    const state = getUserState(chatId);
    const trimmedText = text.trim();

    const resetState = async () => {
        if (state.currentMessageId) {
            try {
                await deleteMessage(chatId, state.currentMessageId);
            } catch (e) { console.error("Could not delete message during reset", e) }
        }
        userStates[chatId] = { step: 'idle', presets: state.presets, episodePage: 0 };
        await sendMessage(chatId, "Action cancelled. Returning to the main menu.", getMainMenuKeyboard());
    }

    // --- Universal Cancel / Back ---
    if (trimmedText === '❌ Cancel' || trimmedText === '🔙 Back to Main Menu') {
        await resetState();
        return;
    }

    // --- State Machine ---
    switch(state.step) {
        case 'awaiting_anime_name':
            const messageId = await sendMessage(chatId, `Searching for "${trimmedText}"...`, getCancelKeyboard());
            try {
                const searchResults = await searchAnime(trimmedText);
                if (searchResults.results.length === 0) {
                    if (messageId) await editMessage(chatId, messageId, `No results found for "${trimmedText}". Please try another name or cancel.`);
                    return;
                }
                if (messageId) await deleteMessage(chatId, messageId);
                
                state.animeSearchResults = searchResults.results;
                state.animeSearchIndex = 0;
                state.step = 'awaiting_anime_selection';
                await sendOrEditAnimeMessage(chatId, state);

            } catch (error) {
                 if (messageId) await editMessage(chatId, messageId, "Sorry, there was an error with the search. Please try again.");
                console.error(error);
            }
            return;
        
        case 'awaiting_episode_selection':
            if (trimmedText === '✅ Confirm Download') {
                await sendMessage(chatId, "Alright! Starting download... (This part is not fully implemented yet).", getMainMenuKeyboard());
                state.step = 'idle'; // Reset for next command
            } else {
                 await sendMessage(chatId, "Please use the provided keyboard to make a selection.");
            }
            return;

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
    
    if (trimmedText === '/anime' || trimmedText === '😎 Anime') {
        state.step = 'awaiting_anime_name';
        await sendMessage(chatId, "What anime are you looking for?", getCancelKeyboard());
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

async function handleAnimeEpisodeDownload(chatId: string, episodeId: string, request: Request) {
    const statusMessageId = await sendMessage(chatId, "⏳ Fetching episode sources...");
    try {
        const sources = await getEpisodeSources(episodeId);
        if (!sources || sources.sources.length === 0) {
            if (statusMessageId) await editMessage(chatId, statusMessageId, "❌ Could not find any download sources for this episode.");
            return;
        }

        const defaultSource = sources.sources.find(s => s.quality === 'default') || sources.sources[0];
        
        if (statusMessageId) await editMessage(chatId, statusMessageId, `✅ Source found! Sending video now... (This may take a moment)`);
        
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
        const proxyUrl = `https://${host}/api/anime-proxy?url=${encodeURIComponent(defaultSource.url)}`;
        
        // Use sendVideo endpoint with our proxied URL
        const response = await axios.post(`${TELEGRAM_API_URL}/sendVideo`, {
            chat_id: chatId,
            video: proxyUrl,
            caption: `Episode download`,
        });

        // If the video was sent successfully, we can delete the status message.
        if (response.data.ok) {
            if (statusMessageId) await deleteMessage(chatId, statusMessageId);
        } else {
            // If sending video fails (e.g., too large), send the link instead.
            if (statusMessageId) await editMessage(chatId, statusMessageId, `⚠️ Video could not be sent directly. Here is the download link:\n\n${proxyUrl}`);
        }

    } catch (error: any) {
        console.error("Error fetching/sending anime episode:", error);
        let errorMessage = `An unexpected error occurred: ${error.message}`;
         if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
            errorMessage = `Failed to send media: ${error.response.data.description || 'Unknown API error'}`;
        }
        if (statusMessageId) await editMessage(chatId, statusMessageId, `❌ ${errorMessage}`);
    }
}

async function processCallbackQuery(callbackQuery: any, request: Request) {
    const chatId = callbackQuery.message.chat.id.toString();
    const state = getUserState(chatId);
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    // Acknowledge the callback query immediately to prevent the client from timing out.
    await answerCallbackQuery(callbackQuery.id);

    const resetState = async () => {
        if (state.currentMessageId) await deleteMessage(chatId, state.currentMessageId);
        userStates[chatId] = { step: 'idle', presets: state.presets, episodePage: 0 };
        await sendMessage(chatId, "Action cancelled. Returning to the main menu.", getMainMenuKeyboard());
    }

    if(data === 'anime_cancel_search') {
        await resetState();
        return;
    }

    if(data === 'anime_back_to_search'){
        state.step = 'awaiting_anime_selection';
        await sendOrEditAnimeMessage(chatId, state);
        return;
    }

    if(data === 'anime_back_to_subdub'){
        if (!state.animeInfo) return;
        state.step = 'awaiting_subdub_selection';
        const title = typeof state.animeInfo.title === 'string' ? state.animeInfo.title : (state.animeInfo.title as any).english || (state.animeInfo.title as any).romaji;
        await editMessageCaption(chatId, messageId, `*${title}*\n\nThis anime has both Sub and Dub versions. Which one would you like?`, getSubDubKeyboard(state.animeInfo));
        return;
    }

    if (data === 'anime_back_to_epgroup') {
        await presentEpisodeGroups(chatId, state);
        return;
    }
    

    if (data.startsWith('anime_subdub_')) {
        if(state.step !== 'awaiting_subdub_selection') return;
        state.selectedSubOrDub = data.split('_').pop() as SubOrSub;
        if(state.currentMessageId) await editMessageCaption(chatId, state.currentMessageId, `Fetching episodes for ${state.selectedSubOrDub}...`);
        await presentEpisodeGroups(chatId, state);
        return;
    }

    if (data.startsWith('anime_epgroup_')) {
        if (state.step !== 'awaiting_episode_group_selection') return;
        state.episodePage = parseInt(data.split('_').pop() || '0') / EPISODE_GROUP_SIZE;
        await presentEpisodeSelection(chatId, state);
        return;
    }

     if (data.startsWith('anime_ep_all_')) {
        if (state.step !== 'awaiting_episode_selection' || !state.animeInfo?.episodes) return;
        
        await answerCallbackQuery(callbackQuery.id, "Preparing to send all selected episodes...");
        
        const episodeIds = data.substring('anime_ep_all_'.length).split('&');

        await sendMessage(chatId, `Found ${episodeIds.length} episodes. I will send them one by one.`);

        for(const epId of episodeIds) {
            await handleAnimeEpisodeDownload(chatId, epId, request);
            // Add a small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return;
    }

     if (data.startsWith('anime_ep_')) {
        if (state.step !== 'awaiting_episode_selection') return;
        const episodeId = data.substring('anime_ep_'.length);
        await handleAnimeEpisodeDownload(chatId, episodeId, request);
        return;
    }

    if (state.step === 'awaiting_anime_selection') {
        if (data === 'anime_next' || data === 'anime_prev') {
            if (data === 'anime_next') {
                state.animeSearchIndex = (state.animeSearchIndex ?? 0) + 1;
            } else {
                state.animeSearchIndex = (state.animeSearchIndex ?? 0) - 1;
            }
            await sendOrEditAnimeMessage(chatId, state);
        } else if (data === 'anime_select') {
            const info = state.animeInfo; // Use the pre-fetched info
            
            if (!info) {
                 await answerCallbackQuery(callbackQuery.id, "Details not available, cannot select.", true);
                 return;
            }

            state.step = 'awaiting_subdub_selection';
            
            const title = typeof info.title === 'string' ? info.title : (info.title as any).english || (info.title as any).romaji;

            if (!info.hasSub && !info.hasDub) {
                await editMessageCaption(chatId, state.currentMessageId!, `Sorry, no watchable episodes found for *${title}*.`, getAnimeNavigationKeyboard(state.animeSearchIndex || 0, state.animeSearchResults?.length || 0));
                state.step = 'awaiting_anime_selection';
                return;
            }
            
            await editMessageCaption(chatId, state.currentMessageId!, `Fetching episode details for *${title}*...`);

            if (info.hasSub && !info.hasDub) {
                state.selectedSubOrDub = SubOrSub.SUB;
                await presentEpisodeGroups(chatId, state);
            } else if (!info.hasSub && info.hasDub) {
                state.selectedSubOrDub = SubOrSub.DUB;
                await presentEpisodeGroups(chatId, state);
            } else {
                await editMessageCaption(chatId, state.currentMessageId!, `*${title}*\n\nThis anime has both Sub and Dub versions. Which one would you like?`, getSubDubKeyboard(info));
            }
        }
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
                 if (item.type === 'video') {
                    await axios.post(`${TELEGRAM_API_URL}/sendVideo`, { chat_id: String(chatId), video: item.url, caption: item.caption });
                } else {
                    await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, { chat_id: String(chatId), photo: item.url, caption: item.caption });
                }
            }
             await deleteMessage(chatId, statusMessageId);
        }
    } catch(error: any) {
        console.error("Error processing and sending media:", error);
        let errorMessage = "An unexpected error occurred while processing your request.";
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
            errorMessage = `Failed to send media: ${error.response.data.description || 'Unknown API error'}`;
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
        } else if (body.callback_query) {
             await processCallbackQuery(body.callback_query, request);
        } else {
             console.log("Update is not a standard text message or callback query, skipping.");
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
