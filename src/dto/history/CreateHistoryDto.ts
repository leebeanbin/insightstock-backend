import { z } from 'zod';

export const CreateHistoryDtoSchema = z.object({
  stockId: z.string().min(1, 'Stock ID is required'),
  type: z.string().default('view'),
  // Optional fields for future expansion
  newsId: z.string().optional(),
  noteId: z.string().optional(),
  conceptId: z.string().optional(),
});

export class CreateHistoryDto {
  constructor(
    public readonly stockId: string,
    public readonly type: string = 'view',
    public readonly newsId?: string,
    public readonly noteId?: string,
    public readonly conceptId?: string
  ) {}

  static from(data: unknown): CreateHistoryDto {
    const validated = CreateHistoryDtoSchema.parse(data);
    return new CreateHistoryDto(
      validated.stockId,
      validated.type,
      validated.newsId,
      validated.noteId,
      validated.conceptId
    );
  }
}

