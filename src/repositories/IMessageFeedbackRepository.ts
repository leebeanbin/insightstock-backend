import { MessageFeedback } from '../entities/MessageFeedback';

export interface IMessageFeedbackRepository {
  findByMessageAndUser(messageId: string, userId: string): Promise<MessageFeedback | null>;
  create(feedback: MessageFeedback): Promise<MessageFeedback>;
  update(id: string, type: 'like' | 'dislike'): Promise<MessageFeedback>;
  delete(id: string): Promise<void>;
  countByMessage(messageId: string): Promise<{ likes: number; dislikes: number }>;
}

