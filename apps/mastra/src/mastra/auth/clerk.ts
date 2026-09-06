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
    requestContext.set('userId', userId);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
    await next();
  };
}

/** Adds the optional skill selection to the same request context used by the Agent. */
export function createSkillSelectionMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    if (c.req.method === 'POST') {
      try {
        const body = await c.req.raw.clone().json();
        const selectedId = body?.activeSkillId;
        if (selectedId !== undefined && (typeof selectedId !== 'string' || !selectedId)) {
          return c.json({ error: 'activeSkillId must be a non-empty string.' }, 400);
        }
        if (selectedId) {
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedId)) {
            return c.json({ error: 'activeSkillId must be a UUID.' }, 400);
          }
          const { skillRepository } = await import('../skills/skill-repository');
          const currentUserId = c.get('requestContext')?.get('userId');
          const selected = await skillRepository.listActive(String(currentUserId), selectedId);
          if (selected.length !== 1) return c.json({ error: 'Active skill not found.' }, 404);
        }
        c.get('requestContext').set('activeSkillId', selectedId);
      } catch {
        return c.json({ error: 'Invalid chat request.' }, 400);
      }
    }
    await next();
  };
}

export function combineMiddleware(...middleware: MiddlewareHandler[]): MiddlewareHandler {
  return async (c, next) => {
    let index = -1;
    const dispatch = async (position: number): Promise<void | Response> => {
      if (position <= index) throw new Error('Middleware called next more than once.');
      index = position;
      const current = middleware[position];
      if (!current) return next();
      return current(c, async () => {
        await dispatch(position + 1);
      });
    };
    return dispatch(0);
  };
}
