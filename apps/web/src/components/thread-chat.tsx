import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/tanstack-react-start";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";

import { AGENT_ID, PENDING_MESSAGE_PREFIX, getBrowserMastraUrl } from "#/lib/chat";
import { getThreadTitle } from "#/lib/chat-functions";

const TITLE_POLL_ATTEMPTS = 5;
const TITLE_POLL_INTERVAL_MS = 2000;

export function ThreadChat({
  initialMessages,
  threadId,
}: {
  initialMessages: UIMessage[];
  threadId: string;
}) {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const getThreadTitleFn = useServerFn(getThreadTitle);
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${getBrowserMastraUrl()}/chat`,
        async prepareSendMessagesRequest({ messages, trigger }) {
          const token = await getToken();
          if (!token) throw new Error("Your session has expired. Please sign in again.");

          const messagesToSend =
            trigger === "submit-message" && messages.at(-1)?.role === "user"
              ? messages.slice(-1)
              : messages;
          return {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              messages: messagesToSend,
              memory: {
                resource: userId,
                thread: threadId,
              },
            },
          };
        },
      }),
    [getToken, threadId, userId],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void refreshGeneratedTitle();
    },
  });
  const isBusy = status === "submitted" || status === "streaming";

  async function refreshGeneratedTitle() {
    for (let attempt = 0; attempt < TITLE_POLL_ATTEMPTS; attempt += 1) {
      try {
        const result = await getThreadTitleFn({ data: { threadId } });
        if (result.title) break;
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, TITLE_POLL_INTERVAL_MS));
    }

    await router.invalidate();
  }

  useEffect(() => {
    const storageKey = `${PENDING_MESSAGE_PREFIX}${threadId}`;
    const pendingMessage = sessionStorage.getItem(storageKey);
    if (!pendingMessage) return;

    sessionStorage.removeItem(storageKey);
    void sendMessage({ text: pendingMessage });
  }, [sendMessage, threadId]);

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
