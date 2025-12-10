import { z } from 'zod';

// Create Portfolio DTO
export const CreatePortfolioSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  quantity: z.number().positive('Quantity must be positive'),
  averagePrice: z.number().positive('Average price must be positive'),
});

export type CreatePortfolioDTO = z.infer<typeof CreatePortfolioSchema>;

// Update Portfolio DTO
export const UpdatePortfolioSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  averagePrice: z.number().positive('Average price must be positive').optional(),
});

export type UpdatePortfolioDTO = z.infer<typeof UpdatePortfolioSchema>;

// Portfolio Response
export interface PortfolioResponse {
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
  quantity: number;
  averagePrice: number;
  totalCost: number;
  currentValue: number;
  profit: number;
  profitRate: number;
  createdAt: Date;
  updatedAt: Date;
}
