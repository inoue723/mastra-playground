import { createFileRoute } from "@tanstack/react-router";

import { ChatLayout } from "#/components/chat-layout";
import { DraftChat } from "#/components/draft-chat";
import { getChatData } from "#/lib/chat-functions";

export const Route = createFileRoute("/")({
  loader: () => getChatData({ data: {} }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <ChatLayout data={Route.useLoaderData()}>
      <DraftChat />
    </ChatLayout>
  );
}
