# Mastra Playground

A pnpm workspace with a Mastra agent server and a small TanStack Start chat UI.

## Apps

- `apps/mastra`: Mastra server, agent, memory, tools, and the AI SDK v7 chat route
- `apps/web`: TanStack Start SSR app with Tailwind CSS, Oxc, threads, and streaming chat

## Setup

```sh
pnpm install
cp apps/mastra/.env.example apps/mastra/.env
cp apps/web/.env.example apps/web/.env
```

Set `OPENAI_API_KEY` in `apps/mastra/.env`, then start both apps:

```sh
pnpm dev
```

- Web: http://localhost:3000
- Mastra Studio: http://localhost:4111
- AI SDK chat route: http://localhost:4111/chat

The initial thread list and selected thread history are loaded through TanStack Start SSR. Chat messages stream directly from the browser to the Mastra chat route with AI SDK `useChat`.

`RESOURCE_ID` is intentionally fixed to `local-user` for this local playground. Replace it with an authenticated user ID before exposing the app publicly.

## Commands

```sh
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
```

## Deployment

Set `MASTRA_API_URL` to the server-side Mastra URL and `VITE_MASTRA_API_URL` to the URL reachable by browsers. Set `WEB_ORIGIN` on the Mastra app to the allowed web origin; multiple origins can be comma-separated.

If production requires a single origin, put a transparent reverse proxy in front of `/chat`. Preserve the upstream response body, streaming headers, and request abort signal, and disable response buffering. Do not parse and reconstruct the AI SDK stream in the proxy.
