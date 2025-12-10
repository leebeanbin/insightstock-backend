import { z } from 'zod';

export const CreatePortfolioDtoSchema = z.object({
  stockId: z.string().min(1, 'Stock ID is required'), // UUID 또는 code 허용
  quantity: z.number().positive('Quantity must be positive'),
  averagePrice: z.number().positive('Average price must be positive'),
});

export class CreatePortfolioDto {
  constructor(
    public readonly stockId: string,
    public readonly quantity: number,
    public readonly averagePrice: number
  ) {}

  static from(data: unknown): CreatePortfolioDto {
    const validated = CreatePortfolioDtoSchema.parse(data);
    return new CreatePortfolioDto(
      validated.stockId,
      validated.quantity,
      validated.averagePrice
    );
  }
}
