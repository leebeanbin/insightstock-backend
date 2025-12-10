import { z } from 'zod';

export const UpdatePortfolioDtoSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  averagePrice: z.number().positive('Average price must be positive').optional(),
});

export class UpdatePortfolioDto {
  constructor(
    public readonly quantity?: number,
    public readonly averagePrice?: number
  ) {}

  static from(data: unknown): UpdatePortfolioDto {
    const validated = UpdatePortfolioDtoSchema.parse(data);
    return new UpdatePortfolioDto(validated.quantity, validated.averagePrice);
  }
}
