import { z } from 'zod';

export const CreateFavoriteDtoSchema = z.object({
  stockId: z.string().min(1, 'Stock ID is required'),
});

export class CreateFavoriteDto {
  constructor(public readonly stockId: string) {}

  static from(data: unknown): CreateFavoriteDto {
    const validated = CreateFavoriteDtoSchema.parse(data);
    return new CreateFavoriteDto(validated.stockId);
  }
}

