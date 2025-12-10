import { z } from 'zod';

export const CreateMessageFeedbackDtoSchema = z.object({
  type: z.enum(['like', 'dislike']),
});

export class CreateMessageFeedbackDto {
  constructor(public readonly type: 'like' | 'dislike') {}

  static from(data: unknown): CreateMessageFeedbackDto {
    const validated = CreateMessageFeedbackDtoSchema.parse(data);
    return new CreateMessageFeedbackDto(validated.type);
  }
}

