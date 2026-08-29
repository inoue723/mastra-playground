export const AGENT_ID = "agent";
export const RESOURCE_ID = "local-user";

export function getBrowserMastraUrl() {
  return import.meta.env.VITE_MASTRA_API_URL || "http://localhost:4111";
}
