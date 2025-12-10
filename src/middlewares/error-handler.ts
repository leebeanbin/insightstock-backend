import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import { StandardResponse } from './response-interceptor';

/**
 * Global Error Handler for Fastify
 * 모든 에러를 중앙에서 처리하고 표준화된 응답 반환
 */
export const errorHandler = (
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const requestId = (request as any).requestId || 'unknown';
  // Zod Validation Error
  if (error instanceof ZodError) {
    const response: StandardResponse = {
      success: false,
      message: 'Validation failed',
      error: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '),
      requestId,
      timestamp: new Date().toISOString(),
    };
    return reply.status(400).send(response);
  }

  // Custom App Error
  if (error instanceof AppError) {
    const response: StandardResponse = {
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString(),
    };
    return reply.status(error.statusCode).send(response);
  }

  // Prisma Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let message = 'Database error occurred';

    // Unique constraint violation
    if (error.code === 'P2002') {
      statusCode = 409;
      message = 'Resource already exists';
    }
    // Record not found
    else if (error.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found';
    }
    // Foreign key constraint violation
    else if (error.code === 'P2003') {
      statusCode = 400;
      message = 'Invalid reference';
    }

    const response: StandardResponse = {
      success: false,
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
    };

    return reply.status(statusCode).send(response);
  }

  // Fastify Validation Error
  if ('validation' in error && error.validation) {
    const fastifyError = error as FastifyError;
    const response: StandardResponse = {
      success: false,
      error: 'Validation failed',
      message: JSON.stringify(fastifyError.validation),
      requestId,
      timestamp: new Date().toISOString(),
    };
    return reply.status(400).send(response);
  }

  // Unknown Error
  const statusCode = (error as FastifyError).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

  const response: StandardResponse = {
    success: false,
    error: message,
    requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { message: error.stack }),
  };

  return reply.status(statusCode).send(response);
};

