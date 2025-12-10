import { PrismaClient } from '@prisma/client';
import { prismaExtensions } from './prisma-extensions';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Prisma Client 생성
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection Pool 설정 (대규모 처리 최적화)
  // 참고: Prisma는 내부적으로 connection pooling을 관리하므로
  // DATABASE_URL에 connection_limit 파라미터를 추가하는 것이 더 효과적
  // 예: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
});

// Extensions 적용 (Middleware 로직이 Extension 내부에 포함됨)
const prismaWithExtensions = basePrisma.$extends(prismaExtensions);

export const prisma = global.prisma || prismaWithExtensions;

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
