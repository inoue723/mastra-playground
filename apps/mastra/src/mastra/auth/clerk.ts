import { verifyToken } from '@clerk/backend';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { Middleware } from '@mastra/core/server';

type MiddlewareHandler = Exclude<Middleware, { handler: unknown }>;

/** Route-scoped authentication so local Studio and built-in APIs stay public. */
export function createClerkMiddleware(
  secretKey: string,
  authorizedParties: string[],
  verify = verifyToken,
): MiddlewareHandler {
  return async (c, next) => {
    const match = c.req.header('Authorization')?.match(/^Bearer\s+(\S+)\s*$/i);
    if (!match) return c.json({ error: 'Unauthorized' }, 401);

    let userId: string;
    try {
      const verified = await verify(match[1]!, { secretKey, authorizedParties });
      if (!verified.sub) return c.json({ error: 'Unauthorized' }, 401);
      userId = verified.sub;
    } catch {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const requestContext = c.get('requestContext');
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
    await next();
  };
}
