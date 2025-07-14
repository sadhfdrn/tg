
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

    const headers = new Headers();
    Object.entries(response.headers).forEach(([key, value]) => {
      // Filter out headers that might cause issues, like 'content-encoding'
      if (key.toLowerCase() === 'transfer-encoding' || key.toLowerCase() === 'connection' || key.toLowerCase() === 'content-encoding') {
          return;
      }
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      }
    });
    
    // Ensure the content-type is set correctly
    if (!headers.has('content-type')) {
        headers.set('content-type', response.headers['content-type'] || 'application/octet-stream');
    }

    // Stream the response back to the client
    return new NextResponse(response.data, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    if (axios.isAxiosError(error) && error.response) {
      return new NextResponse(error.response.data, {
        status: error.response.status,
        statusText: error.response.statusText,
      });
    }
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}
