import { NextResponse } from "next/server";
import axios from 'axios';

export async function GET(request: Request) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        return NextResponse.json({ message: 'TELEGRAM_BOT_TOKEN is not set in .env file.' }, { status: 500 });
    }

    // --- Robust Webhook URL Determination ---
    const requestUrl = new URL(request.url);
    
    // Get host from proxy headers first, then fallback to request headers/URL.
    // This is crucial for correctly identifying the public URL when behind a reverse proxy.
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host;

    // A webhook URL must be a public URL, it cannot be localhost.
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
        return NextResponse.json({ 
            message: 'Cannot set webhook for a local development server. Please deploy your application to a public URL first.' 
        }, { status: 400 });
    }

    // Since Telegram requires HTTPS, we'll build the URL with 'https://' directly.
    // This avoids issues where the internal protocol is 'http' but the public one is 'https'.
    const appUrl = `https://${host}`;
    const webhookUrl = `${appUrl}/api/telegram`;

    try {
        // Using axios params to ensure proper URL encoding
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            params: { url: webhookUrl }
        });

        // This block is reached for 2xx responses. We still check the `ok` flag.
        if (response.data.ok) {
            console.log("Webhook set successfully:", response.data);
            return NextResponse.json({ message: `Webhook set to: ${webhookUrl}` });
        } else {
            // This case handles successful requests that result in a logical error on Telegram's side.
            console.error("Failed to set webhook (API returned ok:false):", response.data);
            return NextResponse.json({ message: `Failed to set webhook: ${response.data.description}` }, { status: 400 });
        }
    } catch (error: any) {
        // This block catches non-2xx responses from the Telegram API
        if (axios.isAxiosError(error) && error.response) {
            console.error("Error from Telegram API:", error.response.data);
            const description = error.response.data.description || 'An unknown error occurred.';
            const statusCode = error.response.status || 500;
             // The frontend expects a 'message' property in the JSON response.
            return NextResponse.json({ message: `Setup failed: ${description}` }, { status: statusCode });
        }
        
        // This handles other errors, like network problems.
        console.error("Error setting webhook:", error.message);
        return NextResponse.json({ message: `An unexpected error occurred: ${error.message}` }, { status: 500 });
    }
}
