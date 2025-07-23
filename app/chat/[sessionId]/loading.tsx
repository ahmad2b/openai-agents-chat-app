import { Bot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="h-screen flex flex-col">
      {/* Session Header Skeleton */}
      <div className="flex-shrink-0 px-6 py-2 border-b border-border/30 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Chat Interface Skeleton */}
      <div className="flex-1 min-h-0 flex flex-col bg-background">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-lg text-foreground">Agent Chat</h1>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>

        {/* Messages Area Skeleton */}
        <div className="flex-1 min-h-0 p-6 space-y-6">
          {/* Loading message skeleton */}
          <div className="flex justify-center">
            <div className="bg-muted/50 rounded-2xl px-6 py-3 flex items-center gap-3">
              <div className="w-4 h-4 bg-accent rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Loading conversation...</span>
            </div>
          </div>

          {/* Sample message skeletons */}
          <div className="space-y-6">
            {/* User message skeleton */}
            <div className="flex justify-end">
              <div className="bg-accent/10 rounded-2xl px-4 py-3 max-w-2xl ml-12">
                <Skeleton className="h-4 w-48" />
              </div>
            </div>

            {/* Assistant message skeleton */}
            <div className="flex justify-start">
              <div className="bg-card border rounded-2xl px-4 py-3 max-w-2xl mr-12">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>

            {/* Another user message skeleton */}
            <div className="flex justify-end">
              <div className="bg-accent/10 rounded-2xl px-4 py-3 max-w-2xl ml-12">
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="flex-shrink-0 p-6 border-t border-border/50 bg-background/80">
          <div className="relative rounded-2xl bg-card border border-border">
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
} 