import { getBrowserMastraUrl } from './chat';
import { client } from './generated/mastra-api/client.gen';
import {
  deleteCustomUserSkillsById,
  getCustomUserSkills,
  patchCustomUserSkillsById,
  postCustomUserSkills,
  postCustomUserSkillsByIdActivate,
  postCustomUserSkillsByIdDeactivate,
} from './generated/mastra-api/sdk.gen';

client.setConfig({ baseUrl: getBrowserMastraUrl() });

export type UserSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: 'active' | 'inactive';
};

type SkillInput = { name: string; description: string; instructions: string };

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function unwrap<T>({ data, error }: { data?: T; error?: unknown }): T {
  if (error !== undefined) {
    const message = typeof error === 'object' && error && 'error' in error ? String((error as { error: unknown }).error) : undefined;
    throw new Error(message || 'Skill operation failed.');
  }
  return data as T;
}

export async function fetchUserSkills(token: string, status?: UserSkill['status']) {
  return unwrap(await getCustomUserSkills({ query: status ? { status } : undefined, headers: authHeaders(token) }));
}

export async function createUserSkill(token: string, input: SkillInput) {
  return unwrap(await postCustomUserSkills({ body: input, headers: authHeaders(token) }));
}

export async function updateUserSkill(token: string, id: string, input: SkillInput) {
  return unwrap(await patchCustomUserSkillsById({ path: { id }, body: input, headers: authHeaders(token) }));
}

export async function deleteUserSkill(token: string, id: string) {
  await unwrap(await deleteCustomUserSkillsById({ path: { id }, headers: authHeaders(token) }));
}

export async function setUserSkillActive(token: string, id: string, active: boolean) {
  const setStatus = active ? postCustomUserSkillsByIdActivate : postCustomUserSkillsByIdDeactivate;
  return unwrap(await setStatus({ path: { id }, headers: authHeaders(token) }));
}
