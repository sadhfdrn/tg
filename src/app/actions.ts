'use server'

import fs from 'fs';
import { processTikTokUrl } from '@/services/tiktok'
import axios from 'axios';

export async function sendMessageToUser(formData: FormData): Promise<{ success: boolean; message: string }> {
  const chatId = formData.get('chatId');
  const message = formData.get('message');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { success: false, message: 'TELEGRAM_BOT_TOKEN is not configured.' };
  }
  if (!chatId || !message) {
    return { success: false, message: 'Chat ID and message are required.' };
  }

  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
    });

    if (response.data.ok) {
      return { success: true, message: 'Message sent successfully!' };
    } else {
      return { success: false, message: `Telegram API error: ${response.data.description}` };
    }
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const description = error.response.data.description || 'An unknown error occurred.';
      return { success: false, message: `API request failed: ${description}` };
    }
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

export async function handleMessage(message: string): Promise<{
  text?: string;
  media?: { type: 'video' | 'image', url: string, caption: string }[]
}> {
  const parts = message.trim().split(' ');
  const cmd = parts[0].toLowerCase();

  const cleanupFiles = (mediaItems: {path: string, originalPath?: string}[]) => {
      mediaItems.forEach(item => {
        try {
          if (item.path && fs.existsSync(item.path)) fs.unlinkSync(item.path);
          if (item.originalPath && fs.existsSync(item.originalPath)) fs.unlinkSync(item.originalPath);
        } catch (e) {
          console.error(`Failed to clean up file: ${(e as Error).message}`);
        }
      });
  }

  const processAndFormatMedia = async (url: string, watermarkText?: string) => {
    try {
      const processedMedia = await processTikTokUrl(url, watermarkText);
      if (processedMedia.length === 0) {
        return { text: 'Could not process the TikTok video. It might be private, deleted, or the URL is invalid.' };
      }

      const mediaForClient = processedMedia.map(item => {
        const fileBuffer = fs.readFileSync(item.path);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        return {
          ...item,
          url: `data:${mimeType};base64,${base64Data}`,
        };
      });

      // Since we are sending base64, we can clean up immediately
      cleanupFiles(processedMedia);

      return { media: mediaForClient, text: `Processed ${processedMedia.length} media file(s).` };
    } catch (error: any) {
      console.error('Error processing TikTok URL:', error);
      return { text: `Error processing TikTok URL: ${error.message}` };
    }
  }

  if (cmd === '/tiktok') {
    const url = parts[1];
    if (!url) {
      return { text: 'Please provide a TikTok URL. Usage: /tiktok <url>' };
    }
    return processAndFormatMedia(url); // No watermark
  }

  if (cmd === '/tiktok-wm') {
    const url = parts[1];
    const watermarkText = parts.slice(2).join(' ');
    if (!url || !watermarkText) {
      return { text: 'Please provide a URL and watermark text. Usage: /tiktok-wm <url> <text>' };
    }
    return processAndFormatMedia(url, watermarkText);
  }

  const otherCommands = ['/start', '/help', '/settings', '/status'];
  if (otherCommands.includes(cmd)) {
    return {
      text: `The ${cmd} command is a placeholder for the test page and has not been implemented. This command works on Telegram.`,
    };
  }

  return {
    text: "I don't understand that command. Try `/tiktok <url>` or `/tiktok-wm <url> <text>`."
  }
}
