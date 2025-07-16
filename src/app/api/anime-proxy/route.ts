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
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'X-Forwarded-For': simulatedIP,
        'Cache-Control': 'no-cache',
      },
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-Forwarded-For': simulatedIP,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    ];

    let response: Response | undefined;
    let lastError: any;

    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`Attempt ${i + 1} with different headers and IP: ${simulatedIP}`);
        
        // Create AbortController for better timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased timeout
        
        response = await fetch(url, {
          headers: attempts[i] as HeadersInit,
          signal: controller.signal,
          // Add additional options for better compatibility
          method: 'GET',
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`Success on attempt ${i + 1}`);
          break;
        } else {
          console.log(`Attempt ${i + 1} failed with status: ${response.status} ${response.statusText}`);
          lastError = response;
          response = undefined;
        }
      } catch (error) {
        console.log(`Attempt ${i + 1} threw an error:`, error);
        lastError = error;
      }
      
      // Add delay between attempts to avoid rate limiting
      if (i < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!response || !response.ok) {
      const statusText = lastError instanceof Response ? `${lastError.status} ${lastError.statusText}` : 'Network error';
      console.error(`All proxy attempts failed. Last error: ${statusText}`);
      return new NextResponse(`Failed to fetch video after multiple attempts: ${statusText}`, { 
        status: lastError instanceof Response ? lastError.status : 502
      });
    }

    // Check if content is actually video
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }

    // Get content length for progress tracking
    const contentLength = response.headers.get('content-length');
    console.log(`Content length: ${contentLength || 'unknown'}`);

    // Create response headers
    const responseHeaders = new Headers();
    
    // Copy important headers from original response
    const headersToPass = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'last-modified',
      'etag',
      'cache-control'
    ];
    
    headersToPass.forEach(header => {
      const value = response!.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    // Set download headers
    const filename = new URL(url).pathname.split('/').pop() || 'video.mp4';
    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Add CORS headers if needed
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    
    // Handle range requests for video streaming
    const range = request.headers.get('range');
    if (range) {
      console.log(`Range request: ${range}`);
      // For range requests, we need to handle partial content
      return new NextResponse(response.body, {
        status: response.status === 206 ? 206 : 200,
        headers: responseHeaders,
      });
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new NextResponse('Request timeout - the video source may be slow or unavailable', { status: 408 });
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return new NextResponse('Network error - unable to connect to video source', { status: 502 });
      }
    }
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    },
  });
}
