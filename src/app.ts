import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import dotenv from 'dotenv';
import { logger } from './config/logger';

// Load environment variables
dotenv.config();

/**
 * Fastify 앱 생성 및 설정
 * 플러그인을 await로 등록하여 순서 보장
 */
export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify instance
  const app = Fastify({
    logger: false, // Use Winston instead
    keepAliveTimeout: 65000, // 65초 (기본값보다 약간 길게)
    connectionTimeout: 60000, // 60초 연결 타임아웃
    requestTimeout: 30000, // 30초 요청 타임아웃
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(sensible);

  // WebSocket 지원 (전역으로 한 번만 등록)
  await app.register(require('@fastify/websocket'));

  // Cache Plugin (라우트 레벨 자동 캐싱) - await로 등록하여 완료 보장
  const cachePlugin = (await import('./plugins/cache-plugin')).default;
  await app.register(cachePlugin);

  // Validation Plugin (Zod 스키마 검증)
  const validationPlugin = (await import('./plugins/validation-plugin')).default;
  await app.register(validationPlugin);

  // Performance tracking (AOP)
  const { setupPerformanceTracking } = await import('./middlewares/performance');
  setupPerformanceTracking(app);

  // Response Interceptor (Request/Response 표준화 및 로깅)
  const { setupResponseInterceptor } = await import('./middlewares/response-interceptor');
  setupResponseInterceptor(app);

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Client logging endpoint (프론트엔드 로그 수집)
  app.post('/api/log', async (request, reply) => {
    const body = request.body as {
      level: 'debug' | 'info' | 'warn' | 'error';
      message: string;
      metadata?: Record<string, any>;
      url?: string;
      userAgent?: string;
    };

    const logData = {
      message: body.message,
      ...(body.metadata && { metadata: body.metadata }),
      ...(body.url && { url: body.url }),
      ...(body.userAgent && { userAgent: body.userAgent }),
      ...((request as any).userId && { userId: (request as any).userId }),
      ip: request.ip,
    };

    switch (body.level) {
      case 'debug':
        logger.debug(`[CLIENT] ${JSON.stringify(logData)}`);
        break;
      case 'info':
        logger.info(`[CLIENT] ${JSON.stringify(logData)}`);
        break;
      case 'warn':
        logger.warn(`[CLIENT] ${JSON.stringify(logData)}`);
        break;
      case 'error':
        logger.error(`[CLIENT] ${JSON.stringify(logData)}`);
        break;
      default:
        logger.info(`[CLIENT] ${JSON.stringify(logData)}`);
    }

    reply.send({ success: true });
  });

  // Batch logging endpoint (배치 로그 수집)
  app.post('/api/log/batch', async (request, reply) => {
    const body = request.body as {
      logs: Array<{
        level: 'debug' | 'info' | 'warn' | 'error';
        message: string;
        metadata?: Record<string, any>;
      }>;
    };

    body.logs.forEach((log) => {
      const logData = {
        message: log.message,
        ...(log.metadata && { metadata: log.metadata }),
        ...((request as any).userId && { userId: (request as any).userId }),
        ip: request.ip,
      };

      switch (log.level) {
        case 'debug':
          logger.debug(`[CLIENT] ${JSON.stringify(logData)}`);
          break;
        case 'info':
          logger.info(`[CLIENT] ${JSON.stringify(logData)}`);
          break;
        case 'warn':
          logger.warn(`[CLIENT] ${JSON.stringify(logData)}`);
          break;
        case 'error':
          logger.error(`[CLIENT] ${JSON.stringify(logData)}`);
          break;
        default:
          logger.info(`[CLIENT] ${JSON.stringify(logData)}`);
      }
    });

    reply.send({ success: true, count: body.logs.length });
  });

  // API Routes
  const portfolioRoutes = (await import('./routes/PortfolioRoutes')).default;
  const stockRoutes = (await import('./routes/StockRoutes')).default;
  const marketRoutes = (await import('./routes/MarketRoutes')).default;
  const favoriteRoutes = (await import('./routes/FavoriteRoutes')).default;
  const historyRoutes = (await import('./routes/HistoryRoutes')).default;
  const chatRoutes = (await import('./routes/ChatRoutes')).default;
  const newsRoutes = (await import('./routes/NewsRoutes')).default;
  const userActivityRoutes = (await import('./routes/UserActivityRoutes')).default;
  const learningRoutes = (await import('./routes/LearningRoutes')).default;
  const noteRoutes = (await import('./routes/NoteRoutes')).default;
  const imageRoutes = (await import('./routes/ImageRoutes')).default;
  const searchRoutes = (await import('./routes/SearchRoutes')).default;
  const monitoringRoutes = (await import('./routes/MonitoringRoutes')).default;
  const logRoutes = (await import('./routes/LogRoutes')).default;

  await app.register(portfolioRoutes, { prefix: '/api/portfolio' });
  await app.register(stockRoutes, { prefix: '/api/stocks' });
  await app.register(marketRoutes, { prefix: '/api/market' });
  await app.register(favoriteRoutes, { prefix: '/api/favorites' });
  await app.register(historyRoutes, { prefix: '/api/history' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(newsRoutes, { prefix: '/api/news' });
  await app.register(userActivityRoutes, { prefix: '/api/user-activity' });
  await app.register(learningRoutes, { prefix: '/api/learning' });
  await app.register(noteRoutes, { prefix: '/api/notes' });
  await app.register(imageRoutes, { prefix: '/api/images' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(monitoringRoutes, { prefix: '/api/monitoring' });
  await app.register(logRoutes, { prefix: '/api/logs' });

  // Global Error Handler
  const { errorHandler } = await import('./middlewares/error-handler');
  app.setErrorHandler(errorHandler);

  return app;
}

// 하위 호환성을 위한 기본 export (비동기 초기화 필요)
let appInstance: FastifyInstance | null = null;

export default new Proxy({} as FastifyInstance, {
  get(target, prop) {
    if (!appInstance) {
      throw new Error('App not initialized. Call createApp() first.');
    }
    return (appInstance as any)[prop];
  },
});

// 앱 인스턴스 설정 (server.ts에서 호출)
export function setAppInstance(app: FastifyInstance) {
  appInstance = app;
}

// 앱 인스턴스 가져오기
export function getAppInstance(): FastifyInstance | null {
  return appInstance;
}
