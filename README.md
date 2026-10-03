# lit-query-codegen

Generate feature-based API clients and TanStack Lit Query options from an OpenAPI specification:

```text
OpenAPI 3 JSON → Orval Fetch Client → Transformation → Lit Query / Mutation Options
```

The generator, CLI, fetch runtime, configuration examples and tests are written in
TypeScript. The build produces ESM JavaScript and type declarations in `dist/`.

Each OpenAPI tag gets its own directory containing `api.ts`, `models.ts`,
`queries.ts`, `mutations.ts` and `index.ts`. Query and mutation files are only
generated when the feature has matching operations. The root `index.ts` exports
features as namespaces. Shared models are generated within each feature to keep
the feature directories independent.

The transformation removes Orval's URL and header helpers, encodes path parameters
with `encodeURIComponent`, passes query parameters to the fetch mutator and leaves
JSON body serialization to the runtime. Query options include stable keys and
forward the query's `AbortSignal`. Mutations with multiple inputs use typed tuples.

## Installation

Requires **Node.js 22.18.0 or later**. Orval, TypeScript and Prettier are included
as package dependencies. Your application also needs `@tanstack/lit-query` and its
runtime dependencies.

To install a local package before it is published to a registry:

```bash
# In the package directory
npm install
npm pack

# In your application; adjust the path to the generated tarball
npm install /path/to/lit-query-codegen-0.1.0.tgz
npm install @tanstack/lit-query
```

For local development, you can install directly from the package directory with
`npm install /path/to/lit-query-codegen`. If you use your own fetch mutator instead
of `lit-query-codegen/runtime`, the generator can be installed with `--save-dev`.

## Configuration and CLI

Create `lit-query-codegen.config.ts` in your application:

```ts
import { defineConfig } from "lit-query-codegen";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/api/generated",
});
```

All file paths are resolved relative to the configuration file. Formatting follows
your project's Prettier configuration. Override individual options with, for
example, `prettier: { printWidth: 100 }`.

Add generation and drift-check commands to your `package.json`:

```json
{
  "scripts": {
    "api:generate": "lit-query-codegen",
    "api:check": "lit-query-codegen --check"
  }
}
```

```bash
npm run api:generate
npm run api:check
npx lit-query-codegen --config other.config.ts
```

`--check` generates a temporary client and reports missing, changed or obsolete
files with exit code 1. It leaves the existing client untouched.

Normal generation also uses a temporary directory. The output directory is
replaced only after generation and transformation succeed. Use a dedicated
generated directory: files without a generator header and symbolic links prevent
replacement. Features and query or mutation files that are no longer needed are
removed during the next generation run.

## Fetch runtime

Generated clients use `lit-query-codegen/runtime` by default. This module has no
Orval, Node.js or Vite dependencies.

```ts
import { configureApiFetch } from "lit-query-codegen/runtime";

configureApiFetch({ baseUrl: "https://api.example.com" });
```

Without configuration, requests use relative API paths and send cookies with
`credentials: "include"`. You can configure default `headers`, `credentials` and
a custom `fetch` implementation. `createApiFetch(config)` creates an independent
fetch mutator for separate API clients or server-side use.

The mutator serializes plain objects, arrays and `null` as JSON. `FormData` and
other native request bodies are passed through. Query arrays use repeated
parameters; `undefined` values are omitted and `null` is sent as the string
`"null"`. Successful responses return the body, or `undefined` for an empty
response. HTTP failures throw `ApiError` with a `status` and optional RFC 9457
problem details.

To use an existing fetch mutator, configure its path:

```ts
import { defineConfig } from "lit-query-codegen";

export default defineConfig({
  input: "./openapi.json",
  output: "./src/api/generated",
  request: {
    path: "./src/api/request.ts",
    exports: ["ApiError"],
    typeExports: ["ApiProblem", "ApiRequestOptions"],
  },
});
```

The module must export `apiFetch<T>(url, options): Promise<T>` and
`ApiRequestOptions`. The options contain an unserialized `body`, a `query` object
and fetch options. Feature entry points also export `ApiError`, `ApiProblem` and
`ApiRequestOptions` by default. Adjust `exports` and `typeExports`, or set them to
`[]`, if your mutator exposes different symbols.

## Project-specific rules

- `excludeTags`: omit tags such as `system`.
- `mutationOperations`: treat GET operations as mutations, for example an OAuth
  start or callback. Accepts OpenAPI operation IDs or generated function names.
- `features`: add imports, request options, query-key values and an `enabled`
  expression for each feature. Expressions are TypeScript code from your config.
- `queryAliases`: group related queries under an object with an `allKey` property.

[examples/advanced.config.ts](examples/advanced.config.ts) shows these options for
a product catalog with session-dependent requests and login operations. Adapt the
tags, operation IDs and helper imports to your API. The example expects a
`products` tag with `list_products` and `get_product` operations, plus
`start_login` and `complete_login` operations. Its `auth.ts` module supplies
`authHeaders`, `authScope` and `hasSession`.

Once configured, `"api:generate": "lit-query-codegen"` replaces separate Orval
configuration and transformation scripts. Exporting the OpenAPI specification
and checking it against the backend remain tasks for your project.

## Programmatic API

```ts
import { generate } from "lit-query-codegen";

await generate(
  { input: "openapi.json", output: "src/api/generated" },
  { cwd: process.cwd(), check: false },
);
```

## OpenAPI requirements

Each included operation must have exactly one tag in the format
`lower-case-with-hyphens` and a unique, explicit `operationId` in `snake_case` or
`camelCase`. Local parameter references are supported. Bundle path-item references
before generation.

The transformation targets JSON and multipart fetch requests. Custom header or
cookie parameters and other OpenAPI serialization styles require corresponding
extensions to the mutator and transformation.

## Development

```bash
npm install
npm test
npm run typecheck
npm run format:check
npm run test:package
npm pack
```

`test:package` installs the tarball in an independent temporary project and checks
the CLI, TypeScript configuration, client generation, drift detection and types.
To compare a project's existing generated client against its configuration:

```bash
node test/client-parity.ts /path/to/app/lit-query-codegen.config.ts
```

Orval is pinned because the transformation processes its generated TypeScript
AST. Run the integration tests when upgrading it. The package uses `UNLICENSED`;
choose a public license before publishing if needed.
