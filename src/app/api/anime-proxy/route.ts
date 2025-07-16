
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new NextResponse('Invalid URL format', { status: 400 });
  }

  try {
    const simulatedIP = process.env.SIMULATED_IP || '34.13.167.125';
    
    const attempts = [
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'X-Forwarded-For': simulatedIP,
        'X-Real-IP': simulatedIP,
      },
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'X-Forwarded-For': simulatedIP,
      },
    ];

    let response: Response | undefined;
    let lastError: any;

    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`Attempt ${i + 1} with different headers and IP: ${simulatedIP}`);
        response = await fetch(url, {
          headers: attempts[i] as HeadersInit,
          signal: AbortSignal.timeout(30000), 
        });

        if (response.ok) {
          console.log(`Success on attempt ${i + 1}`);
          break;
        } else {
          console.log(`Attempt ${i + 1} failed with status: ${response.status}`);
          lastError = response;
          response = undefined;
        }
      } catch (error) {
        console.log(`Attempt ${i + 1} threw an error:`, error);
        lastError = error;
      }
    }

    if (!response || !response.ok) {
      const statusText = lastError instanceof Response ? `${lastError.status} ${lastError.statusText}` : 'Network error';
      console.error(`All proxy attempts failed. Last error: ${statusText}`);
      return new NextResponse(`Failed to fetch video after multiple attempts: ${statusText}`, { 
        status: lastError instanceof Response ? lastError.status : 502
      });
    }

    // Pass through the original headers and add the Content-Disposition header.
    const responseHeaders = new Headers(response.headers);
    const filename = new URL(url).pathname.split('/').pop() || 'video.mp4';
    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new NextResponse('Request timeout', { status: 408 });
      }
    }
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}
