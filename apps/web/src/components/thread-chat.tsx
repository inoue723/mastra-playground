import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/tanstack-react-start";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";

import { AGENT_ID, PENDING_MESSAGE_PREFIX, PENDING_SKILL_PREFIX, getBrowserMastraUrl } from "#/lib/chat";
import { getThreadTitle } from "#/lib/chat-functions";
import { isSkillActivationPart } from "#/lib/skill-activation";
import { SkillPicker } from "./skill-picker";

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
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${getBrowserMastraUrl()}/chat`,
        async prepareSendMessagesRequest({ messages, trigger, body }) {
          const token = await getToken();
          if (!token) throw new Error("Your session has expired. Please sign in again.");

          const messagesToSend =
            trigger === "submit-message" && messages.at(-1)?.role === "user"
              ? messages.slice(-1)
              : messages;
          // The first message can be sent before the restored selection re-renders.
          const activeSkillId = body?.activeSkillId ?? selectedSkillId;
          return {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              messages: messagesToSend,
              memory: {
                resource: userId,
                thread: threadId,
              },
              ...(activeSkillId ? { activeSkillId } : {}),
            },
          };
        },
      }),
    [getToken, selectedSkillId, threadId, userId],
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

    const skillKey = `${PENDING_SKILL_PREFIX}${threadId}`;
    const pendingSkillId = sessionStorage.getItem(skillKey) ?? "";
    setSelectedSkillId(pendingSkillId);
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(skillKey);
    void sendMessage({ text: pendingMessage }, { body: { activeSkillId: pendingSkillId } });
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
        <SkillPicker value={selectedSkillId} onChange={setSelectedSkillId} disabled={isBusy} />
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
          if (isSkillActivationPart(part)) {
            return (
              <div className="skill-activation" key={part.id ?? `${message.id}-${index}`}>
                <span aria-hidden="true">✓</span> {part.data.name} · 読み込み済み
              </div>
            );
          }
          if (part.type === "text") {
            return (
              <Streamdown key={`${message.id}-${index}`} plugins={{ code }}>
                {part.text}
              </Streamdown>
            );
          }
          if (part.type === "reasoning") {
            return (
              <details key={`${message.id}-${index}`}>
                <summary>Reasoning</summary>
                <Streamdown plugins={{ code }}>{part.text}</Streamdown>
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
