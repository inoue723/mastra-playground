import { createRoute } from '@mastra/server/server-adapter';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { skillRepository } from '../skills/skill-repository';

const skillBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  instructions: z.string().trim().min(1).max(50_000),
});
const idPathSchema = z.object({ id: z.string().uuid() });
const statusQuerySchema = z.object({ status: z.enum(['active', 'inactive']).optional() });
const skillSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  instructions: z.string(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Thrown to return a specific HTTP status from a route handler. */
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function requireUserId(requestContext: { get(key: string): unknown }) {
  const value = requestContext.get('userId');
  if (typeof value !== 'string' || !value) throw new HttpError(401, 'Unauthorized');
  return value;
}

function slugify(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `skill-${randomUUID().slice(0, 8)}`;
}

const listUserSkillsRoute = createRoute({
  method: 'GET',
  path: '/custom/user-skills',
  responseType: 'json',
  queryParamSchema: statusQuerySchema,
  responseSchema: z.array(skillSchema),
  summary: 'List the caller’s skills',
  description: 'Returns the authenticated user’s skills, optionally filtered by status.',
  tags: ['User Skills'],
  handler: async ({ status, requestContext }) => skillRepository.list(requireUserId(requestContext), status),
});

const createUserSkillRoute = createRoute({
  method: 'POST',
  path: '/custom/user-skills',
  responseType: 'json',
  bodySchema: skillBody,
  responseSchema: skillSchema,
  summary: 'Create a skill',
  description: 'Creates a new skill owned by the authenticated user.',
  tags: ['User Skills'],
  handler: async ({ name, description, instructions, requestContext }) =>
    skillRepository.create({ userId: requireUserId(requestContext), name, description, instructions, slug: slugify(name) }),
});

const getUserSkillRoute = createRoute({
  method: 'GET',
  path: '/custom/user-skills/:id',
  responseType: 'json',
  pathParamSchema: idPathSchema,
  responseSchema: skillSchema,
  summary: 'Get a skill',
  description: 'Returns a single skill owned by the authenticated user.',
  tags: ['User Skills'],
  handler: async ({ id, requestContext }) => {
    const skill = await skillRepository.get(requireUserId(requestContext), id);
    if (!skill) throw new HttpError(404, 'Skill not found.');
    return skill;
  },
});

const updateUserSkillRoute = createRoute({
  method: 'PATCH',
  path: '/custom/user-skills/:id',
  responseType: 'json',
  pathParamSchema: idPathSchema,
  bodySchema: skillBody.partial(),
  responseSchema: skillSchema,
  summary: 'Update a skill',
  description: 'Updates one or more fields of a skill owned by the authenticated user.',
  tags: ['User Skills'],
  handler: async ({ id, name, description, instructions, requestContext }) => {
    const skill = await skillRepository.update(requireUserId(requestContext), id, {
      name,
      description,
      instructions,
      ...(name ? { slug: slugify(name) } : {}),
    });
    if (!skill) throw new HttpError(404, 'Skill not found.');
    return skill;
  },
});

const deleteUserSkillRoute = createRoute({
  method: 'DELETE',
  path: '/custom/user-skills/:id',
  responseType: 'json',
  pathParamSchema: idPathSchema,
  summary: 'Delete a skill',
  description: 'Deletes a skill owned by the authenticated user.',
  tags: ['User Skills'],
  handler: async ({ id, requestContext }) => {
    const removed = await skillRepository.remove(requireUserId(requestContext), id);
    if (!removed) throw new HttpError(404, 'Skill not found.');
    return null;
  },
});

const activateUserSkillRoute = createRoute({
  method: 'POST',
  path: '/custom/user-skills/:id/activate',
  responseType: 'json',
  pathParamSchema: idPathSchema,
  responseSchema: skillSchema,
  summary: 'Activate a skill',
  description: 'Marks a skill owned by the authenticated user as active.',
  tags: ['User Skills'],
  handler: async ({ id, requestContext }) => {
    const skill = await skillRepository.setStatus(requireUserId(requestContext), id, 'active');
    if (!skill) throw new HttpError(404, 'Skill not found.');
    return skill;
  },
});

const deactivateUserSkillRoute = createRoute({
  method: 'POST',
  path: '/custom/user-skills/:id/deactivate',
  responseType: 'json',
  pathParamSchema: idPathSchema,
  responseSchema: skillSchema,
  summary: 'Deactivate a skill',
  description: 'Marks a skill owned by the authenticated user as inactive.',
  tags: ['User Skills'],
  handler: async ({ id, requestContext }) => {
    const skill = await skillRepository.setStatus(requireUserId(requestContext), id, 'inactive');
    if (!skill) throw new HttpError(404, 'Skill not found.');
    return skill;
  },
});

export const userSkillRoutes = [
  listUserSkillsRoute,
  createUserSkillRoute,
  getUserSkillRoute,
  updateUserSkillRoute,
  deleteUserSkillRoute,
  activateUserSkillRoute,
  deactivateUserSkillRoute,
];
