import { client } from "./generated/mastra-api/client.gen";
import { getExamplesEcho } from "./generated/mastra-api/sdk.gen";
import { getBrowserMastraUrl } from "./chat";

/**
 * Typed SDK generated from Mastra's OpenAPI document.
 *
 * Run `pnpm --filter web generate:mastra-client` after changing API routes.
 */
client.setConfig({ baseUrl: getBrowserMastraUrl() });

export async function echoExample(message: string) {
  const { data, error } = await getExamplesEcho({
    query: { message },
  });

  if (error) throw new Error("The Mastra echo endpoint returned an error.");
  return data;
}
