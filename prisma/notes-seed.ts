import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 노트 Mock 데이터 생성
 */
async function main() {
  console.log('노트 Mock 데이터 생성 시작...');

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

  // 기존 노트 삭제
  await prisma.note.deleteMany({
    where: { userId: user.id },
  });

  // Mock 노트 데이터
  const mockNotes = [
    {
      title: 'PER과 PBR의 차이점',
      content: `PER(Price-to-Earnings Ratio)과 PBR(Price-to-Book Ratio)는 주식 투자에서 가장 기본적인 밸류에이션 지표입니다.

## PER (주가수익비율)
- 주가를 주당순이익(EPS)으로 나눈 값
- 기업의 수익성 대비 주가가 비싼지 싼지 판단
- 낮을수록 저평가, 높을수록 고평가
- 예: PER 10배 = 주가가 1년 수익의 10배

## PBR (주가순자산비율)
- 주가를 주당순자산(BPS)으로 나눈 값
- 기업의 자산 대비 주가가 비싼지 싼지 판단
- 1배 미만이면 자산보다 싸게 거래되는 것
- 예: PBR 0.8배 = 자산의 80% 가격에 거래

## 차이점
- PER: 수익성 중심 (미래 수익 기대)
- PBR: 자산 중심 (현재 자산 가치)

두 지표를 함께 보면 더 정확한 판단이 가능합니다.`,
      tags: ['PER', 'PBR', '밸류에이션', '기초'],
    },
    {
      title: '배당락일 투자 전략',
      content: `배당락일은 배당금을 받기 위해 주식을 보유해야 하는 마지막 날입니다.

## 배당락일의 의미
- 배당락일 이전에 주식을 보유해야 배당금 수령 가능
- 배당락일 당일 주가가 배당금만큼 하락 (배당락)
- 배당락일 이후 매도해도 배당금은 받을 수 있음

## 투자 전략
1. 배당락일 전 매수 → 배당락일 후 매도
   - 배당금 수령 + 주가 회복 기대
   - 단기 투자 전략

2. 배당락일 전 매도
   - 배당락으로 인한 주가 하락 회피
   - 배당금은 포기

3. 장기 보유
   - 배당락은 일시적 현상
   - 장기적으로는 회복되는 경우가 많음

## 주의사항
- 배당락일 전후 주가 변동성 증가
- 세금 고려 필요 (배당소득세)
- 배당락일만 노리는 투자는 위험할 수 있음`,
      tags: ['배당', '배당락일', '투자전략', '기초'],
    },
    {
      title: 'RSI 지표 활용법',
      content: `RSI(Relative Strength Index)는 기술적 분석의 대표적인 모멘텀 지표입니다.

## RSI란?
- 0~100 사이의 값을 가짐
- 70 이상: 과매수 구간 (매도 신호)
- 30 이하: 과매도 구간 (매수 신호)
- 14일 기준이 가장 많이 사용됨

## 활용 방법
1. 단독 사용
   - RSI 70 이상: 매도 고려
   - RSI 30 이하: 매수 고려
   - 단, 추세장에서는 신뢰도 낮음

2. 다이버전스 활용
   - 주가는 상승, RSI는 하락 → 약세 다이버전스 (매도 신호)
   - 주가는 하락, RSI는 상승 → 강세 다이버전스 (매수 신호)

3. 추세 확인
   - RSI 50 이상: 상승 추세
   - RSI 50 이하: 하락 추세

## 주의사항
- 강한 추세장에서는 RSI가 오래 과매수/과매도 구간에 머물 수 있음
- 다른 지표와 함께 사용하는 것이 좋음
- 거래량, 이동평균선 등과 함께 분석`,
      tags: ['RSI', '기술적분석', '모멘텀', '중급'],
    },
    {
      title: '시가총액의 의미',
      content: `시가총액은 기업의 전체 가치를 나타내는 지표입니다.

## 시가총액 계산
시가총액 = 주가 × 발행주식수

예: 주가 10,000원 × 발행주식수 1억주 = 10조원

## 시가총액의 의미
- 기업의 전체 가치
- 시장에서 인정받는 기업 가치
- 대형주/중형주/소형주 구분 기준

## 분류
- 대형주: 시가총액 1조원 이상
- 중형주: 시가총액 1,000억원 ~ 1조원
- 소형주: 시가총액 1,000억원 미만

## 투자 관점
- 대형주: 안정적, 변동성 낮음
- 중형주: 성장 가능성, 적당한 변동성
- 소형주: 높은 성장 가능성, 높은 변동성

시가총액만으로는 부족하고, PER, PBR 등과 함께 봐야 합니다.`,
      tags: ['시가총액', '기초', '밸류에이션'],
    },
  ];

  // 노트 생성
  for (const noteData of mockNotes) {
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags,
      },
    });
    console.log(`노트 생성: ${note.title}`);
  }

  console.log('노트 Mock 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

