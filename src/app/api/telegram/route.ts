
import { NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { handleMessage } from '@/app/actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTypingAction(chatId: string | number) {
    await axios.post(`${TELEGRAM_API_URL}/sendChatAction`, { chat_id: chatId, action: 'typing' });
}

export async function POST(request: Request) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
        return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log("Received update:", JSON.stringify(body, null, 2));

        if (!body.message || !body.message.chat || !body.message.text) {
            console.log("Update is not a standard text message, skipping.");
            return NextResponse.json({ status: 'ok' });
        }
        
        const chatId = body.message.chat.id;
        const incomingText = body.message.text;

        await sendTypingAction(chatId);

        const response = await handleMessage(incomingText);

        if (response.text) {
            await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
                chat_id: chatId,
                text: response.text,
            });
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
                } else { // image
                    form.append('photo', fileBuffer, { filename: fileName });
                    if (item.caption) form.append('caption', item.caption);
                    await axios.post(`${TELEGRAM_API_URL}/sendPhoto`, form, { headers: form.getHeaders() });
                }
            }
        }
    } catch (error: any) {
        console.error("Error processing webhook:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
