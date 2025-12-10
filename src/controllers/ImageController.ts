import { FastifyRequest, FastifyReply } from 'fastify';
import { ImageService } from '../services/ImageService';
import { BadRequestError } from '../errors/AppError';

export class ImageController {
  constructor(
    private readonly imageService: ImageService = new ImageService()
  ) {}

  /**
   * 이미지 업로드 및 최적화
   */
  async uploadImage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const data = await request.file();
    
    if (!data) {
      throw new BadRequestError('No file uploaded');
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      throw new BadRequestError('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const buffer = await data.toBuffer();
    if (buffer.length > maxSize) {
      throw new BadRequestError('File size exceeds 10MB limit.');
    }

    try {
      const result = await this.imageService.optimizeAndSave(
        buffer,
        data.filename,
        {
          format: 'webp',
          quality: 85,
        }
      );

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: 'Failed to process image',
      });
    }
  }

  /**
   * 이미지 삭제
   */
  async deleteImage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { imagePath } = request.body as { imagePath: string };

    if (!imagePath) {
      throw new BadRequestError('Image path is required');
    }

    try {
      await this.imageService.deleteImage(imagePath);
      reply.send({
        success: true,
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: 'Failed to delete image',
      });
    }
  }

  /**
   * 이미지 정보 조회
   */
  async getImageInfo(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { imagePath } = request.params as { imagePath: string };

    if (!imagePath) {
      throw new BadRequestError('Image path is required');
    }

    try {
      const info = await this.imageService.getImageInfo(imagePath);
      reply.send({
        success: true,
        data: info,
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: 'Failed to get image info',
      });
    }
  }
}

