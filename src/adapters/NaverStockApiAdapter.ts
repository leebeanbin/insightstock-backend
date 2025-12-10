import axios from 'axios';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';

export interface StockPriceData {
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface StockDetailData extends StockPriceData {
  high: number;
  low: number;
  open: number;
  marketCap: number;
}

export interface ChartDataPoint {
  time: string;
  value: number;
  volume: number;
}

const BASE_PRICES: Record<string, number> = {
  '005930': 71000, '000660': 178000, '373220': 370000, '207940': 780000,
  '005380': 210000, '000270': 95000, '035420': 180000, '035720': 42000,
};

export class NaverStockApiAdapter {
  private readonly baseUrl = 'https://m.stock.naver.com/api';
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  async getStockPrice(code: string): Promise<StockPriceData> {
    try {
      const response = await axios.get(`${this.baseUrl}/stock/${code}/basic`, {
        headers: this.headers,
        timeout: 5000,
      });

      const data = response.data;
      return {
        currentPrice: Number(data.closePrice) || 0,
        change: Number(data.compareToPreviousClosePrice) || 0,
        changePercent: Number(data.fluctuationsRatio) || 0,
        volume: Number(data.accumulatedTradingVolume) || 0,
      };
    } catch (error) {
      logger.warn(`NaverStockApiAdapter.getStockPrice failed for ${code}, using mock`);
      return this.getMockPrice(code);
    }
  }

  async getStockDetail(code: string): Promise<StockDetailData | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/stock/${code}/basic`, {
        headers: this.headers,
        timeout: 5000,
      });

      const data = response.data;
      return {
        currentPrice: Number(data.closePrice) || 0,
        change: Number(data.compareToPreviousClosePrice) || 0,
        changePercent: Number(data.fluctuationsRatio) || 0,
        volume: Number(data.accumulatedTradingVolume) || 0,
        high: Number(data.highPrice) || 0,
        low: Number(data.lowPrice) || 0,
        open: Number(data.openPrice) || 0,
        marketCap: Number(data.marketValue) || 0,
      };
    } catch (error) {
      logger.error(`NaverStockApiAdapter.getStockDetail failed for ${code}`);
      return null;
    }
  }

  async getChartData(code: string, period: number = 30): Promise<ChartDataPoint[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const formatDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');

      const response = await axios.get(
        `https://api.stock.naver.com/chart/domestic/item/${code}/day?startDateTime=${formatDate(startDate)}000000&endDateTime=${formatDate(endDate)}235959`,
        {
          headers: this.headers,
          timeout: 10000,
        }
      );

      if (Array.isArray(response.data)) {
        return response.data.map((item: any) => {
          // 날짜 파싱: localDate가 없거나 잘못된 경우 대비
          let timeStr = '';
          try {
            if (item.localDate) {
              const date = new Date(item.localDate);
              if (!isNaN(date.getTime())) {
                timeStr = date.toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                });
              } else {
                // 날짜 형식이 다른 경우 시도
                const dateStr = String(item.localDate);
                if (dateStr.length === 8) {
                  // YYYYMMDD 형식
                  const year = dateStr.substring(0, 4);
                  const month = dateStr.substring(4, 6);
                  const day = dateStr.substring(6, 8);
                  const date = new Date(`${year}-${month}-${day}`);
                  timeStr = date.toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  });
                } else {
                  timeStr = dateStr;
                }
              }
            } else {
              // localDate가 없는 경우 현재 날짜 사용
              const date = new Date();
              date.setDate(date.getDate() - (response.data.length - response.data.indexOf(item)));
              timeStr = date.toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric',
              });
            }
          } catch (error) {
            // 파싱 실패 시 기본값
            const date = new Date();
            date.setDate(date.getDate() - (response.data.length - response.data.indexOf(item)));
            timeStr = date.toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
            });
          }

          return {
            time: timeStr,
            value: Number(item.closePrice) || 0,
            volume: Number(item.accumulatedTradingVolume) || 0,
          };
        });
      }

      throw new DatabaseError('Invalid chart data');
    } catch (error) {
      logger.warn(`NaverStockApiAdapter.getChartData failed for ${code}, using mock`);
      return this.getMockChartData(code, period);
    }
  }

  async searchStocks(query: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`,
        {
          headers: this.headers,
          timeout: 5000,
        }
      );

      return response.data.items || [];
    } catch (error) {
      logger.warn(`NaverStockApiAdapter.searchStocks failed for ${query}`);
      return [];
    }
  }

  private getMockPrice(code: string): StockPriceData {
    const basePrice = BASE_PRICES[code] || 50000;
    const changePercent = (Math.random() - 0.5) * 6;
    const change = Math.round((basePrice * changePercent) / 100);

    return {
      currentPrice: basePrice + change,
      change,
      changePercent: Number(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 5000000) + 500000,
    };
  }

  private getMockChartData(code: string, period: number): ChartDataPoint[] {
    const basePrice = BASE_PRICES[code] || 50000;
    const chartData: ChartDataPoint[] = [];

    for (let i = period; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variation = (Math.random() - 0.5) * basePrice * 0.1;

      chartData.push({
        time: date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        value: Math.round(basePrice + variation),
        volume: Math.floor(Math.random() * 5000000) + 500000,
      });
    }

    return chartData;
  }
}
