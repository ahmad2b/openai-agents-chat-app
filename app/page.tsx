import { redirect } from 'next/navigation';
import { generateId } from '@/lib/utils';

export default function HomePage() {
  const sessionId = generateId();
  redirect(`/chat/${sessionId}`);
}
