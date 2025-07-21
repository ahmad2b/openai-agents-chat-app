import { ChatInterface } from '@/components/chat/chat-interface';

export default function HomePage() {
  return (
    <main className="h-screen flex flex-col">
      <ChatInterface className="flex-1" />
    </main>
  );
}
