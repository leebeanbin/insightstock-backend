import { z } from 'zod';

export const CreateFavoriteSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
});

export type CreateFavoriteDTO = z.infer<typeof CreateFavoriteSchema>;

export interface FavoriteResponse {
  id: string;
  userId: string;
  stockId: string;
  stock: {
    code: string;
    name: string;
    market: string;
    currentPrice: number;
    change: number;
    changeRate: number;
  };
  createdAt: Date;
}
