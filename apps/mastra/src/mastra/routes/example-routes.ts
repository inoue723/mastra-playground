import { createRoute } from '@mastra/server/server-adapter';
import { z } from 'zod';

/** A small schema-backed route used to verify the OpenAPI client-generation flow. */
export const echoExampleRoute = createRoute({
  method: 'GET',
  path: '/examples/echo',
  responseType: 'json',
  queryParamSchema: z.object({
    message: z.string().min(1).max(200),
  }),
  responseSchema: z.object({
    echo: z.string(),
  }),
  summary: 'Echo a query parameter',
  description: 'Returns the validated message supplied in the query string.',
  tags: ['Examples'],
  handler: async ({ message }) => ({ echo: message }),
});
