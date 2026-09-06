import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { createClerkMiddleware } from './clerk.ts';

function context(header) {
  const requestContext = new RequestContext();
  return {
    requestContext,
    req: { header: () => header },
    get: () => requestContext,
    json: (body, status) => Response.json(body, { status }),
  };
}

test('custom route uses the verified user for memory scoping', async () => {
  const middleware = createClerkMiddleware('test-key', ['http://localhost:3000'], async (token, options) => {
    assert.equal(token, 'valid');
    assert.deepEqual(options.authorizedParties, ['http://localhost:3000']);
    return { sub: 'verified-user' };
  });
  const c = context('Bearer valid');
  c.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'other-user');
  let called = false;
  await middleware(c, async () => { called = true; });
  assert.equal(called, true);
  assert.equal(c.requestContext.get(MASTRA_RESOURCE_ID_KEY), 'verified-user');
});

test('missing, malformed, expired and invalid tokens stop before the route', async () => {
  const middleware = createClerkMiddleware('test-key', [], async () => { throw new Error('invalid or expired'); });
  for (const header of [undefined, 'Basic valid', 'Bearer', 'Bearer expired']) {
    const result = await middleware(context(header), async () => assert.fail('route must not run'));
    assert.equal(result.status, 401);
  }
});
