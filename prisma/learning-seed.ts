import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 학습 Q&A Mock 데이터 생성
 */
async function main() {
  console.log('학습 Q&A Mock 데이터 생성 시작...');

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

  // 기존 학습 데이터 삭제
  await prisma.learning.deleteMany({
    where: { userId: user.id },
  });

  // Mock 학습 Q&A 데이터
  const mockLearnings = [
    {
      concept: 'PER (주가수익비율)',
      question: 'PER이 뭔가요?',
      answer: `PER(Price-to-Earnings Ratio)은 주가를 주당순이익(EPS)으로 나눈 값입니다.

## 왜 중요한가?
기업의 밸류에이션을 평가하는 가장 기본적인 지표로, 주가가 비싼지 싼지 판단할 수 있어요.

## 종목/업종 예시:
• 삼성전자 PER: 15배 (2024년 기준)
• IT 업종 평균: 20배
• 금융 업종 평균: 8배

## 실수하기 쉬운 포인트:
PER이 낮다고 무조건 좋은 건 아닙니다. 적자 기업은 PER을 계산할 수 없어요. 또한 업종별로 평균 PER이 다르므로 같은 업종 내에서 비교하는 것이 중요합니다.`,
      relatedStocks: ['005930', '000660', '035420'], // 삼성전자, SK하이닉스, NAVER
    },
    {
      concept: '배당금',
      question: '배당금은 어떻게 받나요?',
      answer: `배당금은 기업이 주주에게 이익을 나눠주는 것입니다.

## 배당금 받는 방법:
1. 배당락일 기준으로 주식을 보유해야 함
2. 배당락일 전날까지 주식을 보유하면 자동으로 배당금 지급
3. 보통 배당락일 후 1-2주 내 계좌로 입금

## 배당률 계산:
배당률 = (연간 배당금 / 주가) × 100
예: 주가 10만원, 연간 배당금 3천원 → 배당률 3%

## 세금:
배당소득세 15.4% (연간 200만원 초과 시)

## 주의사항:
배당락일에는 주가가 배당금만큼 하락합니다. 배당금을 받아도 실제 자산은 변하지 않아요.`,
      relatedStocks: ['005380', '000270', '028260'], // 현대차, 기아, 삼성물산
    },
    {
      concept: 'RSI 지표',
      question: 'RSI 지표는 무엇인가요?',
      answer: `RSI(Relative Strength Index)는 주가의 상승/하락 강도를 측정하는 기술적 지표입니다.

## RSI 계산:
RSI = 100 - (100 / (1 + RS))
RS = 평균 상승폭 / 평균 하락폭

## 해석:
• RSI 70 이상: 과매수 구간 (매도 고려)
• RSI 30 이하: 과매도 구간 (매수 고려)
• RSI 50: 중립

## 사용 예시:
삼성전자 주가가 급등하면서 RSI가 75를 넘으면, 단기 조정 가능성이 높아요.

## 주의사항:
RSI는 추세장에서 오래 지속될 수 있습니다. 강한 상승 추세에서는 RSI 70을 넘어도 계속 오를 수 있어요.`,
      relatedStocks: ['005930', '035420', '000660'], // 삼성전자, NAVER, SK하이닉스
    },
    {
      concept: 'PBR (주가순자산비율)',
      question: 'PBR이 1 미만이면 좋은 건가요?',
      answer: `PBR(Price-to-Book Ratio) 1 미만은 자산보다 싸게 거래되는 것을 의미합니다.

## PBR 계산:
PBR = 주가 / 주당순자산(BPS)
BPS = 순자산 / 발행주식수

## PBR 1 미만의 의미:
• 자산의 가치보다 주가가 낮음
• 이론적으로는 저평가
• 하지만 항상 좋은 것은 아님

## 주의사항:
1. 자산 가치가 실제로 실현 가능한지 확인 필요
2. 부채가 많으면 순자산이 줄어듦
3. 무형자산(브랜드, 특허)은 자산에 포함되지 않음

## 예시:
은행주는 보통 PBR 0.5~0.8 수준으로 거래됩니다. 이는 자산의 실현 가능성이 낮기 때문입니다.`,
      relatedStocks: ['055550', '105560', '086790'], // 신한지주, KB금융, 하나금융
    },
    {
      concept: '시가총액',
      question: '시가총액이 뭔가요?',
      answer: `시가총액은 기업의 전체 가치를 나타내는 지표입니다.

## 계산 방법:
시가총액 = 주가 × 발행주식수

## 예시:
삼성전자 주가 65,000원, 발행주식수 5,969억주
→ 시가총액 = 65,000 × 5,969억 = 약 388조원

## 의미:
• 기업을 통째로 사는데 필요한 금액
• 시장에서 기업의 크기를 나타냄
• 코스피 지수 계산에 사용됨

## 활용:
• 대형주: 시가총액 1조원 이상
• 중형주: 시가총액 1천억~1조원
• 소형주: 시가총액 1천억원 미만

## 주의:
시가총액이 크다고 좋은 기업은 아닙니다. 성장 가능성과 수익성을 함께 봐야 해요.`,
      relatedStocks: ['005930', '000660', '035420'], // 삼성전자, SK하이닉스, NAVER
    },
    {
      concept: '거래량',
      question: '거래량이 많으면 좋은 건가요?',
      answer: `거래량은 특정 기간 동안 거래된 주식의 수량입니다.

## 거래량의 의미:
• 많은 사람들이 관심을 가지고 있다는 신호
• 유동성이 높다는 의미
• 가격 변동성이 클 수 있음

## 거래량 분석:
• 평소보다 거래량이 급증 → 중요한 변화 신호
• 상승 + 거래량 증가 → 강한 상승 추세
• 하락 + 거래량 증가 → 강한 하락 추세

## 주의사항:
거래량이 많다고 항상 좋은 것은 아닙니다. 급등 후 거래량이 급증하면 조정 신호일 수 있어요.

## 예시:
삼성전자 평소 거래량 500만주인데, 어느 날 1,500만주로 급증했다면 큰 뉴스나 이벤트가 있을 가능성이 높습니다.`,
      relatedStocks: ['005930', '000660', '035420'], // 삼성전자, SK하이닉스, NAVER
    },
  ];

  // 학습 데이터 생성
  for (const learning of mockLearnings) {
    await prisma.learning.create({
      data: {
        userId: user.id,
        ...learning,
      },
    });
  }

  console.log(`✅ ${mockLearnings.length}개의 학습 Q&A 데이터 생성 완료`);
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

