export type UserSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: 'active' | 'inactive';
};

export async function fetchUserSkills(token: string, status?: UserSkill['status']) {
  const url = new URL('/custom/user-skills', import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111');
  if (status) url.searchParams.set('status', status);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Could not load skills.');
  return (await response.json()) as UserSkill[];
}

export async function mutateUserSkills(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111'}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Skill operation failed.');
  return response.status === 204 ? null : ((await response.json()) as UserSkill);
}
