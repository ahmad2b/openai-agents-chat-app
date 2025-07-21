'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useAgentStream } from '@/lib/streaming/use-agent-stream';
import { ChatInput } from './chat-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Bot, 
  Activity, 
  Zap,
  MessageCircle,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const {
    isStreaming,
    currentAgent,
    error,
    usage,
    messages,
    streamStats,
    startStream,
    stopStream,
    clearMessages,
    hasError,
    hasMessages
  } = useAgentStream({
    autoScroll: true,
    debounceMs: 4
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    await startStream(message);
  };

  const handleRetry = () => {
    if (messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.type === 'message' && (m as any).role === 'user').pop() as any;
      if (lastUserMessage) {
        // Get text from content items
        const text = lastUserMessage.content
          .filter((c: any) => c.type === 'input_text' || c.type === 'output_text')
          .map((c: any) => c.text)
          .join('');
        handleSendMessage(text);
      }
    }
  };

  // Check if error is related to backend unavailability
  const isBackendUnavailable = error && (
    error.includes('Backend service') || 
    error.includes('port 8000') || 
    error.includes('unavailable') ||
    error.includes('503')
  );

  // Memoize rendered messages to prevent unnecessary re-renders
  const renderedMessages = useMemo(() => {
    return messages.map((item: any, index) => {
      const isLastItem = index === messages.length - 1;
      const isStreamingItem = isStreaming && isLastItem && item.type === 'message' && item.role === 'assistant';
      
      // Create stable key based on item type and id/index
      const stableKey = item.id || `${item.type}-${index}`;
      
      if (item.type === 'message') {
        // Skip system messages for now as MessageItem only handles user/assistant
        if (item.role === 'system') {
          return (
            <div key={stableKey} className="animate-message-in flex justify-center mb-6">
              <div className="bg-muted/50 rounded-2xl px-4 py-2 max-w-xs">
                <div className="text-xs text-muted-foreground text-center">
                  System: {item.content.map((c: any) => c.text).join('')}
                </div>
              </div>
            </div>
          );
        }
        
        // Convert MessageItem to ChatMessage format for compatibility
        const regularContent = item.content
          .filter((c: any) => c.type === 'output_text' || c.type === 'input_text')
          .map((c: any) => c.text)
          .join('');
        
        const reasoningContent = item.content
          .filter((c: any) => c.type === 'reasoning')
          .map((c: any) => c.text)
          .join('');
        
        const refusalContent = item.content
          .filter((c: any) => c.type === 'refusal')
          .map((c: any) => c.text)
          .join('');
        
        const isUser = item.role === 'user';
        
        return (
          <div key={stableKey} className="animate-message-in mb-6 px-6">
            {/* Reasoning content */}
            {reasoningContent && (
              <div className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-4 max-w-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-sm text-blue-800 dark:text-blue-300">Reasoning</span>
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                    {reasoningContent}
                  </div>
                </div>
              </div>
            )}
            
            {/* Refusal content */}
            {refusalContent && (
              <div className={cn("mb-3 flex", isUser ? "justify-end" : "justify-start")}>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-2xl p-4 max-w-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="font-medium text-sm text-red-800 dark:text-red-300">Content Refused</span>
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-200 whitespace-pre-wrap leading-relaxed">
                    {refusalContent}
                  </div>
                </div>
              </div>
            )}
            
            {/* Regular message content */}
            {!refusalContent && regularContent && (
              <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "rounded-2xl px-4 py-3 max-w-2xl shadow-sm hover-lift transition-all duration-200",
                  isUser 
                    ? "bg-accent text-accent-foreground ml-12" 
                    : "bg-card text-card-foreground border mr-12"
                )}>
                  <div className={cn(
                    "text-sm leading-relaxed whitespace-pre-wrap",
                    isStreamingItem && "animate-typing"
                  )}>
                    {regularContent}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      if (item.type === 'tool_call') {
        // Render tool call item inline
        return (
          <div key={stableKey} className="animate-message-in mb-6 px-6">
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl p-4 max-w-2xl mr-12 hover-lift">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground">{item.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={
                        item.status === 'completed' ? 'default' :
                        item.status === 'in_progress' ? 'secondary' : 'destructive'
                      } className="text-xs">
                        {item.status === 'in_progress' ? 'Running...' : 
                         item.status === 'completed' ? 'Completed' : 'Failed'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {item.arguments && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Parameters</div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                        {item.arguments}
                      </pre>
                    </div>
                  </div>
                )}
                
                {item.output && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
                    <div className="bg-accent/5 rounded-lg p-3 border border-accent/10">
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {item.output}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
      
      if (item.type === 'agent_handoff') {
        return (
          <div key={stableKey} className="animate-message-in flex justify-center mb-6">
            <div className="bg-accent/10 border border-accent/20 rounded-2xl px-6 py-3">
              <div className="flex items-center gap-3 text-sm">
                <Bot className="w-4 h-4 text-accent" />
                <span className="text-foreground">
                  <span className="text-muted-foreground">{item.previous_agent}</span>
                  {" → "}
                  <span className="font-medium text-accent">{item.target_agent}</span>
                </span>
              </div>
              {item.reason && (
                <div className="text-xs text-muted-foreground mt-1 text-center">
                  {item.reason}
                </div>
              )}
            </div>
          </div>
        );
      }
      
      if (item.type === 'mcp_list_tools') {
        return (
          <div key={stableKey} className="animate-message-in mb-6 px-6">
            <div className="flex justify-start">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 rounded-2xl p-4 max-w-2xl mr-12">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-xs text-white font-bold">M</span>
                  </div>
                  <div className="font-medium text-sm text-purple-800 dark:text-purple-200">
                    MCP Tools: {item.server_name}
                  </div>
                </div>
                <div className="space-y-1">
                  {item.tools.map((tool: string, toolIndex: number) => (
                    <div key={toolIndex} className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      if (item.type === 'mcp_approval_request') {
        return (
          <div key={stableKey} className="animate-message-in mb-6 px-6">
            <div className="flex justify-center">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4 max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                    MCP Approval Required
                  </span>
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <div>Server: {item.server_name}</div>
                  <div>Tool: {item.name}</div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // Fallback for unknown item types
      return (
        <div key={stableKey} className="animate-message-in flex justify-center mb-6">
          <div className="bg-muted rounded-2xl px-4 py-2">
            <div className="text-xs text-muted-foreground">
              Unknown item type: {item.type}
            </div>
          </div>
        </div>
      );
    });
  }, [messages, isStreaming]);

  return (
    <div className={cn('flex flex-col h-full max-h-screen bg-background', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 glass-effect">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-foreground">Agent Chat</h1>
              <p className="text-xs text-muted-foreground">
                {currentAgent && `with ${currentAgent}`}
              </p>
            </div>
          </div>

          {/* Connection status */}
          {isBackendUnavailable && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          {hasMessages && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" />
                {streamStats.totalMessages}
              </span>
              {streamStats.totalToolCalls > 0 && (
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  {streamStats.totalToolCalls}
                </span>
              )}
              {usage && (
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  {usage.total_tokens}
                </span>
              )}
            </div>
          )}

          {/* Clear button */}
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              disabled={isStreaming}
              className="h-9 w-9 rounded-xl hover:bg-muted transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="pb-6">
            {!hasMessages && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-6">
                  <Bot className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-2xl font-semibold mb-3 text-foreground">Welcome to Agent Chat</h2>
                <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                  Start a conversation with our AI agent. Ask questions, request help, or explore what I can do for you.
                </p>
                
                {!isBackendUnavailable && (
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      variant="outline"
                      className="rounded-2xl hover-lift"
                      onClick={() => handleSendMessage("Hello! What can you help me with?")}
                    >
                      Get Started
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl hover-lift"
                      onClick={() => handleSendMessage("What are your capabilities?")}
                    >
                      Show Capabilities
                    </Button>
                  </div>
                )}
                
                {isBackendUnavailable && (
                  <Alert variant="destructive" className="max-w-md rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Service Unavailable</AlertTitle>
                    <AlertDescription className="mt-2">
                      The chat service is not available. Please ensure the backend server is running on port 8000.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Chat Messages and Items */}
            {renderedMessages}

            {/* Error Display */}
            {hasError && (
              <div className="mx-6 mb-6">
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {isBackendUnavailable ? 'Backend Service Unavailable' : 'Error'}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    {error}
                    
                    {isBackendUnavailable && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm">To fix this issue:</p>
                        <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
                          <li>Ensure the backend server is running</li>
                          <li>Check that it&apos;s accessible on <code className="bg-muted px-1 rounded">localhost:8000</code></li>
                          <li>Verify the <code className="bg-muted px-1 rounded">/chat/stream</code> endpoint is available</li>
                        </ol>
                        <div className="flex gap-3 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                            className="rounded-xl hover-lift"
                          >
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Retry
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('http://localhost:8000', '_blank')}
                            className="rounded-xl hover-lift"
                          >
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Check Backend
                          </Button>
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 border-t border-border/50 bg-background/80 glass-effect">
        <ChatInput
          onSendMessage={handleSendMessage}
          onStopStream={stopStream}
          isStreaming={isStreaming}
          disabled={!!isBackendUnavailable}
          placeholder={
            isBackendUnavailable 
              ? "Backend service unavailable..." 
              : "Message agent..."
          }
        />
      </div>

      {/* Floating Status Bar */}
      {(isStreaming || messages.some((m: any) => m.type === 'tool_call' && m.status === 'in_progress')) && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="bg-background/90 backdrop-blur-lg border border-border/50 rounded-2xl px-4 py-2 shadow-lg">
            <div className="flex items-center gap-4 text-xs">
              {isStreaming && (
                <div className="flex items-center gap-2 text-accent">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  Agent is responding...
                </div>
              )}
              
              {messages.some((m: any) => m.type === 'tool_call' && m.status === 'in_progress') && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Activity className="w-3 h-3 animate-pulse" />
                  {messages.filter((m: any) => m.type === 'tool_call' && m.status === 'in_progress').length} tools running
                </div>
              )}
              
              {usage && (
                <div className="text-muted-foreground">
                  {usage.total_tokens} tokens
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 