'use server'

import fs from 'fs';
import { processTikTokUrl } from '@/services/tiktok'

export async function handleMessage(message: string): Promise<{
  text?: string;
  media?: { type: 'video' | 'image', url: string, caption: string }[]
}> {
  const [cmd, ...args] = message.trim().split(' ')

  if (cmd.toLowerCase() === '/tiktok') {
    const url = args[0]
    if (!url) {
      return { text: 'Please provide a TikTok URL. Usage: /tiktok <url>' }
    }
    try {
      const processedMedia = await processTikTokUrl(url)
      if (processedMedia.length === 0) {
        return { text: 'Could not process the TikTok video. It might be private, deleted, or the URL is invalid.'}
      }

      const mediaForClient = processedMedia.map(item => {
        const fileBuffer = fs.readFileSync(item.path);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        
        // Clean up the temp file after reading
        try {
          fs.unlinkSync(item.path);
          if (item.originalPath && fs.existsSync(item.originalPath)) {
            fs.unlinkSync(item.originalPath);
          }
        } catch (e) {
            console.error(`Failed to clean up file for web UI: ${(e as Error).message}`);
        }

        return {
          ...item,
          url: `data:${mimeType};base64,${base64Data}`,
        };
      });

      return { media: mediaForClient, text: `Processed ${processedMedia.length} media file(s).` }
    } catch (error: any) {
      console.error('Error processing TikTok URL:', error);
      return { text: `Error processing TikTok URL: ${error.message}` }
    }
  }

  const otherCommands = ['/start', '/help', '/settings', '/status'];
  if (otherCommands.includes(cmd.toLowerCase())) {
     return {
        text: `The ${cmd} command is a placeholder and has not been implemented yet.`,
     };
  }
  
  return {
    text: "I don't understand that command. Try /help or /tiktok <url>."
  }
}
