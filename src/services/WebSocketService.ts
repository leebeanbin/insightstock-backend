/**
 * WebSocket Service
 * 실시간 양방향 통신을 위한 WebSocket 서비스
 * 연결 관리, 메시지 라우팅, 하트비트 처리
 */

import { IChatFacade } from '../facades/IChatFacade';
import { CreateChatDto } from '../dto/chat/CreateChatDto';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { DatabaseError } from '../errors/AppError';

// WebSocket 타입 (Node.js WebSocket)
type WebSocketSocket = {
  send: (data: string) => void;
  ping: () => void;
  close: (code?: number, reason?: string) => void;
  terminate: () => void;
  readyState: number;
  on: (event: string, callback: (...args: any[]) => void) => void;
};

interface Connection {
  socket: WebSocketSocket;
  userId: string;
  conversationId?: string;
  lastPing: number;
  isAlive: boolean;
}

export class WebSocketService {
  private connections: Map<string, Connection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly chatFacade: IChatFacade) {
    // 하트비트 체크 (30초마다)
    this.heartbeatInterval = setInterval(() => {
      this.checkConnections();
    }, 30000);
  }

  /**
   * WebSocket 연결 처리
   */
  async handleConnection(socket: WebSocketSocket, userId: string) {
    const connectionId = `${userId}-${Date.now()}`;
    const connection: Connection = {
      socket,
      userId,
      lastPing: Date.now(),
      isAlive: true,
    };

    this.connections.set(connectionId, connection);

    logger.info(`WebSocket connected: ${connectionId} (user: ${userId})`);

    // 연결 상태를 Redis에 저장 (다중 서버 환경 대비)
    await redis.setex(`ws:connection:${connectionId}`, 3600, userId);

    // 연결 이벤트 핸들러
    socket.on('message', async (message: Buffer) => {
      try {
        await this.handleMessage(connectionId, message);
      } catch (error) {
        logger.error(`WebSocket message error for ${connectionId}:`, error);
        this.sendError(socket, 'Failed to process message');
      }
    });

    socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    });

    // 하트비트 응답 핸들러
    socket.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastPing = Date.now();
      }
    });

    // 초기 하트비트 시작
    this.startHeartbeat(connectionId);
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(connectionId: string, message: Buffer) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn(`Connection not found: ${connectionId}`);
      return;
    }

    try {
      const data = JSON.parse(message.toString());
      const { type, payload } = data;

      switch (type) {
        case 'chat':
          await this.handleChatMessage(connection, payload);
          break;
        case 'ping':
          this.handlePing(connection);
          break;
        default:
          logger.warn(`Unknown message type: ${type}`);
          this.sendError(connection.socket, `Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error(`Failed to parse message for ${connectionId}:`, error);
      this.sendError(connection.socket, 'Invalid message format');
    }
  }

  /**
   * 채팅 메시지 처리
   */
  private async handleChatMessage(connection: Connection, payload: any) {
    const { conversationId, message } = payload;

    if (!message || typeof message !== 'string') {
      this.sendError(connection.socket, 'Message is required');
      return;
    }

    // 대화 ID 업데이트
    if (conversationId) {
      connection.conversationId = conversationId;
    }

    const dto: CreateChatDto = {
      conversationId: conversationId || undefined,
      message,
    };

    try {
      // 스트리밍 시작 알림
      this.send(connection.socket, {
        type: 'chunk',
        content: '',
        conversationId: conversationId || '',
      });

      // OpenAI 스트리밍 응답
      const stream = this.chatFacade.streamChat(connection.userId, dto);
      let fullContent = '';
      let currentConversationId = conversationId;

      for await (const chunk of stream) {
        fullContent += chunk;
        
        // 스트리밍 청크 전송
        this.send(connection.socket, {
          type: 'chunk',
          content: chunk,
          conversationId: currentConversationId || '',
        });
      }

      // 스트리밍 완료 알림
      this.send(connection.socket, {
        type: 'done',
        conversationId: currentConversationId || '',
        messageId: `msg_${Date.now()}`,
      });

      // 대화 ID가 없었는데 생성된 경우 업데이트
      if (!conversationId && currentConversationId) {
        connection.conversationId = currentConversationId;
      }
    } catch (error) {
      logger.error(`Chat streaming error for ${connection.userId}:`, error);
      this.sendError(connection.socket, 'Failed to generate chat response');
      throw new DatabaseError('Failed to generate chat response');
    }
  }

  /**
   * 핑 처리
   */
  private handlePing(connection: Connection) {
    connection.isAlive = true;
    connection.lastPing = Date.now();
    this.send(connection.socket, { type: 'pong' });
  }

  /**
   * 하트비트 시작
   */
  private startHeartbeat(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const interval = setInterval(() => {
      if (connection.socket.readyState === 1) { // WebSocket.OPEN = 1
        connection.socket.ping();
      } else {
        clearInterval(interval);
        this.handleDisconnection(connectionId);
      }
    }, 30000); // 30초마다 핑

    // 연결이 닫히면 인터벌 정리
    connection.socket.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * 연결 상태 체크
   */
  private checkConnections() {
    const now = Date.now();
    const timeout = 60000; // 60초 타임아웃

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastPing > timeout) {
        logger.warn(`Connection timeout: ${connectionId}`);
        this.handleDisconnection(connectionId);
      } else if (!connection.isAlive) {
        // 핑에 응답하지 않으면 연결 종료
        logger.warn(`Connection not alive: ${connectionId}`);
        connection.socket.terminate();
        this.handleDisconnection(connectionId);
      } else {
        // 다음 체크를 위해 isAlive 리셋
        connection.isAlive = false;
      }
    }
  }

  /**
   * 연결 해제 처리
   */
  private async handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info(`WebSocket disconnected: ${connectionId} (user: ${connection.userId})`);
      
      // Redis에서 연결 정보 삭제
      await redis.del(`ws:connection:${connectionId}`);
      
      this.connections.delete(connectionId);
    }
  }

  /**
   * 메시지 전송
   */
  private send(socket: WebSocketSocket, data: any) {
    if (socket.readyState === 1) { // WebSocket.OPEN = 1
      socket.send(JSON.stringify(data));
    }
  }

  /**
   * 에러 전송
   */
  private sendError(socket: WebSocketSocket, message: string) {
    this.send(socket, {
      type: 'error',
      error: message,
    });
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  async sendToUser(userId: string, message: any) {
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.userId === userId) {
        this.send(connection.socket, message);
      }
    }
  }

  /**
   * 연결 수 조회
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 정리 (서버 종료 시)
   */
  async cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 모든 연결 종료
    for (const [connectionId, connection] of this.connections.entries()) {
      connection.socket.close();
      await redis.del(`ws:connection:${connectionId}`);
    }

    this.connections.clear();
    logger.info('WebSocket service cleaned up');
  }
}

