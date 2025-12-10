import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock 주식 데이터
const POPULAR_STOCKS = {
  '인기': [
    { code: '005930', name: '삼성전자', market: 'KOSPI', sector: 'IT' },
    { code: '000660', name: 'SK하이닉스', market: 'KOSPI', sector: 'IT' },
    { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI', sector: '2차전지' },
    { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', sector: '바이오' },
    { code: '005380', name: '현대차', market: 'KOSPI', sector: '자동차' },
    { code: '000270', name: '기아', market: 'KOSPI', sector: '자동차' },
    { code: '035420', name: 'NAVER', market: 'KOSPI', sector: 'IT' },
    { code: '035720', name: '카카오', market: 'KOSPI', sector: 'IT' },
    { code: '051910', name: 'LG화학', market: 'KOSPI', sector: '화학' },
    { code: '006400', name: '삼성SDI', market: 'KOSPI', sector: '2차전지' },
    { code: '034730', name: 'SK', market: 'KOSPI', sector: 'IT' },
    { code: '036570', name: '엔씨소프트', market: 'KOSPI', sector: 'IT' },
    { code: '105560', name: 'KB금융', market: 'KOSPI', sector: '금융' },
    { code: '055550', name: '신한지주', market: 'KOSPI', sector: '금융' },
    { code: '086790', name: '하나금융지주', market: 'KOSPI', sector: '금융' },
    { code: '068270', name: '셀트리온', market: 'KOSPI', sector: '바이오' },
    { code: '003550', name: 'LG', market: 'KOSPI', sector: '지주' },
    { code: '012330', name: '현대모비스', market: 'KOSPI', sector: '자동차부품' },
    { code: '352820', name: '하이브', market: 'KOSPI', sector: '엔터테인먼트' },
    { code: '259960', name: '크래프톤', market: 'KOSPI', sector: '게임' },
    { code: '247540', name: '에코프로비엠', market: 'KOSDAQ', sector: '2차전지' },
    { code: '086520', name: '에코프로', market: 'KOSDAQ', sector: '2차전지' },
    { code: '003670', name: '포스코퓨처엠', market: 'KOSPI', sector: '2차전지' },
    { code: '302440', name: 'SK바이오사이언스', market: 'KOSPI', sector: '바이오' },
    { code: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ', sector: '바이오' },
    { code: '145020', name: '휴젤', market: 'KOSDAQ', sector: '바이오' },
    { code: '316140', name: '우리금융지주', market: 'KOSPI', sector: '금융' },
    { code: '024110', name: '기업은행', market: 'KOSPI', sector: '금융' },
    { code: '018880', name: '한온시스템', market: 'KOSPI', sector: '자동차부품' },
    { code: '161390', name: '한국타이어앤테크놀로지', market: 'KOSPI', sector: '자동차부품' },
    { code: '041510', name: 'SM', market: 'KOSPI', sector: '엔터테인먼트' },
    { code: '122870', name: 'YG엔터테인먼트', market: 'KOSPI', sector: '엔터테인먼트' },
    { code: '035900', name: 'JYP엔터테인먼트', market: 'KOSPI', sector: '엔터테인먼트' },
    { code: '034120', name: 'CJ ENM', market: 'KOSPI', sector: '미디어' },
    { code: '263750', name: '펄어비스', market: 'KOSPI', sector: '게임' },
  ],
};

// Mock 가격 데이터
const BASE_PRICES: Record<string, number> = {
  '005930': 71000,
  '000660': 178000,
  '373220': 370000,
  '207940': 780000,
  '005380': 210000,
  '000270': 95000,
  '035420': 180000,
  '035720': 42000,
  '051910': 450000,
  '006400': 380000,
  '034730': 150000,
  '036570': 550000,
  '105560': 65000,
  '055550': 45000,
  '086790': 50000,
  '068270': 200000,
  '003550': 120000,
  '012330': 250000,
  '352820': 180000,
  '259960': 200000,
  '247540': 400000,
  '086520': 120000,
  '003670': 350000,
  '302440': 150000,
  '091990': 80000,
  '145020': 60000,
  '316140': 14000,
  '024110': 12000,
  '018880': 80000,
  '161390': 40000,
  '041510': 5000,
  '122870': 30000,
  '035900': 70000,
  '034120': 80000,
  '263750': 36000,
};

async function main() {
  console.log('🌱 Seeding database...');
  
  // 기존 데이터 초기화
  console.log('🗑️  Clearing existing data...');
  await prisma.stockPrice.deleteMany({});
  await prisma.stock.deleteMany({});
  console.log('✅ Existing data cleared');

  // 모든 주식 데이터 수집
  const allStocks = Object.values(POPULAR_STOCKS).flat();
  const uniqueStocks = allStocks.filter(
    (stock, index, self) => self.findIndex((s) => s.code === stock.code) === index
  );

  // 주식 데이터 생성
  for (const stock of uniqueStocks) {
    const basePrice = BASE_PRICES[stock.code] || 50000;
    const changePercent = (Math.random() - 0.5) * 6; // -3% ~ +3%
    const change = Math.round((basePrice * changePercent) / 100);
    const currentPrice = basePrice + change;
    const volume = BigInt(Math.floor(Math.random() * 5000000) + 500000);
    const marketCap = BigInt(Math.floor(currentPrice * 1000000));

    await prisma.stock.upsert({
      where: { code: stock.code },
      update: {
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        currentPrice,
        change,
        changeRate: Number(changePercent.toFixed(2)),
        volume,
        marketCap,
        currency: 'KRW', // 명시적으로 currency 설정
      },
      create: {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        currentPrice,
        change,
        changeRate: Number(changePercent.toFixed(2)),
        volume,
        marketCap,
        currency: 'KRW', // 명시적으로 currency 설정
        description: `${stock.name}(${stock.code})에 대한 정보입니다.`,
      },
    });

    // 최근 1년(365일) 가격 데이터 생성 (일봉)
    const prices = [];
    let previousClose = basePrice; // 이전 종가를 추적하여 연속성 유지
    
    for (let i = 365; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      // 이전 종가를 기준으로 변동 (더 현실적인 가격 흐름)
      const dailyVariation = (Math.random() - 0.5) * basePrice * 0.08; // 일일 변동폭
      const open = Math.max(previousClose + dailyVariation, basePrice * 0.5); // 최소 가격 보장
      
      // 종가는 시가 기준으로 변동
      const closeVariation = (Math.random() - 0.5) * basePrice * 0.05;
      const close = Math.max(open + closeVariation, basePrice * 0.5); // 최소 가격 보장
      
      // 고가는 open과 close 중 큰 값보다 크게, 저가는 작은 값보다 작게
      const highVariation = Math.random() * basePrice * 0.03; // 0~3% 추가 상승
      const lowVariation = Math.random() * basePrice * 0.03; // 0~3% 추가 하락
      
      const high = Math.max(open, close) + highVariation;
      const low = Math.max(Math.min(open, close) - lowVariation, basePrice * 0.5); // 최소 가격 보장
      
      // OHLC 관계 검증: high >= max(open, close) >= min(open, close) >= low
      const finalHigh = Math.max(high, open, close, low);
      const finalLow = Math.min(low, open, close, finalHigh);
      const finalOpen = Math.max(Math.min(open, finalHigh), finalLow);
      const finalClose = Math.max(Math.min(close, finalHigh), finalLow);
      
      // 모든 값이 0보다 큰지 최종 검증
      if (finalOpen <= 0 || finalHigh <= 0 || finalLow <= 0 || finalClose <= 0) {
        console.warn(`Invalid OHLC values for ${stock.code} on ${date.toISOString()}, skipping...`);
        continue;
      }
      
      const dayVolume = BigInt(Math.floor(Math.random() * 5000000) + 500000);
      const dayChange = finalClose - finalOpen;
      const dayChangeRate = (dayChange / finalOpen) * 100;

      prices.push({
        date,
        open: Number(finalOpen.toFixed(2)),
        high: Number(finalHigh.toFixed(2)),
        low: Number(finalLow.toFixed(2)),
        close: Number(finalClose.toFixed(2)),
        volume: dayVolume,
        change: Number(dayChange.toFixed(2)),
        changeRate: Number(dayChangeRate.toFixed(2)),
      });
      
      // 다음 날의 시가는 이전 날의 종가를 기준으로
      previousClose = finalClose;
    }

    // 주식 ID 조회 후 가격 데이터 생성
    const stockRecord = await prisma.stock.findUnique({
      where: { code: stock.code },
    });

    if (stockRecord) {
      // 기존 가격 데이터 삭제 (최근 1년)
      await prisma.stockPrice.deleteMany({
        where: {
          stockId: stockRecord.id,
          date: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // 새 가격 데이터 일괄 생성 (성능 개선)
      await prisma.stockPrice.createMany({
        data: prices.map(price => ({
          stockId: stockRecord.id,
          date: price.date,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.close,
          volume: price.volume,
          change: price.change,
          changeRate: price.changeRate,
        })),
        skipDuplicates: true, // 중복 데이터 건너뛰기
      });

      // 1일 차트용 시간별 데이터도 생성 (최근 1일)
      const hourlyPrices = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 오늘 일봉 데이터 가져오기
      const todayPrice = prices.find(p => {
        const pDate = new Date(p.date);
        return pDate.toDateString() === today.toDateString();
      }) || prices[prices.length - 1]; // 오늘 데이터가 없으면 마지막 데이터 사용
      
      if (todayPrice) {
        // 장 시작 시간부터 장 마감 시간까지 시간별 데이터 생성 (9시~15시)
        for (let hour = 9; hour <= 15; hour++) {
          const hourDate = new Date(today);
          hourDate.setHours(hour, 0, 0, 0);
          
          // 시간별 가격 변동 (일봉 데이터 기반)
          const hourProgress = (hour - 9) / 6; // 0.0 (9시) ~ 1.0 (15시)
          const hourVariation = (Math.random() - 0.5) * todayPrice.close * 0.02; // ±2% 변동
          
          // 시간대별 가격은 일봉의 시가와 종가 사이를 보간
          const hourBasePrice = todayPrice.open + (todayPrice.close - todayPrice.open) * hourProgress;
          const hourOpen = hourBasePrice + hourVariation;
          const hourClose = hourOpen + (Math.random() - 0.5) * todayPrice.close * 0.01;
          const hourHigh = Math.max(hourOpen, hourClose) * (1 + Math.random() * 0.01);
          const hourLow = Math.min(hourOpen, hourClose) * (1 - Math.random() * 0.01);
          const hourVolume = BigInt(Math.floor(Math.random() * 1000000) + 100000);
          
          // OHLC 검증
          const finalHourHigh = Math.max(hourHigh, hourOpen, hourClose, hourLow);
          const finalHourLow = Math.min(hourLow, hourOpen, hourClose, finalHourHigh);
          const finalHourOpen = Math.max(Math.min(hourOpen, finalHourHigh), finalHourLow);
          const finalHourClose = Math.max(Math.min(hourClose, finalHourHigh), finalHourLow);
          
          if (finalHourOpen <= 0 || finalHourHigh <= 0 || finalHourLow <= 0 || finalHourClose <= 0) {
            continue;
          }
          
          hourlyPrices.push({
            stockId: stockRecord.id,
            date: hourDate,
            open: Number(finalHourOpen.toFixed(2)),
            high: Number(finalHourHigh.toFixed(2)),
            low: Number(finalHourLow.toFixed(2)),
            close: Number(finalHourClose.toFixed(2)),
            volume: hourVolume,
            change: Number((finalHourClose - finalHourOpen).toFixed(2)),
            changeRate: Number(((finalHourClose - finalHourOpen) / finalHourOpen * 100).toFixed(2)),
          });
        }
        
        if (hourlyPrices.length > 0) {
          await prisma.stockPrice.createMany({
            data: hourlyPrices,
            skipDuplicates: true,
          });
        }
      }
    }
  }

  console.log(`✅ Seeded ${uniqueStocks.length} stocks`);
  
  // 뉴스 시드 실행
  console.log('🌱 Seeding news data...');
  const { seedNews } = await import('./news-seed');
  await seedNews();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

