// Base event interface
export interface BaseStreamEvent {
  type: string;
  sequence_number?: number;
}

// Raw response events
export interface RawResponseEvent extends BaseStreamEvent {
  type: 'raw_response';
  event_type: string;
  sequence_number: number;
}

export interface TextDeltaEvent extends RawResponseEvent {
  event_type: 'response.output_text.delta';
  delta: string;
  content_index: number;
  item_id: string;
  output_index: number;
}

export interface TextDoneEvent extends RawResponseEvent {
  event_type: 'response.output_text.done';
  text: string;
  content_index: number;
  item_id: string;
}

export interface ReasoningDeltaEvent extends RawResponseEvent {
  event_type: 'response.reasoning_summary_text.delta';
  delta: string;
  reasoning: true;
}

export interface RefusalDeltaEvent extends RawResponseEvent {
  event_type: 'response.refusal.delta';
  delta: string;
  refusal: true;
}

export interface FunctionCallArgsEvent extends RawResponseEvent {
  event_type: 'response.function_call_arguments.delta';
  delta: string;
  function_call: true;
  call_id?: string;
}

export interface FunctionCallArgsDoneEvent extends RawResponseEvent {
  event_type: 'response.function_call_arguments.done';
  sequence_number: number;
}

export interface ResponseLifecycleEvent extends RawResponseEvent {
  event_type: 'response.created' | 'response.completed';
  response_id: string;
  status: 'in_progress' | 'completed';
}

export interface ContentLifecycleEvent extends RawResponseEvent {
  event_type: 'response.content_part.added' | 'response.content_part.done';
  content_index: number;
  item_id: string;
}

export interface ItemLifecycleEvent extends RawResponseEvent {
  event_type: 'response.output_item.added' | 'response.output_item.done';
  output_index: number;
  item_type: string;
}

// Run item events
export interface RunItemEvent extends BaseStreamEvent {
  type: 'run_item';
  name: string;
  item_type: string | null;
}

export interface MessageCreatedEvent extends RunItemEvent {
  name: 'message_output_created';
  role: 'assistant';
  status: 'in_progress' | 'completed';
  message_id: string;
}

export interface ToolCalledEvent extends RunItemEvent {
  name: 'tool_called';
  tool_name: string;
  tool_arguments: Record<string, any>;
  call_id: string;
}

export interface ToolOutputEvent extends RunItemEvent {
  name: 'tool_output';
  tool_name: string;
  output: string;
  call_id: string;
}

export interface HandoffRequestedEvent extends RunItemEvent {
  name: 'handoff_requested';
  target_agent: string;
  reason: string;
}

export interface HandoffOccuredEvent extends RunItemEvent {
  name: 'handoff_occured';
  target_agent: string;
  previous_agent: string;
}

export interface ReasoningCreatedEvent extends RunItemEvent {
  name: 'reasoning_item_created';
  reasoning_content: string;
}

export interface MCPApprovalEvent extends RunItemEvent {
  name: 'mcp_approval_requested';
  tool_name: string;
  server_name: string;
}

export interface MCPToolsEvent extends RunItemEvent {
  name: 'mcp_list_tools';
  server_name: string;
  tools: string[];
}

// Agent updated events
export interface AgentUpdatedEvent extends BaseStreamEvent {
  type: 'agent_updated';
  agent_name: string;
  agent_instructions: string;
  model: string;
  tools_count: number;
  handoffs_count: number;
}

// System events
export interface StreamCompleteEvent extends BaseStreamEvent {
  type: 'stream_complete';
  final_output: any;
  current_turn: number;
  usage: {
    requests: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } | null;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  message: string;
  timestamp: string;
}

export interface UnknownEvent extends BaseStreamEvent {
  type: 'unknown_event';
  event_class: string;
  data: string;
}

// Union type for all events
export type StreamEvent = 
  | TextDeltaEvent
  | TextDoneEvent
  | ReasoningDeltaEvent
  | RefusalDeltaEvent
  | FunctionCallArgsEvent
  | FunctionCallArgsDoneEvent
  | ResponseLifecycleEvent
  | ContentLifecycleEvent
  | ItemLifecycleEvent
  | MessageCreatedEvent
  | ToolCalledEvent
  | ToolOutputEvent
  | HandoffRequestedEvent
  | HandoffOccuredEvent
  | ReasoningCreatedEvent
  | MCPApprovalEvent
  | MCPToolsEvent
  | AgentUpdatedEvent
  | StreamCompleteEvent
  | ErrorEvent
  | UnknownEvent;

// ============================================================================
// COMPREHENSIVE MESSAGE ITEM TYPES
// ============================================================================

export interface Annotation {
  [key: string]: any;
}

export interface ContentItem {
  type: "input_text" | "output_text" | "refusal" | "output_audio" | "reasoning";
  annotations?: Annotation[];
  text?: string;
}

// Message items for storing conversation history matching API shape
export interface MessageItem {
  type: "message";
  role: "user" | "assistant" | "system";
  id?: string;
  content: ContentItem[];
}

// Custom items to display in chat
export interface ToolCallItem {
  type: "tool_call";
  tool_type: string; // Can be any tool type name
  status: "in_progress" | "completed" | "failed" | "searching";
  id: string;
  name?: string | null;
  call_id?: string;
  arguments?: string;
  parsedArguments?: any;
  output?: string | null;
}

export interface McpListToolsItem {
  type: "mcp_list_tools";
  id: string;
  server_name: string; // Changed from server_label to match actual events
  tools: string[]; // Changed from objects to string array to match actual events
}

export interface McpApprovalRequestItem {
  type: "mcp_approval_request";
  id: string;
  server_name: string; // Changed from server_label to match actual events
  name: string;
  arguments?: string;
}

export interface AgentHandoffItem {
  type: "agent_handoff";
  id: string;
  handoff_type: "requested" | "completed";
  target_agent: string;
  previous_agent?: string;
  reason?: string;
}

export type Item =
  | MessageItem
  | ToolCallItem
  | McpListToolsItem
  | McpApprovalRequestItem
  | AgentHandoffItem;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
} 
