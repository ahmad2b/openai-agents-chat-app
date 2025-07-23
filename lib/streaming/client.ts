import {
  StreamEvent,
  RawResponseEvent,
  RunItemEvent,
  AgentUpdatedEvent,
  StreamCompleteEvent,
  ErrorEvent,
  TextDeltaEvent,
  TextDoneEvent,
  ReasoningDeltaEvent,
  RefusalDeltaEvent,
  MessageCreatedEvent,
  ToolCalledEvent,
  ToolOutputEvent,
  HandoffRequestedEvent,
  HandoffOccuredEvent,
  ReasoningCreatedEvent,
  MCPApprovalEvent,
  MCPToolsEvent,
  FunctionCallArgsEvent,
  ItemLifecycleEvent,
} from './types';
import { AgentInputItem } from '@openai/agents';

export class AgentStreamClient {
  private messageBuffer = '';
  private currentAgent = '';
  private isComplete = false;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  private abortController?: AbortController;
  private eventCount = 0;
  private enableLogging = process.env.NODE_ENV === 'development';
  
  // Add tracking for tool call information
  private currentToolCall: {
    name?: string;
    arguments?: string;
    parsedArguments?: Record<string, any>;
    callId?: string;
  } = {};

  // Event callbacks - can be overridden
  onTextDelta?: (delta: string, fullText: string) => void;
  onTextComplete?: (text: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onRefusalDelta?: (delta: string) => void;
  onResponseStart?: () => void;
  onResponseComplete?: () => void;
  onMessageCreated?: (messageId: string, role: string) => void;
  onToolCalled?: (toolName: string, args: Record<string, any>, callId: string) => void;
  onToolOutput?: (toolName: string, output: string, callId: string) => void;
  onHandoffRequested?: (targetAgent: string, reason: string) => void;
  onHandoffComplete?: (targetAgent: string, previousAgent: string) => void;
  onReasoningCreated?: (content: string) => void;
  onMCPApproval?: (toolName: string, serverName: string) => void;
  onMCPTools?: (serverName: string, tools: string[]) => void;
  onAgentChanged?: (agentName: string, instructions: string) => void;
  onStreamComplete?: (finalOutput: any, usage: any) => void;
  onError?: (message: string) => void;

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[AgentStream ${timestamp}]`;
    
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data || '');
        break;
    }
  }

  async startStream(message: string | AgentInputItem, sessionId?: string): Promise<void> {
    this.log('info', `Starting stream for message: "${message}" (session: ${sessionId})`);
    this.eventCount = 0;
    
    // Validate message input
    if (!message || (typeof message === 'string' && message.trim() === '')) {
      this.log('error', 'Invalid message: message cannot be empty');
      this.onError?.('Message cannot be empty');
      return;
    }
    
    // Create new abort controller for this stream
    this.abortController = new AbortController();
    
    try {
      await this.executeStream(message, sessionId);
    } catch (error) {
      // Don't retry if the request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        this.log('info', 'Stream was aborted by user');
        return;
      }
      this.log('error', 'Stream execution failed', error);
      await this.handleStreamError(error, message, sessionId);
    }
  }

  private async executeStream(message: string | AgentInputItem, sessionId?: string): Promise<void> {
    this.log('info', 'Executing stream request to backend');
    
    // Check if already aborted
    if (this.abortController?.signal.aborted) {
      this.log('info', 'Request already aborted, skipping');
      return;
    }
    
    const requestBody = JSON.stringify({ 
      message,
      ...(sessionId && { sessionId })
    });
    this.log('info', `Request body: ${requestBody}`);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.error === 'Backend service unavailable') {
          errorMessage = 'Backend service is not available. Please ensure the chat service is running on port 8000.';
        } else if (errorData.error === 'Invalid JSON' || errorData.error === 'Missing request body') {
          // These are client-side validation errors that shouldn't be retried
          errorMessage = `Request validation error: ${errorData.message}`;
        }
      } catch (parseError) {
        // If we can't parse the error, use the default message
        this.log('warn', 'Could not parse error response', parseError);
      }
      
      this.log('error', `Backend response error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    this.log('info', 'Starting to process stream');
    await this.processStream(reader);
  }

  private async processStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.log('info', `Stream complete. Processed ${this.eventCount} events total`);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6).trim();
            if (eventData) {
              try {
                const event: StreamEvent = JSON.parse(eventData);
                this.eventCount++;
                this.log('info', `Event #${this.eventCount} - ${event.type}`, event);
                await this.handleEvent(event);
              } catch (e) {
                this.log('error', `Failed to parse event #${this.eventCount + 1}: ${eventData}`, e);
                // Don't throw here, just log and continue
              }
            }
          } else if (line.trim() && !line.startsWith(':')) {
            // Log unexpected line format
            this.log('warn', 'Unexpected line format in stream', line);
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6).trim();
            if (eventData) {
              try {
                const event: StreamEvent = JSON.parse(eventData);
                this.eventCount++;
                this.log('info', `Final event #${this.eventCount} - ${event.type}`, event);
                await this.handleEvent(event);
              } catch (e) {
                this.log('error', `Failed to parse final event: ${eventData}`, e);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.log('info', 'Stream reader released');
    }
  }

  private async handleEvent(event: StreamEvent): Promise<void> {
    this.log('info', `Processing event: ${event.type}`, { 
      sequence: event.sequence_number,
      type: event.type
    });

    switch (event.type) {
      case 'raw_response':
        await this.handleRawResponse(event as RawResponseEvent);
        break;
      case 'run_item':
        await this.handleRunItem(event as RunItemEvent);
        break;
      case 'agent_updated':
        await this.handleAgentUpdated(event as AgentUpdatedEvent);
        break;
      case 'stream_complete':
        await this.handleStreamComplete(event as StreamCompleteEvent);
        break;
      case 'error':
        await this.handleError(event as ErrorEvent);
        break;
      default:
        this.log('warn', `Unknown event type: ${event.type}`, event);
    }
  }

  private async handleRawResponse(event: RawResponseEvent): Promise<void> {
    this.log('info', `Raw response event: ${event.event_type}`, { 
      sequence: event.sequence_number,
      event_type: event.event_type
    });

    switch (event.event_type) {
      case 'response.output_text.delta':
        const deltaEvent = event as TextDeltaEvent;
        this.messageBuffer += deltaEvent.delta;
        this.log('info', `Text delta: "${deltaEvent.delta}" (buffer length: ${this.messageBuffer.length})`);
        this.onTextDelta?.(deltaEvent.delta, this.messageBuffer);
        break;
      
      case 'response.output_text.done':
        const doneEvent = event as TextDoneEvent;
        this.messageBuffer = doneEvent.text; // Ensure consistency
        this.log('info', `Text complete: ${doneEvent.text.length} characters`);
        this.onTextComplete?.(doneEvent.text);
        break;
      
      case 'response.reasoning_summary_text.delta':
        const reasoningEvent = event as ReasoningDeltaEvent;
        this.log('info', `Reasoning delta: "${reasoningEvent.delta}"`);
        this.onReasoningDelta?.(reasoningEvent.delta);
        break;
      
      case 'response.refusal.delta':
        const refusalEvent = event as RefusalDeltaEvent;
        this.log('info', `Refusal delta: "${refusalEvent.delta}"`);
        this.onRefusalDelta?.(refusalEvent.delta);
        break;
      
      case 'response.created':
        this.messageBuffer = ''; // Reset buffer for new response
        this.log('info', 'Response stream started');
        this.onResponseStart?.();
        break;
      
      case 'response.completed':
        this.log('info', 'Response stream completed');
        this.onResponseComplete?.();
        break;

      // Handle function call arguments building
      case 'response.function_call_arguments.delta':
        const funcArgsEvent = event as FunctionCallArgsEvent;
        if (!this.currentToolCall.arguments) {
          this.currentToolCall.arguments = '';
        }
        this.currentToolCall.arguments += funcArgsEvent.delta;
        this.currentToolCall.callId = funcArgsEvent.call_id;
        this.log('info', `Function call args delta: "${funcArgsEvent.delta}" (call_id: ${funcArgsEvent.call_id})`);
        break;

      case 'response.function_call_arguments.done':
        // Parse the completed arguments
        if (this.currentToolCall.arguments) {
          try {
            this.currentToolCall.parsedArguments = JSON.parse(this.currentToolCall.arguments);
            this.log('info', `Function call args complete:`, this.currentToolCall.parsedArguments);
            
            // Create tool call immediately when arguments are complete
            // This shows the tool as "running" before the backend processes it
            const toolName = this.extractToolNameFromArguments();
            const callId = this.generateCallId();
            
            // Store for later matching
            this.currentToolCall.name = toolName;
            this.currentToolCall.callId = callId;
            
            this.log('info', `Creating early tool call: ${toolName} with args:`, this.currentToolCall.parsedArguments);
            this.onToolCalled?.(toolName, this.currentToolCall.parsedArguments || {}, callId);
            
          } catch (e) {
            this.log('error', `Failed to parse function call arguments: ${this.currentToolCall.arguments}`, e);
            this.currentToolCall.parsedArguments = {};
          }
        }
        break;

      case 'response.output_item.added':
        const itemEvent = event as ItemLifecycleEvent;
        if (itemEvent.item_type === 'function_call') {
          // Reset tool call tracking for new function call
          this.currentToolCall = {};
          this.log('info', `Function call item added at output_index: ${itemEvent.output_index}`);
        }
        break;

      default:
        this.log('warn', `Unhandled raw response event: ${event.event_type}`, event);
    }
  }

  private async handleRunItem(event: RunItemEvent): Promise<void> {
    this.log('info', `Run item event: ${event.name}`, {
      name: event.name,
      item_type: event.item_type
    });

    switch (event.name) {
      case 'message_output_created':
        const msgEvent = event as MessageCreatedEvent;
        this.log('info', `Message created: ${msgEvent.message_id} (${msgEvent.role})`);
        this.onMessageCreated?.(msgEvent.message_id, msgEvent.role);
        break;
      
      case 'tool_called':
        const toolEvent = event as ToolCalledEvent;
        
        // Check if we already created this tool call early
        if (this.currentToolCall.name && this.currentToolCall.callId) {
          this.log('info', `Tool call already created early, skipping duplicate: ${this.currentToolCall.name}`);
          return;
        }
        
        // Use tracked tool call information instead of null values from event
        const toolName = toolEvent.tool_name || this.extractToolNameFromArguments();
        const toolArgs = toolEvent.tool_arguments || this.currentToolCall.parsedArguments || {};
        const callId = toolEvent.call_id || this.currentToolCall.callId || this.generateCallId();
        
        this.log('info', `Tool called: ${toolName}`, {
          tool: toolName,
          call_id: callId,
          args: toolArgs
        });
        
        // Store the call ID for matching with output later
        this.currentToolCall.callId = callId;
        this.currentToolCall.name = toolName;
        
        this.onToolCalled?.(toolName, toolArgs, callId);
        break;
      
      case 'tool_output':
        const outputEvent = event as ToolOutputEvent;
        // Use tracked tool call information for name and call_id
        const outputToolName = outputEvent.tool_name || this.currentToolCall.name || 'unknown_tool';
        const outputCallId = outputEvent.call_id || this.currentToolCall.callId || this.generateCallId();
        
        this.log('info', `Tool output: ${outputToolName}`, {
          tool: outputToolName,
          call_id: outputCallId,
          output_length: outputEvent.output.length
        });
        this.onToolOutput?.(outputToolName, outputEvent.output, outputCallId);
        
        // Reset tool call tracking after output
        this.currentToolCall = {};
        break;
      
      case 'handoff_requested':
        const handoffReqEvent = event as HandoffRequestedEvent;
        this.log('info', `Handoff requested: ${handoffReqEvent.target_agent}`, {
          target: handoffReqEvent.target_agent,
          reason: handoffReqEvent.reason
        });
        this.onHandoffRequested?.(handoffReqEvent.target_agent, handoffReqEvent.reason);
        break;
      
      case 'handoff_occured':
        const handoffEvent = event as HandoffOccuredEvent;
        this.log('info', `Handoff occurred: ${handoffEvent.previous_agent} -> ${handoffEvent.target_agent}`);
        this.onHandoffComplete?.(handoffEvent.target_agent, handoffEvent.previous_agent);
        break;
      
      case 'reasoning_item_created':
        const reasoningCreatedEvent = event as ReasoningCreatedEvent;
        this.log('info', `Reasoning created: ${reasoningCreatedEvent.reasoning_content.length} characters`);
        this.onReasoningCreated?.(reasoningCreatedEvent.reasoning_content);
        break;
      
      case 'mcp_approval_requested':
        const mcpApprovalEvent = event as MCPApprovalEvent;
        this.log('info', `MCP approval requested: ${mcpApprovalEvent.tool_name} on ${mcpApprovalEvent.server_name}`);
        this.onMCPApproval?.(mcpApprovalEvent.tool_name, mcpApprovalEvent.server_name);
        break;
      
      case 'mcp_list_tools':
        const mcpToolsEvent = event as MCPToolsEvent;
        this.log('info', `MCP tools listed: ${mcpToolsEvent.tools.length} tools on ${mcpToolsEvent.server_name}`);
        this.onMCPTools?.(mcpToolsEvent.server_name, mcpToolsEvent.tools);
        break;

      default:
        this.log('warn', `Unhandled run item event: ${event.name}`, event);
    }
  }

  private async handleAgentUpdated(event: AgentUpdatedEvent): Promise<void> {
    this.currentAgent = event.agent_name;
    this.log('info', `Agent updated: ${event.agent_name}`, {
      agent: event.agent_name,
      model: event.model,
      tools_count: event.tools_count
    });
    this.onAgentChanged?.(event.agent_name, event.agent_instructions);
  }

  private async handleStreamComplete(event: StreamCompleteEvent): Promise<void> {
    this.isComplete = true;
    this.log('info', 'Stream completed', {
      turn: event.current_turn,
      usage: event.usage,
      total_events: this.eventCount
    });
    this.onStreamComplete?.(event.final_output, event.usage);
  }

  private async handleError(event: ErrorEvent): Promise<void> {
    const errorMessage = event.message;
    let userFriendlyMessage = errorMessage;
    
    this.log('error', `Stream error event: ${errorMessage}`, event);
    
    // Provide user-friendly error messages
    if (errorMessage.includes('timeout')) {
      userFriendlyMessage = 'Request timed out. The server might be busy. Please try again.';
    } else if (errorMessage.includes('rate limit')) {
      userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
    } else if (errorMessage.includes('authentication')) {
      userFriendlyMessage = 'Authentication failed. Please refresh the page and try again.';
    } else if (errorMessage.includes('Backend service unavailable') || errorMessage.includes('port 8000')) {
      userFriendlyMessage = 'Chat service is not available. Please ensure the backend server is running on port 8000.';
    }
    
    this.onError?.(userFriendlyMessage);
  }

  private async handleStreamError(error: any, message: string | AgentInputItem, sessionId?: string): Promise<void> {
    this.log('error', 'Stream execution error', error);
    
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      
      // Don't retry for certain errors
      if (error instanceof Error) {
        if (error.message.includes('Backend service unavailable') || 
            error.message.includes('port 8000') ||
            error.message.includes('503')) {
          this.log('info', 'Not retrying due to backend unavailability');
          this.onError?.('Backend service is unavailable. Please ensure the chat service is running on port 8000.');
          return;
        }
        if (error.message.includes('Request validation error')) {
          this.log('info', 'Not retrying due to client validation error');
          this.onError?.(error.message);
          return;
        }
      }
      
      this.log('info', `Retrying stream (${this.retryCount}/${this.maxRetries})...`);
      this.onError?.(`Connection failed, retrying... (${this.retryCount}/${this.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryCount));
      
      try {
        await this.executeStream(message, sessionId);
      } catch (retryError) {
        await this.handleStreamError(retryError, message, sessionId);
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.log('error', `Stream failed after maximum retries: ${errorMessage}`);
      this.onError?.(`Stream failed after maximum retries: ${errorMessage}`);
    }
  }

  stopStream(): void {
    this.log('info', 'Stopping stream manually');
    this.isComplete = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Getters for current state
  get currentMessage(): string {
    return this.messageBuffer;
  }

  get currentAgentName(): string {
    return this.currentAgent;
  }

  get isStreamComplete(): boolean {
    return this.isComplete;
  }

  // Reset state for new stream
  reset(): void {
    this.log('info', 'Resetting client state');
    this.messageBuffer = '';
    this.currentAgent = '';
    this.isComplete = false;
    this.retryCount = 0;
    this.eventCount = 0;
    this.currentToolCall = {}; // Reset tool call tracking
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = undefined;
  }

  // Helper method to extract tool name from arguments when tool_name is null
  private extractToolNameFromArguments(): string {
    // Try to infer tool name from arguments structure
    if (this.currentToolCall.parsedArguments) {
      const args = this.currentToolCall.parsedArguments;
      
      // Common patterns for different tools
      if (args.city || args.location) {
        return 'get_weather';
      }
      if (args.query || args.search) {
        return 'search_tool';
      }
      if (args.url || args.endpoint) {
        return 'web_request';
      }
      if (args.code || args.language) {
        return 'code_executor';
      }
    }
    
    // Fallback to generic name
    return 'unknown_tool';
  }

  // Helper method to generate a unique call ID when missing
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 