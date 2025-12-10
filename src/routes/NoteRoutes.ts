import { FastifyPluginAsync } from 'fastify';
import { NoteController } from '../controllers/NoteController';
import { NoteService } from '../services/NoteService';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const noteService = new NoteService();
const noteController = new NoteController(noteService);

const routes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // 노트 목록 조회
  fastify.get('/', async (request, reply) => {
    await noteController.getNotes(request, reply);
  });

  // 노트 상세 조회
  fastify.get('/:id', async (request, reply) => {
    await noteController.getNoteById(request, reply);
  });

  // 노트 생성
  fastify.post('/', async (request, reply) => {
    await noteController.createNote(request, reply);
  });

  // 노트 수정
  fastify.patch('/:id', async (request, reply) => {
    await noteController.updateNote(request, reply);
  });

  // 노트 삭제
  fastify.delete('/:id', async (request, reply) => {
    await noteController.deleteNote(request, reply);
  });
};

export default routes;

