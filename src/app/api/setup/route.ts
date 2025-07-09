import { NextResponse } from "next/server";
import axios from 'axios';

export async function GET(request: Request) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.APP_URL;

    if (!botToken) {
        return NextResponse.json({ message: 'TELEGRAM_BOT_TOKEN is not set in .env file.' }, { status: 500 });
    }
    if (!appUrl) {
        return NextResponse.json({ message: 'APP_URL is not available. Make sure the app is deployed on Firebase App Hosting.' }, { status: 500 });
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
