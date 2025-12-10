import { Message } from '../entities/Message';

export interface IMessageRepository {
  findAll(conversationId: string): Promise<Message[]>;
  findById(id: string): Promise<Message | null>;
  create(message: Message): Promise<Message>;
  delete(id: string): Promise<void>;
  findMany(
    conversationId: string,
    limit?: number,
    cursor?: string
  ): Promise<{ messages: Message[]; nextCursor?: string }>;
}

