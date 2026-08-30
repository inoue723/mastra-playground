import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceUrl = process.env.MASTRA_OPENAPI_URL ?? "http://localhost:4111/api/openapi.json";
const outputDir = resolve(import.meta.dirname, "../openapi");
const fullSpecPath = resolve(outputDir, "mastra.openapi.json");
const clientSpecPath = resolve(outputDir, "mastra-client.openapi.json");

const response = await fetch(sourceUrl);

if (!response.ok) {
  throw new Error(
    `Could not fetch Mastra OpenAPI document: ${response.status} ${response.statusText}`,
  );
}

const fullSpec = await response.json();
const clientPaths = Object.fromEntries(
  Object.entries(fullSpec.paths).filter(([, pathItem]) =>
    Object.values(pathItem).some((operation) => operation?.tags?.includes("Examples")),
  ),
);

const clientSpec = {
  openapi: fullSpec.openapi,
  info: fullSpec.info,
  paths: clientPaths,
};

await mkdir(dirname(fullSpecPath), { recursive: true });
await writeFile(fullSpecPath, `${JSON.stringify(fullSpec, null, 2)}\n`);
await writeFile(clientSpecPath, `${JSON.stringify(clientSpec, null, 2)}\n`);

console.log(`Downloaded ${sourceUrl}`);
console.log(`Selected ${Object.keys(clientPaths).length} custom route(s) tagged Examples.`);
