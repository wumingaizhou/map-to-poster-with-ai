export type Role = "user" | "assistant";
export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isComplete?: boolean;
  isPartial?: boolean;
}
export interface ChatSession {
  id: string;
  title: string;
}
export interface ChatError {
  message: string;
  code?: string;
  recoverable?: boolean;
}
export interface AiChatUIProps {
  messages: Message[];
  sessions: ChatSession[];
  currentSessionId: string;
  isLoading: boolean;
}
