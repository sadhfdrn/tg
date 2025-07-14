import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const customIP = searchParams.get('ip'); // Allow IP to be passed as query parameter

  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return new NextResponse('Invalid URL format', { status: 400 });
  }

  try {
    // IP to simulate (can be made configurable via environment variable or query param)
    const simulatedIP = customIP || process.env.SIMULATED_IP || '34.13.167.125';
    
    // Try multiple approaches to bypass 403 errors
    const attempts = [
      // Attempt 1: More complete browser headers with simulated IP
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // IP simulation headers
        'X-Forwarded-For': simulatedIP,
        'X-Real-IP': simulatedIP,
        'X-Client-IP': simulatedIP,
        'X-Originating-IP': simulatedIP,
        'CF-Connecting-IP': simulatedIP, // Cloudflare
        'True-Client-IP': simulatedIP,   // Cloudflare
      },
      // Attempt 2: Mobile user agent with simulated IP
      {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'video/mp4,video/*,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        // IP simulation headers
        'X-Forwarded-For': simulatedIP,
        'X-Real-IP': simulatedIP,
        'X-Client-IP': simulatedIP,
      },
      // Attempt 3: Minimal headers with simulated IP
      {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        // IP simulation headers
        'X-Forwarded-For': simulatedIP,
        'X-Real-IP': simulatedIP,
      }
    ];

    let response: Response | undefined;
    let lastError: any;

    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`Attempt ${i + 1} with different headers and IP: ${simulatedIP}`);
        response = await fetch(url, {
          headers: attempts[i] as HeadersInit,
          signal: AbortSignal.timeout(30000), // 30-second timeout
        });

        if (response.ok) {
          console.log(`Success on attempt ${i + 1}`);
          break;
        } else {
          console.log(`Attempt ${i + 1} failed with status: ${response.status}`);
          lastError = response;
          response = undefined; // Ensure we don't use a failed response
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

    // Check if it's actually a video file
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }
    
    // Create response headers
    const responseHeaders = new Headers();
    
    // Copy important headers from original response
    const headersToKeep = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'last-modified',
      'etag'
    ];
    
    headersToKeep.forEach(header => {
      const value = response!.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    // Set download headers
    const filename = getFilenameFromUrl(url) || 'anime_episode.mp4';
    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
    responseHeaders.set('Cache-Control', 'no-cache');
    
    // Handle range requests properly
    const range = request.headers.get('range');
    if (range && response.headers.get('accept-ranges') === 'bytes') {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // Stream the response to handle large files
    const stream = response.body;

    return new NextResponse(stream, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new NextResponse('Request timeout', { status: 408 });
      }
      if (error.name === 'TypeError') {
        return new NextResponse('Network error or invalid URL', { status: 502 });
      }
    }
    
    return new NextResponse('Error fetching the content', { status: 500 });
  }
}

// Helper function to extract filename from URL
function getFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    if (filename && filename.includes('.')) {
      return filename;
    }
    
    // If no extension, add .mp4
    return filename ? `${filename}.mp4` : null;
  } catch {
    return null;
  }
}
