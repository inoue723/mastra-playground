import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { handleChatStream } from '@mastra/ai-sdk';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { createUIMessageStreamResponse } from 'ai';
import { agent } from './agents/agent';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';

const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const chatRoute = registerApiRoute('/chat', {
  method: 'POST',
  handler: async context => {
    const params = await context.req.json();
    const mastra = context.get('mastra');
    const agent = mastra.getAgentById('agent');
    const resourceId = params.memory?.resource;

    if (typeof resourceId !== 'string' || !resourceId) {
      return context.json({ error: 'memory.resource is required' }, 400);
    }

    let threadId = params.memory?.thread;
    if (typeof threadId !== 'string' || !threadId) {
      const memory = await agent.getMemory();
      if (!memory) {
        return context.json({ error: 'Agent memory is not configured' }, 500);
      }
      const thread = await memory.createThread({ resourceId });
      threadId = thread.id;
    }

    const stream = await handleChatStream({
      mastra,
      agentId: 'agent',
      version: 'v7',
      params: {
        ...params,
        abortSignal: context.req.raw.signal,
        memory: {
          ...params.memory,
          resource: resourceId,
          thread: threadId,
        },
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { 'x-thread-id': threadId },
    });
  },
});

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  agents: { agent },
  tools: { startScheduleTool, stopScheduleTool },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    apiRoutes: [
      chatRoute,
    ],
    cors: {
      origin: webOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['x-thread-id'],
      credentials: false,
    },
  },
});
