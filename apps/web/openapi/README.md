# Mastra OpenAPI specification

`mastra.openapi.json` is downloaded from the running Mastra server by
`pnpm generate:mastra-client`. It is intentionally ignored by Git because the
full Mastra document is large. Do not edit it manually.

`mastra-client.openapi.json` is an automatically generated subset containing
only routes tagged `Examples`. This avoids invalid references currently emitted
by some of Mastra's built-in routes while keeping the custom-route SDK fully
generated from the server's OpenAPI document via `@hey-api/openapi-ts`.
