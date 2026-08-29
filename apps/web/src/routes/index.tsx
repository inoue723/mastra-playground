import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";

import { AGENT_ID, RESOURCE_ID, getBrowserMastraUrl } from "#/lib/chat";
import { createThread, getChatData } from "#/lib/chat-functions";

type Search = {
  thread?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  loaderDeps: ({ search }) => ({ threadId: search.thread }),
  loader: ({ deps }) => getChatData({ data: deps }),
  component: ChatPage,
});

function ChatPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const createThreadFn = useServerFn(createThread);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateThread() {
    setIsCreating(true);
    try {
      const thread = await createThreadFn();
      await navigate({ to: "/", search: { thread: thread.id } });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Mastra</p>
            <h1>Agent chat</h1>
          </div>
          <button
            className="new-thread-button"
            disabled={isCreating || Boolean(data.connectionError)}
            onClick={handleCreateThread}
            type="button"
          >
            {isCreating ? "Creating…" : "+ New"}
          </button>
        </div>

        <nav aria-label="Conversation threads" className="thread-list">
          {data.threads.map((thread) => (
            <Link
              activeOptions={{ exact: true, includeSearch: true }}
              className="thread-link"
              key={thread.id}
              search={{ thread: thread.id }}
              to="/"
            >
              <span>{thread.title || "New conversation"}</span>
              <time>{formatDate(thread.updatedAt)}</time>
            </Link>
          ))}
          {!data.connectionError && data.threads.length === 0 ? (
            <p className="sidebar-empty">No conversations yet.</p>
          ) : null}
        </nav>
      </aside>

      <section className="chat-column">
        {data.connectionError ? (
          <ConnectionError message={data.connectionError} />
        ) : data.activeThreadId ? (
          <Chat
            initialMessages={data.messages}
            key={data.activeThreadId}
            threadId={data.activeThreadId}
          />
        ) : (
          <EmptyChat onCreate={handleCreateThread} />
        )}
      </section>
    </main>
  );
}

function Chat({ initialMessages, threadId }: { initialMessages: UIMessage[]; threadId: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${getBrowserMastraUrl()}/chat`,
        prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              messages,
              memory: {
                resource: RESOURCE_ID,
                thread: threadId,
              },
            },
          };
        },
      }),
    [threadId],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void router.invalidate();
    },
  });
  const isBusy = status === "submitted" || status === "streaming";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <>
      <header className="chat-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>{threadId.slice(0, 8)}</h2>
        </div>
        <span className={`status-dot ${isBusy ? "is-busy" : ""}`}>
          {isBusy ? "Thinking" : "Ready"}
        </span>
      </header>

      <div aria-live="polite" className="messages">
        {messages.length === 0 ? (
          <div className="conversation-empty">
            <p className="eyebrow">Start here</p>
            <h2>What would you like to work on?</h2>
            <p>The agent can research, work with files, and use its configured tools.</p>
          </div>
        ) : (
          messages.map((message) => <Message key={message.id} message={message} />)
        )}
        {status === "submitted" ? <div className="thinking">Thinking…</div> : null}
      </div>

      <div className="composer-wrap">
        {error ? <p className="chat-error">{error.message}</p> : null}
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="Message"
            disabled={isBusy}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message the agent…"
            rows={1}
            value={input}
          />
          {isBusy ? (
            <button className="send-button stop-button" onClick={() => void stop()} type="button">
              Stop
            </button>
          ) : (
            <button className="send-button" disabled={!input.trim()} type="submit">
              Send
            </button>
          )}
        </form>
      </div>
    </>
  );
}

function Message({ message }: { message: UIMessage }) {
  return (
    <article className={`message message-${message.role}`}>
      <div className="message-label">{message.role === "assistant" ? AGENT_ID : "You"}</div>
      <div className="message-content">
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return <p key={`${message.id}-${index}`}>{part.text}</p>;
          }
          if (part.type === "reasoning") {
            return (
              <details key={`${message.id}-${index}`}>
                <summary>Reasoning</summary>
                <p>{part.text}</p>
              </details>
            );
          }
          if (part.type === "step-start") return null;
          return (
            <div className="tool-part" key={`${message.id}-${index}`}>
              {part.type.replaceAll("-", " ")}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function EmptyChat({ onCreate }: { onCreate: () => Promise<void> }) {
  return (
    <div className="center-state">
      <p className="eyebrow">No active conversation</p>
      <h2>Create a thread to start chatting.</h2>
      <button className="primary-button" onClick={() => void onCreate()} type="button">
        New conversation
      </button>
    </div>
  );
}

function ConnectionError({ message }: { message: string }) {
  return (
    <div className="center-state error-state">
      <p className="eyebrow">Connection error</p>
      <h2>Mastra server is not reachable.</h2>
      <p>{message}</p>
      <p>
        Start it with <code>pnpm dev:mastra</code>, then reload this page.
      </p>
    </div>
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
