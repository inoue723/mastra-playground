import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';
import { PostgresStore } from '@mastra/pg';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { agent } from './agents/agent';
import { combineMiddleware, createClerkMiddleware, createSkillSelectionMiddleware } from './auth/clerk';
import { echoExampleRoute } from './routes/example-routes';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';
import { userSkillRoutes } from './routes/user-skill-routes';

const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!clerkSecretKey) {
  throw new Error('CLERK_SECRET_KEY must be set before starting the Mastra server.');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before starting the Mastra server.');
}

const clerkMiddleware = createClerkMiddleware(clerkSecretKey, webOrigins);

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  agents: { agent },
  tools: { startScheduleTool, stopScheduleTool },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new PostgresStore({
      id: 'mastra-storage',
      connectionString: databaseUrl,
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
    host: '127.0.0.1',
    middleware: [
      { path: '/chat', handler: combineMiddleware(clerkMiddleware, createSkillSelectionMiddleware()) },
      { path: '/custom/user-skills', handler: clerkMiddleware },
      { path: '/custom/user-skills/*', handler: clerkMiddleware },
      { path: '/examples/*', handler: clerkMiddleware },
    ],
    apiRoutes: [
      echoExampleRoute,
      ...userSkillRoutes,
      chatRoute({
        path: '/chat',
        agent: 'agent',
        version: 'v7',
        heartbeatMs: 15_000,
      }),
    ],
    cors: {
      origin: webOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: false,
    },
  },
});
