/**
 * Cache Service
 * Redis를 사용한 캐싱 서비스
 * 채팅, 뉴스, 주식 데이터 등의 캐싱 관리
 */

import { redis } from '../config/redis';
import { logger } from '../config/logger';

export class CacheService {
  /**
   * 캐시에서 데이터 가져오기
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`CacheService.get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.error(`CacheService.set error for key ${key}:`, error);
    }
  }

  /**
   * 캐시에서 데이터 삭제
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`CacheService.delete error for key ${key}:`, error);
    }
  }

  /**
   * 패턴으로 여러 키 삭제
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error(`CacheService.deletePattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * 캐시 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`CacheService.exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * TTL 확인
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error(`CacheService.getTTL error for key ${key}:`, error);
      return -1;
    }
  }
}

export const cacheService = new CacheService();

