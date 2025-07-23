import { notFound } from 'next/navigation';
import { ChatSession } from './chat-session';

interface ChatPageProps {
  params: Promise<{ sessionId: string }>;
}

async function fetchSessionMessages(sessionId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
    
    const response = await fetch(`${baseUrl}/api/chat?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Don't cache this request since messages can change
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Session not found
      }
      throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching session messages:', error);
    // Return null to indicate no messages found (new session)
    return null;
  }
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionId } = await params;
  
  // Validate sessionId format (basic validation)
  if (!sessionId || sessionId.trim() === '') {
    notFound();
  }

  // Fetch existing messages for this session
  const sessionData = await fetchSessionMessages(sessionId);
  
  const initialMessages = sessionData?.messages || [];

  return (
    <div className="h-screen">
      <ChatSession 
        sessionId={sessionId}
        initialMessages={initialMessages}
      />
    </div>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ChatPageProps) {
  const { sessionId } = await params;
  
  return {
    title: `Chat Session - ${sessionId}`,
    description: `Continue your conversation in session ${sessionId}`,
  };
} 