import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 사용자 활동 Mock 데이터 생성
 * - Portfolio (포트폴리오)
 * - Favorite (즐겨찾기)
 * - History (조회 기록)
 * - NewsUserActivity (뉴스 활동: 읽기, 좋아요, 즐겨찾기)
 */
async function main() {
  console.log('사용자 활동 Mock 데이터 생성 시작...');

  // 사용자 조회 (없으면 생성)
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });
    console.log('테스트 사용자 생성:', user.id);
  }

  // 주식 데이터 조회
  const stocks = await prisma.stock.findMany({
    take: 10,
  });

  if (stocks.length === 0) {
    console.log('⚠️ 주식 데이터가 없습니다. 먼저 db:seed를 실행하세요.');
    return;
  }

  // 뉴스 데이터 조회
  const news = await prisma.news.findMany({
    take: 10,
  });

  // 기존 데이터 삭제
  await prisma.portfolio.deleteMany({ where: { userId: user.id } });
  await prisma.favorite.deleteMany({ where: { userId: user.id } });
  await prisma.history.deleteMany({ where: { userId: user.id } });
  await prisma.newsUserActivity.deleteMany({ where: { userId: user.id } });

  console.log('기존 사용자 활동 데이터 삭제 완료');

  // ============================================
  // Portfolio 데이터 생성 (5개)
  // ============================================
  const portfolioStocks = stocks.slice(0, 5);
  for (const stock of portfolioStocks) {
    const quantity = Math.floor(Math.random() * 10) + 1; // 1~10주
    const averagePrice = stock.currentPrice * (0.8 + Math.random() * 0.4); // 현재가의 80%~120%
    const totalCost = quantity * averagePrice;
    const currentValue = quantity * stock.currentPrice;
    const profit = currentValue - totalCost;
    const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    await prisma.portfolio.create({
      data: {
        userId: user.id,
        stockId: stock.id,
        quantity,
        averagePrice,
        totalCost,
        currentValue,
        profit,
        profitRate,
      },
    });
  }
  console.log(`✅ 포트폴리오 데이터 ${portfolioStocks.length}개 생성 완료`);

  // ============================================
  // Favorite 데이터 생성 (8개)
  // ============================================
  const favoriteStocks = stocks.slice(0, 8);
  for (const stock of favoriteStocks) {
    await prisma.favorite.create({
      data: {
        userId: user.id,
        stockId: stock.id,
      },
    });
  }
  console.log(`✅ 즐겨찾기 데이터 ${favoriteStocks.length}개 생성 완료`);

  // ============================================
  // History 데이터 생성 (15개)
  // ============================================
  const historyStocks = stocks.slice(0, 15);
  for (let i = 0; i < historyStocks.length; i++) {
    const stock = historyStocks[i];
    const viewedAt = new Date();
    viewedAt.setDate(viewedAt.getDate() - i); // 최근 15일간의 기록

    await prisma.history.create({
      data: {
        userId: user.id,
        stockId: stock.id,
        type: 'view',
        viewedAt,
      },
    });
  }
  console.log(`✅ 조회 기록 데이터 ${historyStocks.length}개 생성 완료`);

  // ============================================
  // NewsUserActivity 데이터 생성
  // ============================================
  if (news.length > 0) {
    // 읽기 기록 (10개)
    const readNews = news.slice(0, 10);
    for (const newsItem of readNews) {
      await prisma.newsUserActivity.create({
        data: {
          userId: user.id,
          newsId: newsItem.id,
          type: 'read',
        },
      });
    }
    console.log(`✅ 뉴스 읽기 기록 ${readNews.length}개 생성 완료`);

    // 좋아요 (5개)
    const likedNews = news.slice(0, 5);
    for (const newsItem of likedNews) {
      await prisma.newsUserActivity.create({
        data: {
          userId: user.id,
          newsId: newsItem.id,
          type: 'like',
        },
      });
    }
    console.log(`✅ 뉴스 좋아요 ${likedNews.length}개 생성 완료`);

    // 즐겨찾기 (3개)
    const favoritedNews = news.slice(0, 3);
    for (const newsItem of favoritedNews) {
      await prisma.newsUserActivity.create({
        data: {
          userId: user.id,
          newsId: newsItem.id,
          type: 'favorite',
        },
      });
    }
    console.log(`✅ 뉴스 즐겨찾기 ${favoritedNews.length}개 생성 완료`);
  } else {
    console.log('⚠️ 뉴스 데이터가 없습니다. 먼저 db:seed:news를 실행하세요.');
  }

  console.log('✅ 사용자 활동 Mock 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

