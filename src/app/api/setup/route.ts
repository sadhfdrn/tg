import { NextResponse } from "next/server";
import axios from 'axios';

export async function GET(request: Request) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        return NextResponse.json({ message: 'TELEGRAM_BOT_TOKEN is not set in .env file.' }, { status: 500 });
    }

    // Automatically determine the app's public URL from the request headers
    const requestUrl = new URL(request.url);
    const appUrl = requestUrl.origin;

    // A webhook URL must be a public URL, it cannot be localhost.
    if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
        return NextResponse.json({ 
            message: 'Cannot set webhook for a local development server. Please deploy your application to a public URL first.' 
        }, { status: 400 });
    }

    const webhookUrl = `${appUrl}/api/telegram`;

    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        if (response.data.ok) {
            console.log("Webhook set successfully:", response.data);
            return NextResponse.json({ message: `Webhook set to: ${webhookUrl}` });
        } else {
            console.error("Failed to set webhook:", response.data);
            return NextResponse.json({ message: `Failed to set webhook: ${response.data.description}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error("Error setting webhook:", error);
        return NextResponse.json({ message: `Error setting webhook: ${error.message}` }, { status: 500 });
    }
}
