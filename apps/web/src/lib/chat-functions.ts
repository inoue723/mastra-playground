import { MastraClient } from "@mastra/client-js";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AGENT_ID, RESOURCE_ID } from "./chat";

const threadInput = z.object({
  threadId: z.string().min(1).optional(),
});

function createClient() {
  return new MastraClient({
    baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Mastra server is unavailable.";
}

type SerializableMessagePart = { type: "text"; text: string } | { type: "reasoning"; text: string };

function toSerializableMessages(messages: ReturnType<typeof toAISdkMessages>) {
  return messages.map((message) => {
    const parts: SerializableMessagePart[] = [];

    for (const part of message.parts) {
      if (part.type === "text") parts.push({ type: "text", text: part.text });
      if (part.type === "reasoning") parts.push({ type: "reasoning", text: part.text });
    }

    return { id: message.id, role: message.role, parts };
  });
}

export const getChatData = createServerFn({ method: "GET" })
  .validator(threadInput)
  .handler(async ({ data }) => {
    const client = createClient();

    try {
      const result = await client.listMemoryThreads({
        agentId: AGENT_ID,
        resourceId: RESOURCE_ID,
        page: 0,
        perPage: 100,
        orderBy: { field: "updatedAt", direction: "DESC" },
      });
      const activeThreadId =
        data.threadId && result.threads.some((thread) => thread.id === data.threadId)
          ? data.threadId
          : result.threads[0]?.id;
      const storedMessages = activeThreadId
        ? await client.listThreadMessages(activeThreadId, { agentId: AGENT_ID })
        : { messages: [] };

      return {
        activeThreadId,
        connectionError: null,
        messages: toSerializableMessages(
          toAISdkMessages(storedMessages.messages, { version: "v7" }),
        ),
        threads: result.threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          updatedAt: thread.updatedAt,
        })),
      };
    } catch (error) {
      return {
        activeThreadId: undefined,
        connectionError: errorMessage(error),
        messages: [],
        threads: [],
      };
    }
  });

export const createThread = createServerFn({ method: "POST" }).handler(async () => {
  const client = createClient();
  const thread = await client.createMemoryThread({
    agentId: AGENT_ID,
    resourceId: RESOURCE_ID,
    threadId: crypto.randomUUID(),
  });
  return { id: thread.id };
});
