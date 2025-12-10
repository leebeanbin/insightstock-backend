import { z } from 'zod';
import { ValidationError } from '../../errors/AppError';

export const CreateChatDtoSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().min(1).optional(), // UUID 또는 conv_ 형식 모두 허용
});

export class CreateChatDto {
  constructor(
    public readonly message: string,
    public readonly conversationId?: string
  ) {}

  static from(data: unknown): CreateChatDto {
    const validated = CreateChatDtoSchema.parse(data);
    return new CreateChatDto(validated.message, validated.conversationId);
  }

  static fromQuery(query: Record<string, string | undefined>): CreateChatDto {
    const message = query.message;
    const conversationId = query.conversationId;

    if (!message) {
      throw new ValidationError('Message is required');
    }

    // conversationId는 optional이므로 빈 문자열이면 undefined로 처리
    const convId = conversationId && conversationId.trim() !== '' ? conversationId : undefined;

    // UUID 또는 conv_ 형식 모두 허용 (검증 제거)

    return new CreateChatDto(decodeURIComponent(message), convId);
  }
}
