import { createSkill } from '@mastra/core/skills';
import { skillRepository } from './skill-repository';

export const dynamicSkills = async ({ requestContext }: { requestContext: { get: (key: string) => unknown } }) => {
  const userId = requestContext.get('userId');
  if (typeof userId !== 'string' || !userId) return [];

  const selectedId = requestContext.get('activeSkillId');
  const skills = await skillRepository.listActive(userId, typeof selectedId === 'string' ? selectedId : undefined);

  return skills.map(skill =>
    createSkill({
      name: skill.slug,
      description: skill.description,
      instructions: skill.instructions,
      metadata: { skillId: skill.id },
    }),
  );
};
