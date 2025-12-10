import { FastifyRequest, FastifyReply } from 'fastify';
import { IMarketFacade } from '../facades/IMarketFacade';

export class MarketController {
  constructor(private readonly marketFacade: IMarketFacade) {}

  async getMarketData(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const data = await this.marketFacade.getMarketData();

    reply.send({
      success: true,
      data,
    });
  }
}
