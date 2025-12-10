import { IChatFacade } from '../facades/IChatFacade';
import { IConversationRepository } from '../repositories/IConversationRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { ChatResponseDto, ConversationResponseDto } from '../dto/chat/ChatResponseDto';
import { CreateChatDto } from '../dto/chat/CreateChatDto';
import { Conversation } from '../entities/Conversation';
import { Message } from '../entities/Message';
import { NotFoundError, DatabaseError } from '../errors/AppError';
import { logger } from '../config/logger';
import { UserActivityService } from './UserActivityService';
import OpenAI from 'openai';
import { prisma } from '../config/prisma';
import { cacheService } from './CacheService';
import { createStepTracker } from '../utils/aop';

export class ChatService implements IChatFacade {
  private openai: OpenAI;

  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly userActivityService: UserActivityService = new UserActivityService()
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async getConversations(userId: string, search?: string, category?: string): Promise<ConversationResponseDto[]> {
    const tracker = createStepTracker('ChatService.getConversations');
    
    tracker.step('캐시 확인 시작');
    // Redis 캐싱: 대화 목록은 5분간 캐시 (검색/필터가 없을 때만)
    const cacheKey = search || category ? null : `conversations:${userId}`;
    if (cacheKey) {
      const cached = await cacheService.get<ConversationResponseDto[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for conversations:${userId}`);
        tracker.finish();
        return cached;
      }
    }
    tracker.step('캐시 미스 - DB 조회 시작');

    const conversations = await this.conversationRepository.findAll(userId, search, category);
    tracker.step('DB 조회 완료');
    
    tracker.step('DTO 변환');
    const result = conversations.map((c) => ConversationResponseDto.to(c));
    
    tracker.step('캐시 저장');
    // 캐시 저장 (TTL: 5분) - 검색/필터가 없을 때만
    if (cacheKey) {
      await cacheService.set(cacheKey, result, 300);
    }
    
    tracker.finish();
    return result;
  }

  async getMessages(conversationId: string, userId: string): Promise<ChatResponseDto[]> {
    const tracker = createStepTracker('ChatService.getMessages');
    
    tracker.step('캐시 확인 시작');
    // Redis 캐싱: 메시지 목록은 10분간 캐시 (최근 50개만)
    const cacheKey = `messages:${conversationId}`;
    const cached = await cacheService.get<ChatResponseDto[]>(cacheKey);
    
    if (cached) {
      logger.debug(`Cache hit for messages:${conversationId}`);
      tracker.finish();
      return cached;
    }
    tracker.step('캐시 미스 - DB 조회 시작');

    tracker.step('Conversation 조회');
    const conversation = await this.conversationRepository.findById(conversationId, userId);
    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    tracker.step('Message 조회');
    const messages = await this.messageRepository.findAll(conversationId);
    tracker.step('DB 조회 완료');
    
    tracker.step('DTO 변환');
    const result = messages.map((m) => ChatResponseDto.to(conversation, m));
    
    tracker.step('캐시 저장');
    // 캐시 저장 (TTL: 10분, 최근 50개만)
    const recentMessages = result.slice(-50);
    await cacheService.set(cacheKey, recentMessages, 600);
    
    tracker.finish();
    return result;
  }

  /**
   * 스트리밍 채팅
   * 
   * 동시성 체크:
   * - 대화 생성 시 동시에 같은 대화를 생성할 수 있지만, 각각 독립적인 대화이므로 문제 없음
   * - 메시지 저장은 순차적으로 처리되므로 동시성 문제 없음
   * - OpenAI API 호출은 비동기이므로 병렬 처리 가능
   */
  async *streamChat(userId: string, dto: CreateChatDto): AsyncGenerator<string, void, unknown> {
    const tracker = createStepTracker('ChatService.streamChat');
    
    let conversation: Conversation;

    tracker.step('Conversation 조회/생성 시작');
    // Get or create conversation
    if (dto.conversationId) {
      const existing = await this.conversationRepository.findById(dto.conversationId, userId);
      if (!existing) {
        // 대화가 없으면 자동으로 생성 (conv_ 형식 ID 처리)
        tracker.step('Conversation 자동 생성');
        const newConv = new Conversation(
          '',
          userId,
          dto.message.substring(0, 50),
          undefined,
          [],
          new Date(),
          new Date()
        );
        conversation = await this.conversationRepository.create(newConv);
      } else {
        conversation = existing;
      }
    } else {
      // Create new conversation with first message as title
      const title = dto.message.slice(0, 50);
      const newConv = new Conversation('', userId, title, undefined, [], new Date(), new Date());
      conversation = await this.conversationRepository.create(newConv);
    }
    tracker.step('Conversation 조회/생성 완료');

    tracker.step('User 메시지 저장');
    // Save user message
    const userMessage = new Message(
      '',
      conversation.id,
      userId,
      'user',
      dto.message,
      [],
      new Date()
    );
    await this.messageRepository.create(userMessage);
    tracker.step('User 메시지 저장 완료');

    tracker.step('대화 히스토리 조회');
    // Get conversation history for context
    const history = await this.messageRepository.findAll(conversation.id);
    const messages = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    tracker.step('사용자 컨텍스트 조회');
    // Get user context (읽은 뉴스, 학습 내용, 노트 등)
    // 사용자 정보 연결 동의 여부 확인
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const useContext = user?.chatContextEnabled ?? false;
    
    let systemMessage = 'You are a helpful financial advisor for a Korean stock investment platform. Provide clear, concise answers about stocks, investing, and financial concepts in Korean. Always respond in Korean. Be concise but informative.';
    
    if (useContext) {
      const userContext = await this.userActivityService.getUserContext(userId);
      systemMessage = this.buildSystemMessage(userContext);
    }

    tracker.step('OpenAI API 호출 시작');
    // Stream response from OpenAI
    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          yield content;
        }
      }
      tracker.step('OpenAI API 호출 완료');

      tracker.step('Assistant 메시지 저장');
      // Save assistant message
      const assistantMessage = new Message(
        '',
        conversation.id,
        userId,
        'assistant',
        fullContent,
        [],
        new Date()
      );
      await this.messageRepository.create(assistantMessage);
      tracker.step('Assistant 메시지 저장 완료');

      tracker.step('Conversation 업데이트');
      // Update conversation timestamp
      await this.conversationRepository.update(conversation.id, {
        updatedAt: new Date(),
      });

      tracker.step('캐시 무효화');
      // 캐시 무효화: 새 메시지가 추가되었으므로 캐시 삭제
      await cacheService.delete(`messages:${conversation.id}`);
      await cacheService.delete(`conversations:${userId}`);
      
      tracker.finish();
    } catch (error) {
      logger.error('ChatService.streamChat OpenAI error:', error);
      tracker.finish();
      throw new DatabaseError('Failed to generate chat response');
    }
  }

  async *regenerateMessage(userId: string, messageId: string): AsyncGenerator<string, void, unknown> {
    // 메시지 조회 및 검증
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message');
    }

    // assistant 메시지만 재생성 가능
    if (message.role !== 'assistant') {
      throw new Error('Only assistant messages can be regenerated');
    }

    // 대화 조회 및 검증
    const conversation = await this.conversationRepository.findById(message.conversationId, userId);
    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    // 재생성할 메시지 이전까지의 히스토리 가져오기
    const allMessages = await this.messageRepository.findAll(conversation.id);
    const messageIndex = allMessages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) {
      throw new NotFoundError('Message in conversation');
    }

    // 재생성할 메시지 이전까지의 메시지만 사용
    const historyMessages = allMessages.slice(0, messageIndex).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Get user context
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const useContext = user?.chatContextEnabled ?? false;
    
    let systemMessage = 'You are a helpful financial advisor for a Korean stock investment platform. Provide clear, concise answers about stocks, investing, and financial concepts in Korean. Always respond in Korean. Be concise but informative.';
    
    if (useContext) {
      const userContext = await this.userActivityService.getUserContext(userId);
      systemMessage = this.buildSystemMessage(userContext);
    }

    // 기존 메시지 삭제
    await this.messageRepository.delete(messageId);
    await cacheService.delete(`messages:${conversation.id}`);

    // Stream response from OpenAI
    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...historyMessages,
        ],
        stream: true,
        temperature: 0.7,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          yield content;
        }
      }

      // Save new assistant message
      const newAssistantMessage = new Message(
        '',
        conversation.id,
        userId,
        'assistant',
        fullContent,
        [],
        new Date()
      );
      await this.messageRepository.create(newAssistantMessage);

      // Update conversation timestamp
      await this.conversationRepository.update(conversation.id, {
        updatedAt: new Date(),
      });

      // 캐시 무효화
      await cacheService.delete(`messages:${conversation.id}`);
      await cacheService.delete(`conversations:${userId}`);
    } catch (error) {
      logger.error('ChatService.regenerateMessage OpenAI error:', error);
      throw new DatabaseError('Failed to regenerate message');
    }
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(id, userId);
    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    await this.conversationRepository.delete(id);
    
    // 캐시 무효화
    await cacheService.delete(`messages:${id}`);
    await cacheService.delete(`conversations:${userId}`);
    
    logger.info(`Conversation deleted: ${id}`);
  }

  /**
   * 사용자 컨텍스트를 포함한 시스템 메시지 생성
   */
  private buildSystemMessage(userContext: {
    readNews: string[];
    likedNews: string[];
    favoriteNews: string[];
    recentStocks: string[];
    learnings: Array<{ concept: string; question: string }>;
    notes: Array<{ title: string; tags: string[] }>;
  }): string {
    let context = `You are a helpful financial advisor for a Korean stock investment platform. Provide clear, concise answers about stocks, investing, and financial concepts in Korean.

User Context:
`;

    // 최근 조회한 주식
    if (userContext.recentStocks.length > 0) {
      context += `- Recently viewed stocks: ${userContext.recentStocks.join(', ')}\n`;
    }

    // 최근 학습 내용
    if (userContext.learnings.length > 0) {
      context += `- Recent learning topics:\n`;
      userContext.learnings.slice(0, 5).forEach((learning) => {
        context += `  * ${learning.concept}: ${learning.question.slice(0, 100)}\n`;
      });
    }

    // 최근 노트
    if (userContext.notes.length > 0) {
      context += `- Recent notes: ${userContext.notes.slice(0, 5).map((n) => n.title).join(', ')}\n`;
    }

    // 읽은 뉴스가 있으면 언급
    if (userContext.readNews.length > 0) {
      context += `- User has read ${userContext.readNews.length} news articles recently.\n`;
    }

    // 좋아요한 뉴스가 있으면 언급
    if (userContext.likedNews.length > 0) {
      context += `- User has liked ${userContext.likedNews.length} news articles.\n`;
    }

    context += `
Guidelines:
- Use the user's context to provide personalized recommendations
- Reference their recent learning topics when relevant
- Suggest related stocks based on their viewing history
- Provide educational explanations when appropriate
- Always respond in Korean
- Be concise but informative
`;

    return context;
  }

  /**
   * 추천 질문 생성 (사용자 컨텍스트 기반)
   */
  async getSuggestedQuestions(userId: string): Promise<string[]> {
    try {
      // Redis 캐싱: 추천 질문은 10분간 캐시
      const cacheKey = `suggested-questions:${userId}`;
      const cached = await cacheService.get<string[]>(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for suggested-questions:${userId}`);
        return cached;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const useContext = user?.chatContextEnabled ?? false;
      
      const suggestions: string[] = [];

      if (useContext) {
        const userContext = await this.userActivityService.getUserContext(userId);

        // 최근 조회한 주식 기반 질문
        if (userContext.recentStocks.length > 0) {
          const stock = userContext.recentStocks[0];
          suggestions.push(`${stock}의 투자 포인트는 무엇인가요?`);
          suggestions.push(`${stock}의 최근 동향을 분석해주세요.`);
        }

        // 최근 학습 내용 기반 질문
        if (userContext.learnings.length > 0) {
          const learning = userContext.learnings[0];
          suggestions.push(`${learning.concept}에 대해 더 자세히 설명해주세요.`);
        }
      }

      // 일반적인 추천 질문
      suggestions.push('PER과 PBR의 차이점은 무엇인가요?');
      suggestions.push('배당락일이 무엇인가요?');
      suggestions.push('RSI 지표를 어떻게 해석하나요?');
      suggestions.push('포트폴리오 분산투자 전략을 추천해주세요.');

      const result = suggestions.slice(0, 4); // 최대 4개 반환
      
      // 캐시 저장 (TTL: 10분)
      await cacheService.set(cacheKey, result, 600);
      
      return result;
    } catch (error) {
      logger.error('ChatService.getSuggestedQuestions error:', error);
      // 기본 질문 반환
      const defaultQuestions = [
        'PER이 뭔가요?',
        '배당락일이란?',
        'RSI 지표 해석법',
        '포트폴리오 분산투자 전략',
      ];
      return defaultQuestions;
    }
  }

  /**
   * 사용자 정보 연결 동의 여부 확인
   */
  async getContextConsentStatus(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user?.chatContextEnabled ?? false;
    } catch (error) {
      logger.error('ChatService.getContextConsentStatus error:', error);
      return false;
    }
  }

  /**
   * 사용자 정보 연결 동의 설정
   */
  async setContextConsent(userId: string, enabled: boolean): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { chatContextEnabled: enabled },
      });
      logger.info(`User ${userId} context consent set to ${enabled}`);
    } catch (error) {
      logger.error('ChatService.setContextConsent error:', error);
      throw new DatabaseError('Failed to update context consent');
    }
  }
}

