
import { NextResponse } from 'next/server';
import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function POST(request: Request) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
        return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
    }

    try {
        const body = await request.json();
        console.log("Received update:", JSON.stringify(body, null, 2));

        let chatId;
        let responseText;

        if (body.message) {
            chatId = body.message.chat.id;
            const incomingText = body.message.text || '[No text]';
            responseText = `Webhook received your message: "${incomingText}"`;
        } else if (body.callback_query) {
            chatId = body.callback_query.message.chat.id;
            const callbackData = body.callback_query.data;
            responseText = `Webhook received your button press: "${callbackData}"`;
            
            // Acknowledge the button press to remove the loading state
            await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
                callback_query_id: body.callback_query.id,
            });
        }

        if (chatId) {
            await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
                chat_id: chatId,
                text: responseText,
            });
        }

    } catch (error: any) {
        console.error("Error processing webhook:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            console.error("Telegram API Error Response:", error.response.data);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
