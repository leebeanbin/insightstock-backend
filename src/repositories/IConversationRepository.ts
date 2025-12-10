import { Conversation } from '../entities/Conversation';

export interface IConversationRepository {
  findAll(userId: string, search?: string, category?: string): Promise<Conversation[]>;
  findById(id: string, userId: string): Promise<Conversation | null>;
  create(conversation: Conversation): Promise<Conversation>;
  update(id: string, conversation: Partial<Conversation>): Promise<Conversation>;
  delete(id: string): Promise<void>;
}

