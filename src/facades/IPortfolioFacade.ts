import { PortfolioResponseDto } from '../dto/portfolio/PortfolioResponseDto';
import { CreatePortfolioDto } from '../dto/portfolio/CreatePortfolioDto';
import { UpdatePortfolioDto } from '../dto/portfolio/UpdatePortfolioDto';

export interface PortfolioAnalysis {
  summary: {
    totalValue: number;
    totalReturn: number;
    returnRate: number;
    riskScore: number;
  };
  risks: Array<{
    type: string;
    severity: 'warning' | 'error' | 'info';
    title: string;
    description: string;
    value: number;
    threshold: number;
    recommendation: string;
  }>;
  diversification: {
    sectors: Array<{
      name: string;
      value: number;
      percentage: number;
    }>;
  };
}

export interface IPortfolioFacade {
  getPortfolios(userId: string): Promise<PortfolioResponseDto[]>;
  getPortfolioById(id: string, userId: string): Promise<PortfolioResponseDto | null>;
  getPortfolioByStockId(userId: string, stockId: string): Promise<PortfolioResponseDto | null>;
  createPortfolio(userId: string, dto: CreatePortfolioDto): Promise<PortfolioResponseDto>;
  updatePortfolio(id: string, userId: string, dto: UpdatePortfolioDto): Promise<PortfolioResponseDto>;
  deletePortfolio(id: string, userId: string): Promise<void>;
  getAnalysis(userId: string): Promise<PortfolioAnalysis>;
}
