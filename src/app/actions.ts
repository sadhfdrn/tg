'use server'

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
      const results = await processTikTokUrl(url)
      if (results.length === 0) {
        return { text: 'Could not process the TikTok video. It might be private, deleted, or the URL is invalid.'}
      }
      return { media: results, text: `Processed ${results.length} media file(s).` }
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
