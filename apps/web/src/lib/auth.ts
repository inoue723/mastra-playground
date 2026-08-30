import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";

export async function requireUserId() {
  const { userId } = await auth();

  if (!userId) {
    throw redirect({ to: "/sign-in/$", params: { _splat: "" } });
  }

  return userId;
}
