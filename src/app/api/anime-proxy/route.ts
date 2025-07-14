import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

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
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://animeowl.me/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,video/*,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity', // Prevent compression issues
        'Range': 'bytes=0-', // Enable range requests for better streaming
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 seconds timeout
    });

    if (!response.ok) {
      console.error(`Fetch failed: ${response.status} ${response.statusText}`);
      return new NextResponse(`Failed to fetch video: ${response.status} ${response.statusText}`, { 
        status: response.status 
      });
    }

    // Check if it's actually a video file
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }

    // Get content length for better download handling
    const contentLength = response.headers.get('content-length');
    
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
      const value = response.headers.get(header);
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
    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body?.getReader();
        
        function pump(): Promise<void> {
          return reader!.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            return pump();
          });
        }
        
        return pump();
      },
      cancel() {
        response.body?.cancel();
      }
    });

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
