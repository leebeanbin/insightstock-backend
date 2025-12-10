/**
 * Pipeline Monitor
 * 파이프라인 상태 모니터링 시스템
 * 작업 실행 통계, 상태 추적
 */

import { getPipelineManager, PipelineBranch } from '../pipelines/PipelineManager';
import { getEventStream } from '../events/EventStream';
import { getQueueManager } from '../queues/QueueManager';
import { logger } from '../config/logger';

/**
 * 파이프라인 모니터링 데이터
 */
export interface PipelineMonitorData {
  branches: {
    [key in PipelineBranch]: {
      total: number;
      enabled: number;
      completed: number;
      failed: number;
      running: number;
      lastExecution?: Date;
    };
  };
  recentEvents: any[];
  queueStats: Record<string, any>;
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memory: NodeJS.MemoryUsage;
  };
}

/**
 * Pipeline Monitor
 */
export class PipelineMonitor {
  private pipelineManager = getPipelineManager();
  private eventStream = getEventStream();
  private queueManager = getQueueManager();

  /**
   * 전체 모니터링 데이터 조회
   */
  async getMonitorData(): Promise<PipelineMonitorData> {
    const branches: any = {};
    
    // 브랜치별 통계
    for (const branch of Object.values(PipelineBranch)) {
      const stats = this.pipelineManager.getBranchStats(branch);
      const jobs = this.pipelineManager.getBranchJobs(branch);
      
      // 마지막 실행 시간 찾기
      let lastExecution: Date | undefined;
      for (const job of jobs) {
        const status = this.pipelineManager.getJobStatus(job.id);
        if (status?.endTime) {
          if (!lastExecution || status.endTime > lastExecution) {
            lastExecution = status.endTime;
          }
        }
      }
      
      branches[branch] = {
        ...stats,
        lastExecution,
      };
    }
    
    // 최근 이벤트
    const recentEvents = await this.eventStream.getRecentEvents(50);
    
    // 큐 통계
    const queueStats = await this.queueManager.getAllQueueStats();
    
    // 시스템 헬스
    const systemHealth = this.getSystemHealth();
    
    return {
      branches,
      recentEvents,
      queueStats,
      systemHealth,
    };
  }

  /**
   * 브랜치별 상세 정보
   */
  async getBranchDetails(branch: PipelineBranch): Promise<{
    jobs: any[];
    stats: any;
    recentEvents: any[];
  }> {
    const jobs = this.pipelineManager.getBranchJobs(branch);
    const stats = this.pipelineManager.getBranchStats(branch);
    const recentEvents = await this.eventStream.getBranchEvents(branch, 20);
    
    // 각 작업의 상태 정보 추가
    const jobsWithStatus = jobs.map((job) => {
      const status = this.pipelineManager.getJobStatus(job.id);
      return {
        ...job,
        status,
      };
    });
    
    return {
      jobs: jobsWithStatus,
      stats,
      recentEvents,
    };
  }

  /**
   * 작업별 상세 정보
   */
  getJobDetails(jobId: string): {
    job: any;
    status: any;
    events: any[];
  } | null {
    const allJobs = this.pipelineManager.getAllJobs();
    const job = allJobs.find((j) => j.id === jobId);
    
    if (!job) {
      return null;
    }
    
    const status = this.pipelineManager.getJobStatus(jobId);
    
    // 이벤트는 비동기이므로 Promise로 반환해야 하지만,
    // 간단한 동기 메서드로 만들기 위해 빈 배열 반환
    // 필요시 async로 변경 가능
    return {
      job,
      status,
      events: [], // 비동기 조회 필요시 async 메서드로 변경
    };
  }

  /**
   * 시스템 헬스 체크
   */
  private getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    
    // 메모리 사용률 계산
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    // 헬스 상태 결정
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      uptime,
      memory,
    };
  }

  /**
   * 모니터링 리포트 생성
   */
  async generateReport(): Promise<string> {
    const data = await this.getMonitorData();
    
    let report = '=== Pipeline Monitoring Report ===\n\n';
    
    // 브랜치별 통계
    report += '## Branches\n';
    for (const [branch, stats] of Object.entries(data.branches)) {
      report += `\n### ${branch}\n`;
      report += `- Total: ${stats.total}\n`;
      report += `- Enabled: ${stats.enabled}\n`;
      report += `- Completed: ${stats.completed}\n`;
      report += `- Failed: ${stats.failed}\n`;
      report += `- Running: ${stats.running}\n`;
      if (stats.lastExecution) {
        report += `- Last Execution: ${stats.lastExecution.toISOString()}\n`;
      }
    }
    
    // 시스템 헬스
    report += '\n## System Health\n';
    report += `- Status: ${data.systemHealth.status}\n`;
    report += `- Uptime: ${Math.floor(data.systemHealth.uptime / 60)} minutes\n`;
    report += `- Memory Usage: ${((data.systemHealth.memory.heapUsed / data.systemHealth.memory.heapTotal) * 100).toFixed(2)}%\n`;
    
    // 큐 통계
    report += '\n## Queue Statistics\n';
    for (const [queueName, stats] of Object.entries(data.queueStats)) {
      if (stats) {
        report += `\n### ${queueName}\n`;
        report += `- Waiting: ${stats.waiting}\n`;
        report += `- Active: ${stats.active}\n`;
        report += `- Completed: ${stats.completed}\n`;
        report += `- Failed: ${stats.failed}\n`;
      }
    }
    
    return report;
  }
}

// 싱글톤 인스턴스
let pipelineMonitorInstance: PipelineMonitor | null = null;

/**
 * PipelineMonitor 싱글톤 인스턴스 가져오기
 */
export function getPipelineMonitor(): PipelineMonitor {
  if (!pipelineMonitorInstance) {
    pipelineMonitorInstance = new PipelineMonitor();
  }
  return pipelineMonitorInstance;
}

