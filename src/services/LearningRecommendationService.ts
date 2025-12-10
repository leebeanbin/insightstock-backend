import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { UserActivityService } from './UserActivityService';

/**
 * 학습 추천 서비스
 * 사용자가 읽은 뉴스, 학습 이력, 관심 종목을 기반으로 일일 학습 추천 생성
 */
export class LearningRecommendationService {
  constructor(private readonly userActivityService: UserActivityService = new UserActivityService()) {}

  /**
   * 오늘의 학습 추천 생성
   * - 읽은 뉴스의 개념 추출
   * - 최근 학습 이력 분석
   * - 관심 종목 기반 추천
   */
  async getTodayRecommendations(userId: string): Promise<Array<{
    concept: string;
    question: string;
    description: string;
    relatedStocks: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>> {
    try {
      const userContext = await this.userActivityService.getUserContext(userId);
      
      // 1. 읽은 뉴스에서 개념 추출
      const readNewsConcepts = await this.extractConceptsFromNews(userContext.readNews);
      
      // 2. 최근 학습 이력 조회
      const recentLearnings = await prisma.learning.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          concept: true,
          question: true,
          relatedStocks: true,
        },
      });

      // 3. 관심 종목 조회
      const favoriteStocks = await prisma.favorite.findMany({
        where: { userId },
        include: { stock: true },
        take: 10,
      });

      // 4. 추천 생성 로직
      const recommendations: Array<{
        concept: string;
        question: string;
        description: string;
        relatedStocks: string[];
        difficulty: 'beginner' | 'intermediate' | 'advanced';
      }> = [];

      // 읽은 뉴스 기반 추천
      if (readNewsConcepts.length > 0) {
        const uniqueConcepts = [...new Set(readNewsConcepts)];
        for (const concept of uniqueConcepts.slice(0, 3)) {
          const relatedStocks = userContext.recentStocks.slice(0, 3);
          recommendations.push({
            concept,
            question: `${concept}에 대해 설명해주세요.`,
            description: `최근 읽은 뉴스에서 언급된 ${concept} 개념을 학습해보세요.`,
            relatedStocks,
            difficulty: this.determineDifficulty(concept),
          });
        }
      }

      // 관심 종목 기반 추천
      if (favoriteStocks.length > 0 && recommendations.length < 3) {
        const stock = favoriteStocks[0].stock;
        recommendations.push({
          concept: `${stock.name} 투자 분석`,
          question: `${stock.name}의 투자 포인트는 무엇인가요?`,
          description: `관심 종목인 ${stock.name}에 대해 더 깊이 학습해보세요.`,
          relatedStocks: [stock.code],
          difficulty: 'intermediate',
        });
      }

      // 기본 추천 (부족한 경우)
      const defaultConcepts = [
        { concept: 'PER', question: 'PER이 무엇인가요?', description: '주식 투자의 기본 지표인 PER을 학습해보세요.', difficulty: 'beginner' as const },
        { concept: '배당락일', question: '배당락일이란 무엇인가요?', description: '배당락일의 개념과 투자 시 주의사항을 알아보세요.', difficulty: 'beginner' as const },
        { concept: 'RSI', question: 'RSI 지표를 어떻게 해석하나요?', description: '기술적 분석의 핵심 지표인 RSI를 학습해보세요.', difficulty: 'intermediate' as const },
      ];

      // 이미 학습한 개념 제외
      const learnedConcepts = new Set(recentLearnings.map(l => l.concept));
      const newDefaultConcepts = defaultConcepts.filter(d => !learnedConcepts.has(d.concept));

      while (recommendations.length < 3 && newDefaultConcepts.length > 0) {
        const concept = newDefaultConcepts.shift()!;
        recommendations.push({
          ...concept,
          relatedStocks: userContext.recentStocks.slice(0, 2),
        });
      }

      return recommendations.slice(0, 3);
    } catch (error) {
      logger.error('LearningRecommendationService.getTodayRecommendations error:', error);
      // 기본 추천 반환
      return [
        {
          concept: 'PER',
          question: 'PER이 무엇인가요?',
          description: '주식 투자의 기본 지표인 PER을 학습해보세요.',
          relatedStocks: [],
          difficulty: 'beginner',
        },
        {
          concept: '배당락일',
          question: '배당락일이란 무엇인가요?',
          description: '배당락일의 개념과 투자 시 주의사항을 알아보세요.',
          relatedStocks: [],
          difficulty: 'beginner',
        },
        {
          concept: 'RSI',
          question: 'RSI 지표를 어떻게 해석하나요?',
          description: '기술적 분석의 핵심 지표인 RSI를 학습해보세요.',
          relatedStocks: [],
          difficulty: 'intermediate',
        },
      ];
    }
  }

  /**
   * 뉴스에서 개념 추출
   * 뉴스 제목과 내용에서 금융 용어 추출 (간단한 키워드 매칭)
   */
  private async extractConceptsFromNews(newsIds: string[]): Promise<string[]> {
    if (newsIds.length === 0) return [];

    try {
      const news = await prisma.news.findMany({
        where: { id: { in: newsIds } },
        select: {
          title: true,
          summary: true,
        },
      });

      // 금융 용어 키워드
      const financialTerms = [
        'PER', 'PBR', 'ROE', 'ROA', 'EPS', '배당', '배당락일', '배당률',
        'RSI', 'MACD', '볼린저밴드', '이동평균선', '지지선', '저항선',
        '시가총액', '유동비율', '부채비율', '자기자본비율',
        '옵션', '선물', '스왑', '파생상품', '헤지',
        'IPO', '공모주', '신규상장', '상장폐지',
        '증자', '감자', '스플릿', '리버스스플릿',
      ];

      const foundConcepts: string[] = [];
      
      for (const item of news) {
        const text = `${item.title} ${item.summary || ''}`.toUpperCase();
        for (const term of financialTerms) {
          if (text.includes(term.toUpperCase()) && !foundConcepts.includes(term)) {
            foundConcepts.push(term);
          }
        }
      }

      return foundConcepts;
    } catch (error) {
      logger.error('LearningRecommendationService.extractConceptsFromNews error:', error);
      return [];
    }
  }

  /**
   * 개념의 난이도 결정
   */
  private determineDifficulty(concept: string): 'beginner' | 'intermediate' | 'advanced' {
    const beginnerConcepts = ['PER', 'PBR', '배당', '주식', '시가총액'];
    const advancedConcepts = ['옵션', '선물', '스왑', '파생상품', '헤지'];

    if (beginnerConcepts.some(c => concept.includes(c))) {
      return 'beginner';
    }
    if (advancedConcepts.some(c => concept.includes(c))) {
      return 'advanced';
    }
    return 'intermediate';
  }
}

