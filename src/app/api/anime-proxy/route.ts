
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('url');
  const referer = searchParams.get('referer');

  if (!videoUrl) {
    return new NextResponse('Missing video URL', { status: 400 });
  }

  if (!referer) {
    return new NextResponse('Missing referer', { status: 400 });
  }

  try {
    const response = await axios.get(videoUrl, {
      responseType: 'stream',
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    });

    // We need to use the web-standard Response object to stream
    // The 'any' type cast is necessary because the TS typings for ReadableStream are slightly different
    const readableStream: any = response.data;

    return new Response(readableStream, {
      status: 200,
      headers: {
        'Content-Type': response.headers['content-type'] || 'video/mp4',
        'Content-Disposition': 'attachment; filename="video.mp4"',
      },
    });

  } catch (error) {
    console.error('Error proxying anime video:', error);
    return new NextResponse('Error fetching video', { status: 500 });
  }
}
