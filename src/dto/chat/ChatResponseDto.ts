import { Message } from '../../entities/Message';
import { Conversation } from '../../entities/Conversation';

export class ChatResponseDto {
  constructor(
    public readonly conversationId: string,
    public readonly message: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sources: string[];
      createdAt: Date;
    }
  ) {}

  static to(conversation: Conversation, message: Message): ChatResponseDto {
    return new ChatResponseDto(conversation.id, {
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      createdAt: message.createdAt,
    });
  }
}

export class ConversationResponseDto {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly category?: string,
    public readonly tags: string[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static to(conversation: Conversation): ConversationResponseDto {
    return new ConversationResponseDto(
      conversation.id,
      conversation.title,
      conversation.category,
      conversation.tags,
      conversation.createdAt,
      conversation.updatedAt
    );
  }
}
