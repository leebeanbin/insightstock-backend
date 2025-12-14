import { createApp, setAppInstance } from './app';
import { logger } from './config/logger';
import { prisma } from './config/prisma';

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

// Start server
const start = async () => {
  try {
    // 앱 생성 (플러그인 포함)
    const app = await createApp();
    setAppInstance(app);

    // Rate Limiting 설정 (서버 시작 전)
    const { setupRateLimit } = await import('./middlewares/rateLimit');
    await setupRateLimit(app);

    // 작업 파이프라인 등록
    const { registerAllJobs } = await import('./jobs');
    await registerAllJobs();
    logger.info('✅ All pipeline jobs registered');

    await app.listen({ port: PORT, host: HOST });
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  // 앱 인스턴스 가져오기
  const { getAppInstance } = await import('./app');
  const app = getAppInstance();
  
  if (app) {
  // 새로운 연결 거부
  app.server.close(() => {
    logger.info('Server stopped accepting new connections');
  });
  }

  // WebSocket, 메시지 큐, 파이프라인 정리
  try {
    const { getQueueManager } = await import('./queues/QueueManager');
    const queueManager = getQueueManager();
    await queueManager.cleanup();
    logger.info('QueueManager cleaned up');
  } catch (error) {
    logger.warn('Error during service cleanup:', error);
  }

  // 기존 연결 종료 대기 (최대 10초)
  setTimeout(async () => {
    const { getAppInstance } = await import('./app');
    const app = getAppInstance();
    
    if (app) {
    await app.close();
    logger.info('Fastify server closed');
    }

    await prisma.$disconnect();
    logger.info('Database connection closed');

    process.exit(0);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
