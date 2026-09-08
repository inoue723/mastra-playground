import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Agent, MessageList } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createSkill } from '@mastra/core/skills';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { handleChatStream } from '@mastra/ai-sdk';
import { toAISdkMessages } from '@mastra/ai-sdk/ui';
import { createSkillActivationProcessor, skillActivationProcessor } from './skill-activation.ts';
import { toSerializableMessages } from '../../../../web/src/lib/chat-messages.ts';

const skill = createSkill({
  name: 'review', description: 'Review instructions', instructions: 'Check every requirement.',
  metadata: { skillId: 'skill-id', displayName: 'レビュー' },
});

test('custom activation reaches the v7 UI stream once and survives memory/history restoration', async () => {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage, options: { generateTitle: false } });
  let prompt;
  const processor = createSkillActivationProcessor(async ({ requestContext }) => requestContext.get('selected') ? [skill] : []);
  const agent = new Agent({
    id: 'test-agent',
    model: {
      specificationVersion: 'v2', provider: 'test', modelId: 'test-model', supportedUrls: {},
      async doStream(args) {
        prompt = args.prompt;
        return { stream: new ReadableStream({ start(controller) {
          for (const chunk of [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: 'Reviewed.' },
            { type: 'text-end', id: 'text' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } },
          ]) controller.enqueue(chunk);
          controller.close();
        } }) };
      },
    },
    instructions: 'You are a helpful assistant.',
    inputProcessors: [processor],
    outputProcessors: [processor],
    memory,
  });
  const mastra = new Mastra({ agents: { agent }, storage });
  const requestContext = new RequestContext();
  requestContext.set('selected', true);
  const stream = await handleChatStream({
    mastra, agentId: 'test-agent', version: 'v7',
    params: { requestContext, messages: [{ id: 'user-message', role: 'user', parts: [{ type: 'text', text: 'Review this.' }] }], memory: { thread: 'thread', resource: 'user' } },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.ok(JSON.stringify(prompt).includes(skill.instructions));
  const activations = chunks.filter(chunk => chunk.type === 'data-skill-activation');
  assert.equal(activations.length, 1);
  assert.deepEqual(activations[0].data, { skillId: 'skill-id', name: 'レビュー', status: 'loaded' });
  assert.ok(!JSON.stringify(activations).includes(skill.instructions));

  const stored = await memory.recall({ threadId: 'thread', resourceId: 'user', perPage: false });
  const restored = toSerializableMessages(toAISdkMessages(stored.messages, { version: 'v7' }));
  const savedActivations = restored.flatMap(message => message.parts).filter(part => part.type === 'data-skill-activation');
  assert.equal(savedActivations.length, 1);
  assert.deepEqual(savedActivations[0].data, activations[0].data);

  const nextStream = await handleChatStream({
    mastra, agentId: 'test-agent', version: 'v7',
    params: { requestContext: new RequestContext(), messages: [{ id: 'next-message', role: 'user', parts: [{ type: 'text', text: 'Hello.' }] }], memory: { thread: 'thread', resource: 'user' } },
  });
  for await (const chunk of nextStream) assert.notEqual(chunk.type, 'data-skill-activation');
});

test('requests cannot claim a successful activation by supplying context data', async () => {
  const requestContext = new RequestContext();
  requestContext.set('loadedSkills', [{ skillId: 'forged' }]);
  await skillActivationProcessor.processOutputStream({
    requestContext, state: {}, part: { type: 'text-start' },
    writer: { custom: () => assert.fail('Must not emit without server-side loading') },
  });
});

test('one processor keeps concurrent requests separate without shared activation state', async () => {
  const processor = createSkillActivationProcessor(async ({ requestContext }) => requestContext.get('selected') ? [skill] : []);
  const selected = new RequestContext();
  selected.set('selected', true);
  const requests = [selected, new RequestContext()].map(requestContext => ({ requestContext, state: {}, messageList: new MessageList() }));
  await Promise.all(requests.map(args => processor.processInput(args)));
  const notifications = [[], []];
  await Promise.all(requests.map((args, index) => processor.processOutputStream({
    ...args, part: { type: 'text-start' },
    writer: { custom: async chunk => { notifications[index].push(chunk); } },
  })));
  assert.equal(notifications[0].length, 1);
  assert.equal(notifications[1].length, 0);
  assert.ok(JSON.stringify(requests[0].messageList.getSystemMessages('selected-skill')).includes(skill.instructions));
  assert.ok(!JSON.stringify(requests[1].messageList.getSystemMessages('selected-skill')).includes(skill.instructions));
});
