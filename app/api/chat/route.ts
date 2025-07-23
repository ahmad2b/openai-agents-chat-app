import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const CHAT_STREAM_ENDPOINT = `${BACKEND_URL}/chat/stream`;

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return new Response('Missing message parameter', { status: 400 });
    }

    // Forward the request to the agent
    const backendResponse = await fetch(CHAT_STREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ 
        input: message, 
        session_id: '123',
      }),
    });

    if (!backendResponse.ok) {
      console.error('Backend API error:', backendResponse.status, backendResponse.statusText);
      return new Response(`Backend API error: ${backendResponse.status} ${backendResponse.statusText}`, { 
        status: backendResponse.status 
      });
    }

    if (!backendResponse.body) {
      return new Response(
        JSON.stringify({
          error: 'Backend response error',
          message: 'No response body from backend service'
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a TransformStream to forward the backend stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming the backend response
    const forwardStream = async () => {
      try {
        const reader = backendResponse.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // Decode the chunk and forward it
          const chunk = decoder.decode(value, { stream: true });
          
          // Forward the chunk as-is to maintain SSE format
          await writer.write(encoder.encode(chunk));
        }
      } catch (error) {
        console.error('Error forwarding stream:', error);
        
        // Send error event to client
        const errorEvent = {
          type: 'error',
          message: 'Stream connection lost. Please try again.',
          timestamp: Date.now().toString()
        };
        
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } catch (writeError) {
          console.error('Error writing error event:', writeError);
        }
      } finally {
        try {
          await writer.close();
        } catch (closeError) {
          console.error('Error closing writer:', closeError);
        }
      }
    };

    // Start forwarding in the background
    forwardStream();

    // Return the SSE response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Check if it's a network error (backend not available)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new Response(
        JSON.stringify({
          error: 'Backend service unavailable',
          message: 'Could not connect to the chat service. Please ensure the backend is running on port 8000.',
          details: error.message
        }), 
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
