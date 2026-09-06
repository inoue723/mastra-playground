import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { skillRepository } from '../skills/skill-repository';

const skillBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  instructions: z.string().trim().min(1).max(50_000),
});
const idSchema = z.string().uuid();

function userId(c: any) {
  const value = c.get('requestContext')?.get('userId');
  if (typeof value !== 'string' || !value) throw new Error('Unauthorized');
  return value;
}

function slugify(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `skill-${randomUUID().slice(0, 8)}`;
}

function route(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', handler: (c: any) => Promise<Response>) {
  return registerApiRoute(path, { method, handler });
}

export const userSkillRoutes = [
  route('/custom/user-skills', 'GET', async c => {
    const status = c.req.query('status');
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      return c.json({ error: 'status must be active or inactive.' }, 400);
    }
    return c.json(await skillRepository.list(userId(c), status));
  }),
  route('/custom/user-skills', 'POST', async c => {
    const body = skillBody.parse(await c.req.json());
    const skill = await skillRepository.create({ userId: userId(c), ...body, slug: slugify(body.name) });
    return c.json(skill, 201);
  }),
  route('/custom/user-skills/:id', 'GET', async c => {
    const skill = await skillRepository.get(userId(c), idSchema.parse(c.req.param('id')));
    return skill ? c.json(skill) : c.json({ error: 'Skill not found.' }, 404);
  }),
  route('/custom/user-skills/:id', 'PATCH', async c => {
    const body = skillBody.partial().parse(await c.req.json());
    const skill = await skillRepository.update(userId(c), idSchema.parse(c.req.param('id')), {
      ...body,
      ...(body.name ? { slug: slugify(body.name) } : {}),
    });
    return skill ? c.json(skill) : c.json({ error: 'Skill not found.' }, 404);
  }),
  route('/custom/user-skills/:id', 'DELETE', async c => {
    const removed = await skillRepository.remove(userId(c), idSchema.parse(c.req.param('id')));
    return removed ? c.body(null, 204) : c.json({ error: 'Skill not found.' }, 404);
  }),
  route('/custom/user-skills/:id/activate', 'POST', async c => {
    const skill = await skillRepository.setStatus(userId(c), idSchema.parse(c.req.param('id')), 'active');
    return skill ? c.json(skill) : c.json({ error: 'Skill not found.' }, 404);
  }),
  route('/custom/user-skills/:id/deactivate', 'POST', async c => {
    const skill = await skillRepository.setStatus(userId(c), idSchema.parse(c.req.param('id')), 'inactive');
    return skill ? c.json(skill) : c.json({ error: 'Skill not found.' }, 404);
  }),
];
