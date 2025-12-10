import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 주가 히스토리 Mock 데이터 생성
 * - StockPrice (과거 주가 데이터)
 */
async function main() {
  console.log('주가 히스토리 Mock 데이터 생성 시작...');

  // 주식 데이터 조회 (인기 종목 5개)
  const stocks = await prisma.stock.findMany({
    where: {
      code: {
        in: ['005930', '000660', '035420', '005380', '373220'], // 삼성전자, SK하이닉스, NAVER, 현대차, LG에너지솔루션
      },
    },
  });

  if (stocks.length === 0) {
    console.log('⚠️ 주식 데이터가 없습니다. 먼저 db:seed를 실행하세요.');
    return;
  }

  // 각 종목별로 최근 30일간의 주가 데이터 생성
  for (const stock of stocks) {
    // 기존 주가 데이터 삭제
    await prisma.stockPrice.deleteMany({
      where: { stockId: stock.id },
    });

    const prices = [];
    let currentPrice = stock.currentPrice;

    // 최근 30일간의 데이터 생성
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(9, 0, 0, 0); // 장 시작 시간

      // 전일 대비 변동률 (-5% ~ +5%)
      const changePercent = (Math.random() - 0.5) * 10;
      const change = (currentPrice * changePercent) / 100;
      const newPrice = currentPrice + change;

      // OHLC 데이터 생성
      const open = currentPrice;
      const high = newPrice * (1 + Math.random() * 0.03); // 최대 3% 상승
      const low = newPrice * (1 - Math.random() * 0.03); // 최대 3% 하락
      const close = newPrice;
      const volume = BigInt(Math.floor(Math.random() * 5000000) + 500000);

      prices.push({
        stockId: stock.id,
        date,
        open,
        high,
        low,
        close,
        volume,
        change,
        changeRate: changePercent,
      });

      currentPrice = close; // 다음 날 시작가
    }

    // 일괄 생성
    await prisma.stockPrice.createMany({
      data: prices,
    });

    console.log(`✅ ${stock.name} (${stock.code}) 주가 데이터 ${prices.length}개 생성 완료`);
  }

  console.log('✅ 주가 히스토리 Mock 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

