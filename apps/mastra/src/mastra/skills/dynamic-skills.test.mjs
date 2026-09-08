import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RequestContext } from '@mastra/core/request-context';
import { agent } from '../agents/agent.ts';
import { skillRepository } from './skill-repository.ts';
import { MessageList } from '@mastra/core/agent';
import { skillActivationProcessor } from './skill-activation.ts';

async function getInstructions(options) {
  const messageList = new MessageList();
  await skillActivationProcessor.processInput({ ...options, state: {}, messageList });
  return `${await agent.getInstructions(options)}\n${JSON.stringify(messageList.getSystemMessages('selected-skill'))}`;
}

const selectedSkill = {
  id: 'cc3a2e26-5447-4e5c-98a5-cb524f77d018',
  userId: 'user-a',
  name: 'Selected skill',
  slug: 'selected-skill',
  description: 'A selected skill',
  instructions: 'Always include the exact phrase: selected skill loaded.',
};

function context(userId, activeSkillId) {
  const requestContext = new RequestContext();
  requestContext.set('userId', userId);
  requestContext.set('activeSkillId', activeSkillId);
  return { requestContext };
}

test('no selection exposes no skills and does not query the repository', async t => {
  t.mock.method(skillRepository, 'listActive', async () => assert.fail('No skill lookup expected'));
  const options = context('user-a');
  assert.deepEqual(await agent.listSkills(options), []);
  const instructions = await getInstructions(options);
  assert.match(instructions, /No skill is selected/);
  assert.ok(!instructions.includes(selectedSkill.instructions));
});

test('selection injects the full body before any model or skill tool call', async t => {
  t.mock.method(skillRepository, 'listActive', async (userId, skillId) => {
    assert.equal(userId, selectedSkill.userId);
    assert.equal(skillId, selectedSkill.id);
    return [selectedSkill];
  });
  const options = context(selectedSkill.userId, selectedSkill.id);
  const instructions = await getInstructions(options);
  assert.ok(instructions.includes(selectedSkill.instructions));
  assert.match(instructions, /friendly starter agent/);
  assert.deepEqual((await agent.listSkills(options)).map(skill => skill.name), [selectedSkill.slug]);

  // A subsequent request with no selection must not inherit the activation.
  const next = await getInstructions(context(selectedSkill.userId));
  assert.ok(!next.includes(selectedSkill.instructions));
});

test('missing, inactive, or another user\'s skill fails instead of silently continuing', async t => {
  t.mock.method(skillRepository, 'listActive', async (userId, skillId) => {
    assert.equal(userId, 'user-b');
    assert.equal(skillId, selectedSkill.id);
    return [];
  });
  await assert.rejects(getInstructions(context('user-b', selectedSkill.id)), /Active skill not found/);
});

test('invalid or unauthenticated selection fails before a database query', async t => {
  t.mock.method(skillRepository, 'listActive', async () => assert.fail('No skill lookup expected'));
  await assert.rejects(getInstructions(context('user-a', '')), /Invalid activeSkillId/);
  await assert.rejects(getInstructions(context(undefined, selectedSkill.id)), /authenticated user/);
});
