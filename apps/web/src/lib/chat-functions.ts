import { auth } from "@clerk/tanstack-react-start/server";
import { MastraClient } from "@mastra/client-js";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { z } from "zod";

import { requireUserId } from "./auth";
import { AGENT_ID } from "./chat";

const threadInput = z.object({
  threadId: z.string().min(1).optional(),
});

const requiredThreadInput = z.object({
  threadId: z.string().min(1),
});

const memoryInput = z.object({
  content: z.string().max(20_000),
});

const USER_MEMORY_THREAD_KIND = "user-memory";

async function createClient() {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) throw new Error("Your session has expired. Please sign in again.");

  return new MastraClient({
    baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Mastra server is unavailable.";
}

async function getUserMemoryThread(client: MastraClient, userId: string) {
  const existing = await client.listMemoryThreads({
    agentId: AGENT_ID,
    resourceId: userId,
    metadata: { kind: USER_MEMORY_THREAD_KIND },
    page: 0,
    perPage: 1,
  });

  const thread = existing.threads[0];
  if (thread) return thread.id;

  const stableThreadId = `user-memory-${createHash("sha256")
    .update(userId)
    .digest("hex")
    .slice(0, 32)}`;
  const created = await client.createMemoryThread({
    agentId: AGENT_ID,
    resourceId: userId,
    threadId: stableThreadId,
    title: "User memory",
    metadata: { kind: USER_MEMORY_THREAD_KIND },
  });

  return created.id;
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
    const userId = await requireUserId();
    const client = await createClient();

    try {
      const result = await client.listMemoryThreads({
        agentId: AGENT_ID,
        resourceId: userId,
        page: 0,
        perPage: 100,
        orderBy: { field: "updatedAt", direction: "DESC" },
      });
      const activeThreadId =
        data.threadId && result.threads.some((thread) => thread.id === data.threadId)
          ? data.threadId
          : undefined;
      const storedMessages = activeThreadId
        ? await client.listThreadMessages(activeThreadId, { agentId: AGENT_ID })
        : { messages: [] };

      return {
        activeThreadId,
        connectionError: null,
        messages: toSerializableMessages(
          toAISdkMessages(storedMessages.messages, { version: "v7" }),
        ),
        threads: result.threads
          .filter((thread) => thread.metadata?.kind !== USER_MEMORY_THREAD_KIND)
          .map((thread) => ({
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
  const userId = await requireUserId();
  const client = await createClient();
  const thread = await client.createMemoryThread({
    agentId: AGENT_ID,
    resourceId: userId,
  });

  return { id: thread.id };
});

export const getThreadTitle = createServerFn({ method: "GET" })
  .validator(requiredThreadInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const client = await createClient();
    const threads = await client.listMemoryThreads({
      agentId: AGENT_ID,
      resourceId: userId,
      page: 0,
      perPage: 100,
    });

    if (!threads.threads.some((thread) => thread.id === data.threadId)) {
      throw new Error("Conversation not found.");
    }

    const thread = await client
      .getMemoryThread({ threadId: data.threadId, agentId: AGENT_ID })
      .get();

    return { title: thread.title };
  });

export const getUserMemory = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const client = await createClient();
  const threadId = await getUserMemoryThread(client, userId);
  const result = await client.getWorkingMemory({
    agentId: AGENT_ID,
    threadId,
    resourceId: userId,
  });

  if (typeof result === "string") return { content: result };
  if (result && typeof result === "object" && "workingMemory" in result) {
    const workingMemory = (result as { workingMemory?: unknown }).workingMemory;
    return { content: typeof workingMemory === "string" ? workingMemory : "" };
  }

  return { content: "" };
});

export const updateUserMemory = createServerFn({ method: "POST" })
  .validator(memoryInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const client = await createClient();
    const threadId = await getUserMemoryThread(client, userId);

    await client.updateWorkingMemory({
      agentId: AGENT_ID,
      threadId,
      resourceId: userId,
      workingMemory: data.content,
    });

    return { content: data.content };
  });
