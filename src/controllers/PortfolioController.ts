import { FastifyRequest, FastifyReply } from 'fastify';
import { IPortfolioFacade } from '../facades/IPortfolioFacade';
import { CreatePortfolioDto } from '../dto/portfolio/CreatePortfolioDto';
import { UpdatePortfolioDto } from '../dto/portfolio/UpdatePortfolioDto';
import { NotFoundError } from '../errors/AppError';
import { logger } from '../config/logger';

export class PortfolioController {
  constructor(private readonly portfolioFacade: IPortfolioFacade) {}

  async getPortfolios(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const portfolios = await this.portfolioFacade.getPortfolios(userId);

    // 총합 계산
    const totalCost = portfolios.reduce((sum, p) => sum + p.totalCost, 0);
    const currentValue = portfolios.reduce((sum, p) => sum + p.currentValue, 0);
    const totalProfit = currentValue - totalCost;
    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    reply.send({
      success: true,
      data: {
        portfolios,
        summary: {
          totalCost,
          currentValue,
          totalProfit,
          totalProfitRate,
        },
        total: portfolios.length,
      },
    });
  }

  async getPortfolioById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const portfolio = await this.portfolioFacade.getPortfolioById(id, userId);

    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    reply.send({
      success: true,
      data: portfolio,
    });
  }

  async getPortfolioByStockId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { stockId } = request.params as { stockId: string };
    const userId = request.userId!;

    const portfolio = await this.portfolioFacade.getPortfolioByStockId(userId, stockId);

    if (!portfolio) {
      // 404는 정상적인 상황 (포트폴리오에 없는 종목)이므로 debug 레벨로 로깅
      logger.debug(`Portfolio not found for stockId: ${stockId}, userId: ${userId} (this is normal if stock is not in portfolio)`);
      throw new NotFoundError('Portfolio');
    }

    logger.debug(`Portfolio found for stockId: ${stockId}, userId: ${userId}, portfolioId: ${portfolio.id}`);
    reply.send({
      success: true,
      data: portfolio,
    });
  }

  async createPortfolio(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const dto = CreatePortfolioDto.from(request.body);

    const portfolio = await this.portfolioFacade.createPortfolio(userId, dto);

    reply.status(201).send({
      success: true,
      data: portfolio,
    });
  }

  async updatePortfolio(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const dto = UpdatePortfolioDto.from(request.body);

    const portfolio = await this.portfolioFacade.updatePortfolio(id, userId, dto);

    reply.send({
      success: true,
      data: portfolio,
    });
  }

  async deletePortfolio(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    await this.portfolioFacade.deletePortfolio(id, userId);

    reply.send({
      success: true,
      message: 'Portfolio deleted successfully',
    });
  }

  async getAnalysis(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const analysis = await this.portfolioFacade.getAnalysis(userId);

    reply.send({
      success: true,
      data: analysis,
    });
  }
}
