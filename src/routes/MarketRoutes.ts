import { FastifyPluginAsync } from 'fastify';
import { MarketController } from '../controllers/MarketController';
import { MarketService } from '../services/MarketService';
import { logger } from '../config/logger';

// Dependency Injection
const marketFacade = new MarketService();
const marketController = new MarketController(marketFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // Market routes don't require authentication
  
  // 시장 데이터 조회 (10초 캐시 - 실시간 데이터)
  fastify.get('/', {
    preHandler: (fastify as any).cache(10),
  }, async (request, reply) => {
    try {
      await marketController.getMarketData(request, reply);
    } catch (error) {
      // ECONNRESET 등 연결 에러 처리
      if ((error as any)?.code === 'ECONNRESET') {
        logger.warn('Client connection reset during market data request');
        return;
      }
      throw error;
    }
  });

  // WebSocket 스트림 엔드포인트
  // @ts-ignore - @fastify/websocket 타입 정의 문제로 인한 임시 처리
  fastify.get('/stream', { websocket: true }, async (connection: any, request: any) => {
    logger.info('Market WebSocket connection opened');
    
    // socket 참조를 안전하게 저장 (Fastify WebSocket의 경우 connection 자체가 socket일 수 있음)
    const socket = connection?.socket || connection;
    if (!socket) {
      logger.error('WebSocket connection has no socket');
      return;
    }

    let interval: NodeJS.Timeout | null = null;
    let isClosed = false;

    // 연결 성공 시 초기 데이터 전송
    try {
      const initialData = await marketFacade.getMarketData();
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify({
          kospi: initialData.kospi,
          kosdaq: initialData.kosdaq,
          usdKrw: initialData.usdKrw,
        }));
      }
    } catch (error) {
      logger.error('Failed to send initial market data:', error);
    }

    // 주기적으로 Market 데이터 업데이트 전송 (10초마다)
    interval = setInterval(async () => {
      try {
        // 연결이 닫혔거나 유효하지 않으면 interval 정리
        if (isClosed || !socket || socket.readyState !== 1) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          return;
        }

        const data = await marketFacade.getMarketData();
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            kospi: data.kospi,
            kosdaq: data.kosdaq,
            usdKrw: data.usdKrw,
          }));
        }
      } catch (error) {
        logger.error('Failed to send market data update:', error);
        // 에러 발생 시 interval 정리
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    }, 10000); // 10초마다 업데이트

    // 클라이언트로부터 메시지 수신 (구독 요청 등)
    socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.action === 'subscribe') {
          logger.info('Market WebSocket subscription received:', data.channels);
          // 구독 확인 메시지 전송
          if (!isClosed && socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
              type: 'subscribed',
              channels: data.channels || ['kospi', 'kosdaq', 'usdKrw'],
            }));
          }
        }
      } catch (error) {
        logger.warn('Invalid WebSocket message received:', error);
      }
    });

    // 연결 종료 시 정리
    socket.on('close', () => {
      logger.info('Market WebSocket connection closed');
      isClosed = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    });

    // 에러 처리
    socket.on('error', (error: any) => {
      logger.error('Market WebSocket error:', error);
      isClosed = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    });
  });
};

export default routes;
