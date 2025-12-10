import { ChatResponseDto, ConversationResponseDto } from '../dto/chat/ChatResponseDto';
import { CreateChatDto } from '../dto/chat/CreateChatDto';

export interface IChatFacade {
  getConversations(userId: string, search?: string, category?: string): Promise<ConversationResponseDto[]>;
  getMessages(conversationId: string, userId: string): Promise<ChatResponseDto[]>;
  streamChat(userId: string, dto: CreateChatDto): AsyncGenerator<string, void, unknown>;
  regenerateMessage(userId: string, messageId: string): AsyncGenerator<string, void, unknown>;
  deleteConversation(id: string, userId: string): Promise<void>;
  getSuggestedQuestions(userId: string): Promise<string[]>;
  getContextConsentStatus(userId: string): Promise<boolean>;
  setContextConsent(userId: string, enabled: boolean): Promise<void>;
}

