import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { PENDING_MESSAGE_PREFIX } from "#/lib/chat";
import { createThread } from "#/lib/chat-functions";

export function DraftChat() {
  const navigate = useNavigate();
  const createThreadFn = useServerFn(createThread);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isCreating) return;

    setIsCreating(true);
    setError(undefined);
    try {
      const thread = await createThreadFn();
      sessionStorage.setItem(`${PENDING_MESSAGE_PREFIX}${thread.id}`, text);
      await navigate({
        to: "/threads/$threadId",
        params: { threadId: thread.id },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the conversation.");
      setIsCreating(false);
    }
  }

  return (
    <>
      <header className="chat-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>New conversation</h2>
        </div>
        <span className={`status-dot ${isCreating ? "is-busy" : ""}`}>
          {isCreating ? "Starting" : "Ready"}
        </span>
      </header>

      <div className="messages">
        <div className="conversation-empty">
          <p className="eyebrow">Start here</p>
          <h2>What would you like to work on?</h2>
          <p>The agent can research, work with files, and use its configured tools.</p>
        </div>
      </div>

      <div className="composer-wrap">
        {error ? <p className="chat-error">{error}</p> : null}
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            aria-label="Message"
            autoFocus
            disabled={isCreating}
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
          <button className="send-button" disabled={!input.trim() || isCreating} type="submit">
            Send
          </button>
        </form>
      </div>
    </>
  );
}
