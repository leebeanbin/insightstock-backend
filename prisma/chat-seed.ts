import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 채팅 대화 Mock 데이터 생성
 * - Conversation (대화)
 * - Message (메시지)
 */
async function main() {
  console.log('채팅 대화 Mock 데이터 생성 시작...');

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

  // 기존 대화 데이터 삭제
  await prisma.conversation.deleteMany({
    where: { userId: user.id },
  });

  // Mock 대화 데이터
  const mockConversations = [
    {
      title: 'PER에 대해 궁금해요',
      messages: [
        {
          role: 'user',
          content: 'PER이 뭔가요?',
          sources: [],
        },
        {
          role: 'assistant',
          content: `PER(Price-to-Earnings Ratio)은 주가를 주당순이익(EPS)으로 나눈 값입니다.

## 주요 특징:
- 기업의 밸류에이션을 평가하는 기본 지표
- 낮을수록 저평가, 높을수록 고평가로 해석
- 업종별로 평균 PER이 다르므로 같은 업종 내에서 비교하는 것이 중요

## 예시:
삼성전자의 PER이 15배라면, 주가가 1년 수익의 15배라는 의미입니다.

## 주의사항:
- 적자 기업은 PER을 계산할 수 없음
- 업종별 평균 PER이 다르므로 업종 내 비교 필요
- 미래 성장 가능성도 함께 고려해야 함`,
          sources: [],
        },
        {
          role: 'user',
          content: '그럼 PER이 낮으면 무조건 좋은 건가요?',
          sources: [],
        },
        {
          role: 'assistant',
          content: `꼭 그렇지는 않습니다. PER이 낮은 이유는 여러 가지가 있을 수 있어요:

## PER이 낮은 이유:
1. **실제로 저평가**: 기업 가치 대비 주가가 낮음 (매수 기회)
2. **수익성 저하**: 기업의 수익이 감소하여 PER이 낮아짐 (주의 필요)
3. **업종 특성**: 금융주, 유틸리티 등은 전통적으로 낮은 PER
4. **성장성 부족**: 미래 성장 가능성이 낮아 시장이 낮게 평가

## 종합 판단:
- PER만으로 판단하지 말고
- 업종 평균과 비교
- 최근 수익 추이 확인
- 미래 성장 가능성 평가

이런 요소들을 함께 고려해야 정확한 판단이 가능합니다.`,
          sources: [],
        },
      ],
    },
    {
      title: '배당금 투자 전략',
      messages: [
        {
          role: 'user',
          content: '배당주 투자는 어떤가요?',
          sources: [],
        },
        {
          role: 'assistant',
          content: `배당주 투자는 안정적인 수익을 원하는 투자자에게 좋은 선택입니다.

## 배당주 투자의 장점:
1. **정기적 현금 흐름**: 분기별 또는 연간 배당금 수령
2. **안정성**: 대형 우량주 중심으로 변동성 낮음
3. **복리 효과**: 배당금 재투자로 장기 수익 증대

## 배당주 선정 기준:
- 배당률 3% 이상
- 5년 이상 연속 배당
- 배당성향 안정적 (50~70%)
- 재무 건전성 우수

## 주의사항:
- 배당락일 전후 주가 변동
- 배당소득세 15.4% 고려
- 배당만 노리는 투자는 위험

배당주는 장기 투자 관점에서 접근하는 것이 좋습니다.`,
          sources: [],
        },
      ],
    },
    {
      title: 'RSI 지표 활용법',
      messages: [
        {
          role: 'user',
          content: 'RSI 지표로 매매 타이밍을 잡을 수 있나요?',
          sources: [],
        },
        {
          role: 'assistant',
          content: `RSI는 기술적 분석에서 매매 타이밍을 잡는 데 도움이 되는 지표입니다.

## RSI 기본:
- **RSI 70 이상**: 과매수 구간 (매도 고려)
- **RSI 30 이하**: 과매도 구간 (매수 고려)
- **RSI 50**: 중립 구간

## 활용 방법:
1. **단독 사용**: RSI 30 이하에서 매수, 70 이상에서 매도
2. **다이버전스**: 주가와 RSI가 반대로 움직일 때 신호
3. **추세 확인**: RSI 50 기준으로 상승/하락 추세 판단

## 주의사항:
- 강한 추세장에서는 RSI가 오래 과매수/과매도 구간에 머물 수 있음
- 다른 지표(이동평균선, 거래량 등)와 함께 사용 권장
- 단기 변동성에 민감하므로 장기 투자에는 부적합할 수 있음

RSI는 보조 지표로 사용하고, 기본적 분석과 함께 판단하는 것이 좋습니다.`,
          sources: [],
        },
      ],
    },
  ];

  // 대화 및 메시지 생성
  for (const convData of mockConversations) {
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: convData.title,
      },
    });

    for (const msgData of convData.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: user.id,
          role: msgData.role,
          content: msgData.content,
          sources: msgData.sources,
        },
      });
    }

    console.log(`대화 생성: ${conversation.title} (${convData.messages.length}개 메시지)`);
  }

  console.log(`✅ ${mockConversations.length}개의 대화 데이터 생성 완료`);
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

