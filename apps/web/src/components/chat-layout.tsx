import { useState, type ReactNode } from "react";
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";

import type { getChatData } from "#/lib/chat-functions";
import { getBrowserMastraUrl } from "#/lib/chat";

export type ChatPageData = Awaited<ReturnType<typeof getChatData>>;

export function ChatLayout({ children, data }: { children: ReactNode; data: ChatPageData }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Mastra</p>
            <h1>Agent chat</h1>
          </div>
          <Link className="new-thread-button" to="/">
            + New
          </Link>
        </div>

        <div className="auth-controls">
          <Show when="signed-out">
            <SignInButton>
              <button className="auth-button" type="button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="auth-button auth-button-primary" type="button">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
            <StudioButton />
          </Show>
        </div>

        <nav aria-label="Conversation threads" className="thread-list">
          {data.threads.map((thread) => (
            <Link
              activeOptions={{ exact: true }}
              className="thread-link"
              key={thread.id}
              params={{ threadId: thread.id }}
              to="/threads/$threadId"
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
        {data.connectionError ? <ConnectionError message={data.connectionError} /> : children}
      </section>
    </main>
  );
}

function StudioButton() {
  const { getToken } = useAuth();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openStudio() {
    setOpening(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const url = new URL(getBrowserMastraUrl());
      url.searchParams.set("auth_header", `Bearer ${token}`);
      window.location.assign(url.toString());
    } catch {
      setError("Could not open Studio. Please sign in again and retry.");
      setOpening(false);
    }
  }

  return (
    <div>
      <button className="auth-button" type="button" disabled={opening} onClick={openStudio}>
        {opening ? "Opening…" : "Mastra Studio"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
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
