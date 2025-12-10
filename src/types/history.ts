import { z } from 'zod';

export const CreateHistorySchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  type: z.string().default('view'),
});

export type CreateHistoryDTO = z.infer<typeof CreateHistorySchema>;

export interface HistoryResponse {
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
  type: string;
  viewedAt: Date;
}
