
import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    });

    // Get the readable stream from the response
    const readableStream = response.data;
    
    // Create a new response with the stream and appropriate headers
    return new NextResponse(readableStream, {
      status: response.status,
      headers: {
        'Content-Type': response.headers['content-type'],
        'Content-Length': response.headers['content-length'],
        'Content-Disposition': `attachment; filename="video.mp4"`, // Prompt download
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    if (axios.isAxiosError(error) && error.response) {
      // Forward the error response from the target server
       const errorHeaders = new Headers();
       if (error.response.headers['content-type']) {
           errorHeaders.set('content-type', error.response.headers['content-type']);
       }
      return new NextResponse(error.response.data, {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: errorHeaders
      });
    }
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}
