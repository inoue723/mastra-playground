import { createSkill } from '@mastra/core/skills';
import { skillRepository } from './skill-repository';

export const dynamicSkills = async ({ requestContext }: { requestContext: { get: (key: string) => unknown } }) => {
  const userId = requestContext.get('userId');
  const selectedId = requestContext.get('activeSkillId');
  if (selectedId === undefined) return [];
  if (typeof selectedId !== 'string' || !selectedId) throw new Error('Invalid activeSkillId.');
  if (typeof userId !== 'string' || !userId) throw new Error('Skill selection requires an authenticated user.');

  const skills = await skillRepository.listActive(userId, selectedId);
  if (skills.length !== 1) throw new Error('Active skill not found.');

  return skills.map(skill =>
    createSkill({
      name: skill.slug,
      description: skill.description,
      instructions: skill.instructions,
      metadata: { skillId: skill.id, displayName: skill.name },
    }),
  );
};
