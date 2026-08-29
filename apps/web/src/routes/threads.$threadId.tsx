import { createFileRoute } from "@tanstack/react-router";

import { ChatLayout } from "#/components/chat-layout";
import { ThreadChat } from "#/components/thread-chat";
import { getChatData } from "#/lib/chat-functions";

export const Route = createFileRoute("/threads/$threadId")({
  loader: ({ params }) => getChatData({ data: { threadId: params.threadId } }),
  component: ThreadPage,
});

function ThreadPage() {
  const data = Route.useLoaderData();
  const { threadId } = Route.useParams();

  return (
    <ChatLayout data={data}>
      <ThreadChat initialMessages={data.messages} threadId={threadId} />
    </ChatLayout>
  );
}
