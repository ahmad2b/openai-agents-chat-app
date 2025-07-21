'use client';

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopStream: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSendMessage,
  onStopStream,
  isStreaming,
  disabled = false,
  placeholder = "Message agent...",
  className
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    if (!message.trim() || isStreaming || disabled) return;
    
    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    onStopStream();
  };

  const canSend = message.trim() && !disabled && !isStreaming;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Main input area */}
      <div className={cn(
        'relative rounded-2xl bg-card border border-border transition-all duration-200',
        isFocused && 'border-accent/50 shadow-lg shadow-accent/10',
        disabled && 'opacity-60'
      )}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'border-0 bg-transparent resize-none px-4 py-4 pr-14 min-h-[3.5rem] max-h-32',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'placeholder:text-muted-foreground/60 text-sm leading-relaxed',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20'
          )}
          rows={1}
        />
        
        {/* Send/Stop button */}
        <div className="absolute bottom-2 right-2">
          {isStreaming ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              className="h-10 w-10 rounded-xl hover-lift"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                'h-10 w-10 rounded-xl transition-all duration-200 hover-lift',
                canSend 
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Status and helper text */}
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-muted-foreground">
          {isStreaming ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span>Agent is responding...</span>
            </div>
          ) : disabled ? (
            <div className="flex items-center gap-2 text-destructive">
              <div className="w-2 h-2 bg-destructive rounded-full" />
              <span>Service unavailable</span>
            </div>
          ) : (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Enter</kbd> to send
            </span>
          )}
        </div>
        
        {/* Character count */}
        <div className="text-xs">
          <span className={cn(
            'transition-colors duration-200',
            message.length > 1500 && 'text-amber-500',
            message.length > 1800 && 'text-red-500'
          )}>
            {message.length}
          </span>
          <span className="text-muted-foreground/60">/2000</span>
        </div>
      </div>
    </div>
  );
} 