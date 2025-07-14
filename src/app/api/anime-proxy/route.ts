import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    });

    if (!response.ok) {
        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Content-Disposition', `attachment; filename="video.mp4"`);

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}
