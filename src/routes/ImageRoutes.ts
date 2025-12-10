import { FastifyPluginAsync } from 'fastify';
import { ImageController } from '../controllers/ImageController';
import { authenticate } from '../middlewares/auth';
import multipart from '@fastify/multipart';

const imageController = new ImageController();

const routes: FastifyPluginAsync = async (fastify) => {
  // Multipart 지원 등록
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // 이미지 업로드
  fastify.post('/upload', async (request, reply) => {
    await imageController.uploadImage(request, reply);
  });

  // 이미지 삭제
  fastify.delete('/:imagePath', async (request, reply) => {
    await imageController.deleteImage(request, reply);
  });

  // 이미지 정보 조회
  fastify.get('/info/:imagePath', async (request, reply) => {
    await imageController.getImageInfo(request, reply);
  });
};

export default routes;

