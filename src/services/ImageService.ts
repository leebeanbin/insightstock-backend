import { logger } from '../config/logger';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 이미지 최적화 서비스
 * - 이미지 리사이징
 * - 포맷 변환 (WebP)
 * - 썸네일 생성
 * - 캐싱 관리
 */
export class ImageService {
  private readonly uploadDir: string;
  private readonly cacheDir: string;
  private readonly maxWidth: number = 1920;
  private readonly maxHeight: number = 1080;
  private readonly thumbnailWidth: number = 400;
  private readonly thumbnailHeight: number = 300;
  private readonly quality: number = 85;

  constructor() {
    // 환경 변수에서 업로드 디렉토리 설정
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.cacheDir = path.join(this.uploadDir, 'cache');
    
    // 디렉토리 생성 (없으면)
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      logger.error('ImageService: Failed to create directories', error);
    }
  }

  /**
   * 이미지 최적화 및 저장
   * @param buffer 이미지 버퍼
   * @param originalName 원본 파일명
   * @param options 최적화 옵션
   * @returns 최적화된 이미지 경로
   */
  async optimizeAndSave(
    buffer: Buffer,
    originalName: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    }
  ): Promise<{
    path: string;
    url: string;
    width: number;
    height: number;
    size: number;
  }> {
    try {
      const ext = path.extname(originalName).toLowerCase();
      const format = options?.format || (ext === '.png' ? 'png' : 'webp');
      const width = options?.width || this.maxWidth;
      const height = options?.height || this.maxHeight;
      const quality = options?.quality || this.quality;

      // 이미지 메타데이터 추출
      const metadata = await sharp(buffer).metadata();
      const originalWidth = metadata.width || width;
      const originalHeight = metadata.height || height;

      // 리사이징 (원본보다 크면 리사이징하지 않음)
      let processedImage = sharp(buffer);
      if (originalWidth > width || originalHeight > height) {
        processedImage = processedImage.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // 포맷 변환 및 최적화
      if (format === 'webp') {
        processedImage = processedImage.webp({ quality });
      } else if (format === 'jpeg') {
        processedImage = processedImage.jpeg({ quality, mozjpeg: true });
      } else {
        processedImage = processedImage.png({ quality: Math.floor(quality * 0.9) });
      }

      // 최적화된 이미지 버퍼 생성
      const optimizedBuffer = await processedImage.toBuffer();
      const finalMetadata = await sharp(optimizedBuffer).metadata();

      // 파일명 생성 (UUID 사용)
      const filename = `${uuidv4()}.${format}`;
      const filePath = path.join(this.uploadDir, filename);

      // 파일 저장
      await fs.writeFile(filePath, optimizedBuffer);

      // URL 생성 (환경 변수에 따라)
      const baseUrl = process.env.IMAGE_BASE_URL || '/uploads';
      const url = `${baseUrl}/${filename}`;

      logger.info(`ImageService: Optimized image saved: ${filename}`, {
        originalSize: buffer.length,
        optimizedSize: optimizedBuffer.length,
        compressionRatio: ((1 - optimizedBuffer.length / buffer.length) * 100).toFixed(2) + '%',
      });

      return {
        path: filePath,
        url,
        width: finalMetadata.width || width,
        height: finalMetadata.height || height,
        size: optimizedBuffer.length,
      };
    } catch (error) {
      logger.error('ImageService.optimizeAndSave error:', error);
      throw error;
    }
  }

  /**
   * 썸네일 생성
   * @param imagePath 원본 이미지 경로
   * @returns 썸네일 URL
   */
  async generateThumbnail(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const filename = path.basename(imagePath, path.extname(imagePath));
      const thumbnailFilename = `${filename}_thumb.webp`;
      const thumbnailPath = path.join(this.cacheDir, thumbnailFilename);

      // 썸네일 생성
      await sharp(imageBuffer)
        .resize(this.thumbnailWidth, this.thumbnailHeight, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      const baseUrl = process.env.IMAGE_BASE_URL || '/uploads';
      return `${baseUrl}/cache/${thumbnailFilename}`;
    } catch (error) {
      logger.error('ImageService.generateThumbnail error:', error);
      throw error;
    }
  }

  /**
   * 이미지 삭제
   * @param imagePath 이미지 경로
   */
  async deleteImage(imagePath: string): Promise<void> {
    try {
      await fs.unlink(imagePath);
      
      // 썸네일도 삭제 시도
      const filename = path.basename(imagePath, path.extname(imagePath));
      const thumbnailPath = path.join(this.cacheDir, `${filename}_thumb.webp`);
      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // 썸네일이 없어도 무시
      }
    } catch (error) {
      logger.error('ImageService.deleteImage error:', error);
      throw error;
    }
  }

  /**
   * 이미지 정보 조회
   * @param imagePath 이미지 경로
   * @returns 이미지 메타데이터
   */
  async getImageInfo(imagePath: string): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
  }> {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = await fs.stat(imagePath);

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: stats.size,
        format: metadata.format || 'unknown',
      };
    } catch (error) {
      logger.error('ImageService.getImageInfo error:', error);
      throw error;
    }
  }

  /**
   * 이미지 URL 검증 및 최적화
   * 외부 URL인 경우 CDN이나 프록시를 통해 최적화된 버전 제공
   * @param imageUrl 이미지 URL
   * @returns 최적화된 이미지 URL
   */
  async optimizeExternalImage(imageUrl: string): Promise<string> {
    // 외부 이미지의 경우, CDN이나 이미지 프록시 서비스를 사용할 수 있음
    // 예: Cloudinary, Imgix, ImageKit 등
    
    // 현재는 원본 URL 반환
    // TODO: 외부 이미지 최적화 서비스 연동
    return imageUrl;
  }
}

