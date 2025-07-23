'use client';

import { ChatInterface } from '@/components/chat/chat-interface';
import { Item } from '@/lib/streaming/types';

interface ChatSessionProps {
  sessionId: string;
  initialMessages: Item[];
}

export function ChatSession({ sessionId, initialMessages }: ChatSessionProps) {
  return (
    <div className="h-full">
      <div className="h-full max-h-screen flex flex-col">

        {/* Chat Interface */}
        <div className="flex-1 min-h-0">
          <ChatInterface 
            className="h-full"
            initialMessages={initialMessages}
            sessionId={sessionId}
          />
        </div>
      </div>
    </div>
  );
} 