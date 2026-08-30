import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';
import { verifyToken } from '@clerk/backend';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { agent } from './agents/agent';
import { echoExampleRoute } from './routes/example-routes';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';

const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkSecretKey) {
  throw new Error('CLERK_SECRET_KEY must be set before starting the Mastra server.');
}

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
    auth: {
      protected: ['/*'],
      authenticateToken: async token => {
        try {
          const verifiedToken = await verifyToken(token, {
            authorizedParties: webOrigins,
            secretKey: clerkSecretKey,
          });

          return verifiedToken.sub ? { id: verifiedToken.sub } : null;
        } catch {
          return null;
        }
      },
      mapUserToResourceId: user => user.id,
    },
    apiRoutes: [
      echoExampleRoute,
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
