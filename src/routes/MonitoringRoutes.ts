/**
 * Monitoring Routes
 * 파이프라인 모니터링 API
 */

import { FastifyPluginAsync } from 'fastify';
import { getPipelineMonitor } from '../monitoring/PipelineMonitor';
import { PipelineBranch } from '../pipelines/PipelineManager';

const routes: FastifyPluginAsync = async (fastify) => {
  const monitor = getPipelineMonitor();

  // 전체 모니터링 데이터
  fastify.get('/', async (request, reply) => {
    const data = await monitor.getMonitorData();
    reply.send({
      success: true,
      data,
    });
  });

  // 브랜치별 상세 정보
  fastify.get('/branch/:branch', async (request, reply) => {
    const { branch } = request.params as { branch: string };
    
    if (!Object.values(PipelineBranch).includes(branch as PipelineBranch)) {
      reply.status(400).send({
        success: false,
        error: 'Invalid branch name',
      });
      return;
    }
    
    const data = await monitor.getBranchDetails(branch as PipelineBranch);
    reply.send({
      success: true,
      data,
    });
  });

  // 작업별 상세 정보
  fastify.get('/job/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const data = monitor.getJobDetails(jobId);
    if (!data) {
      reply.status(404).send({
        success: false,
        error: 'Job not found',
      });
      return;
    }
    
    reply.send({
      success: true,
      data,
    });
  });

  // 모니터링 리포트 (텍스트 형식)
  fastify.get('/report', async (request, reply) => {
    const report = await monitor.generateReport();
    reply.type('text/plain').send(report);
  });
};

export default routes;

