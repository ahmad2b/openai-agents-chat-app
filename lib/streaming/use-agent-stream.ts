'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AgentStreamClient } from './client';
import { Item, ToolCallItem, AgentHandoffItem } from './types';
import { generateId } from '../utils';

interface UseAgentStreamOptions {
  onTextDelta?: (delta: string, fullText: string) => void;
  onToolCalled?: (toolName: string, args: Record<string, any>) => void;
  onToolOutput?: (toolName: string, output: string) => void;
  onAgentChanged?: (agentName: string) => void;
  onError?: (message: string) => void;
  autoScroll?: boolean;
  debounceMs?: number;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [messages, setMessages] = useState<Item[]>([]);
  
  const clientRef = useRef<AgentStreamClient | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTextRef = useRef<string>('');
  
  const debounceMs = options.debounceMs || 4; // ~250fps for maximum responsiveness

  // Memoize current agent calculation
  const currentAgent = useMemo((): string => {
    const handoffItems = messages.filter(m => m.type === 'agent_handoff') as AgentHandoffItem[];
    const lastHandoff = handoffItems[handoffItems.length - 1];
    return lastHandoff?.target_agent || 'chat_agent';
  }, [messages]);

  // Memoize tool statistics calculation
  const toolCallItems = useMemo(() => 
    messages.filter(i => i.type === 'tool_call') as ToolCallItem[],
    [messages]
  );

  // Debounced text update function
  const updateTextContent = useCallback((fullText: string) => {
    setMessages(prev => {
      const updated = [...prev];
      const lastItem = updated[updated.length - 1];
      
      if (lastItem && lastItem.type === 'message' && lastItem.role === 'assistant') {
        // Create immutable update instead of mutation
        const newItem = { ...lastItem };
        newItem.content = [...lastItem.content];
        
        const outputContentIndex = newItem.content.findIndex(c => c.type === 'output_text');
        if (outputContentIndex >= 0) {
          // Replace existing content item
          newItem.content[outputContentIndex] = {
            ...newItem.content[outputContentIndex],
            text: fullText
          };
        } else {
          // Add new output_text content
          newItem.content.push({
            type: 'output_text',
            text: fullText
          });
        }
        
        updated[updated.length - 1] = newItem;
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const client = new AgentStreamClient();
    clientRef.current = client;

    // Set up event handlers
    client.onTextDelta = (delta, fullText) => {
      // Store pending text for debouncing
      pendingTextRef.current = fullText;
      
      // Clear existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      // Debounce updates during rapid streaming
      debounceRef.current = setTimeout(() => {
        updateTextContent(pendingTextRef.current);
        
        // Debounced auto-scroll
        if (options.autoScroll) {
          requestAnimationFrame(() => {
            const element = document.querySelector('[data-stream-content]');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          });
        }
      }, debounceMs);
      
      options.onTextDelta?.(delta, fullText);
    };

    // Add reasoning delta handler with immutable updates
    client.onReasoningDelta = (delta: string) => {
      setMessages(prev => {
        const updated = [...prev];
        const lastItem = updated[updated.length - 1];
        
        if (lastItem && lastItem.type === 'message' && lastItem.role === 'assistant') {
          // Create immutable update
          const newItem = { ...lastItem };
          newItem.content = [...newItem.content];
          
          const reasoningIndex = newItem.content.findIndex(c => c.type === 'reasoning');
          if (reasoningIndex >= 0) {
            newItem.content[reasoningIndex] = {
              ...newItem.content[reasoningIndex],
              text: (newItem.content[reasoningIndex].text || '') + delta
            };
          } else {
            newItem.content.push({
              type: 'reasoning',
              text: delta
            });
          }
          
          updated[updated.length - 1] = newItem;
        }
        return updated;
      });
    };

    // Add refusal delta handler with immutable updates
    client.onRefusalDelta = (delta: string) => {
      setMessages(prev => {
        const updated = [...prev];
        const lastItem = updated[updated.length - 1];
        
        if (lastItem && lastItem.type === 'message' && lastItem.role === 'assistant') {
          // Create immutable update
          const newItem = { ...lastItem };
          newItem.content = [...newItem.content];
          
          const refusalIndex = newItem.content.findIndex(c => c.type === 'refusal');
          if (refusalIndex >= 0) {
            newItem.content[refusalIndex] = {
              ...newItem.content[refusalIndex],
              text: (newItem.content[refusalIndex].text || '') + delta
            };
          } else {
            newItem.content.push({
              type: 'refusal',
              text: delta
            });
          }
          
          updated[updated.length - 1] = newItem;
        }
        return updated;
      });
    };

    client.onTextComplete = (text) => {
      // Message is already updated in real-time via onTextDelta
      // Just ensure final state is correct
      updateTextContent(text);
    };

    client.onToolCalled = (toolName, args, callId) => {
      const toolCallItem: ToolCallItem = {
        type: 'tool_call',
        id: callId || generateId(),
        tool_type: toolName, // Use the tool name as the tool_type since it's now a string
        name: toolName,
        call_id: callId,
        status: 'in_progress',
        arguments: JSON.stringify(args, null, 2),
        parsedArguments: args
      };
      
      setMessages(prev => [...prev, toolCallItem]);
      options.onToolCalled?.(toolName, args);
    };

    client.onToolOutput = (toolName, output, callId) => {
      // Update the ToolCallItem in messages with immutable update
      setMessages(prev => prev.map(item => 
        item.type === 'tool_call' && 
        (item.call_id === callId || (item.name === toolName && item.status === 'in_progress'))
          ? { 
              ...item, 
              output, 
              status: 'completed' as const
            }
          : item
      ));
      
      options.onToolOutput?.(toolName, output);
    };

    client.onAgentChanged = (agentName) => {
      // Get current agent before creating handoff
      const currentAgentName = currentAgent;
      
      // Create agent handoff item if agent actually changed
      if (currentAgentName && currentAgentName !== agentName) {
        const handoffItem: AgentHandoffItem = {
          type: 'agent_handoff',
          id: generateId(),
          handoff_type: 'completed',
          target_agent: agentName,
          previous_agent: currentAgentName
        };
        
        setMessages(prev => [...prev, handoffItem]);
      }
      
      options.onAgentChanged?.(agentName);
    };

    client.onResponseStart = () => {
      setError(null);
      // Add new assistant message to history
      const newMessage: Item = {
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'output_text',
          text: ''
        }]
      };
      setMessages(prev => [...prev, newMessage]);
    };

    client.onError = (message) => {
      setError(message);
      setIsStreaming(false);
      options.onError?.(message);
    };

    client.onStreamComplete = (finalOutput, usageData) => {
      setIsStreaming(false);
      setUsage(usageData);
      
      // Clear any pending debounced update
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      
      // Ensure final message content is properly saved
      updateTextContent(finalOutput);
    };

    return () => {
      // Cleanup debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      client.stopStream();
    };
  }, [updateTextContent, options, debounceMs, currentAgent]);

  const startStream = async (message: string) => {
    if (!clientRef.current || isStreaming) return;

    // Add user message to history
    const userMessage: Item = {
      type: 'message',
      role: 'user',
      content: [{
        type: 'output_text',
        text: message
      }]
    };
    setMessages(prev => [...prev, userMessage]);

    // Set agent-level streaming state
    setIsStreaming(true);
    setError(null);
    setUsage(null);

    // Reset client state
    clientRef.current.reset();

    try {
      await clientRef.current.startStream(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsStreaming(false);
    }
  };

  const stopStream = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopStream();
      setIsStreaming(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    // Clear all state in batch
    setMessages([]);
    setError(null);
    setUsage(null);
  }, []);

  const addMessage = useCallback((message: Item) => {
    const newMessage: Item = {
      ...message,
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Calculate streaming statistics
  const streamStats = {
    totalMessages: messages.length,
    userMessages: messages.filter(i => i.type === 'message' && (i as any).role === 'user').length,
    assistantMessages: messages.filter(i => i.type === 'message' && (i as any).role === 'assistant').length,
    totalToolCalls: toolCallItems.length,
    completedToolCalls: toolCallItems.filter(t => t.status === 'completed').length,
    currentAgent: currentAgent,
    usage
  };

  return {
    // State
    isStreaming,
    currentAgent: currentAgent,
    error,
    usage,
    messages,
    streamStats,

    // Actions
    startStream,
    stopStream,
    clearMessages,
    addMessage,

    // Utilities
    hasActiveToolCalls: toolCallItems.some(t => t.status === 'in_progress'),
    hasError: error !== null,
    hasMessages: messages.length > 0
  };
} 