# Product catalog: OpenAPI to Lit Query

This example shows what `lit-query-codegen` takes as input, what it writes,
and how a Lit component uses the generated code. The generated files are committed
so you can inspect them on GitHub without installing or running anything.

| File                                                               | Role                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [openapi.json](openapi.json)                                       | Handwritten input: list, get, create and update product endpoints       |
| [lit-query-codegen.config.ts](lit-query-codegen.config.ts)         | Generator configuration: input file and output directory                |
| [generated/products/models.ts](generated/products/models.ts)       | Generated request, response and query parameter types                   |
| [generated/products/api.ts](generated/products/api.ts)             | Generated typed fetch functions                                         |
| [generated/products/queries.ts](generated/products/queries.ts)     | Generated query keys and query functions for GET operations             |
| [generated/products/mutations.ts](generated/products/mutations.ts) | Generated mutation options for POST and PUT operations                  |
| [generated/index.ts](generated/index.ts)                           | Generated entry point exporting the `products` namespace                |
| [catalog-element.ts](catalog-element.ts)                           | Handwritten Lit component: list products, create one, refresh the cache |

## Regenerate and check

From the repository root:

```bash
npm ci
npm run example:generate
npm run example:check
npm run typecheck
```

`example:generate` builds the package and regenerates `examples/catalog/generated/`.
`example:check` fails if the committed output differs from a fresh generation and
leaves existing files untouched. CI runs the check, and `typecheck` checks both the
generated API and the component. Edit `openapi.json` or the config, then regenerate;
do not edit files inside `generated/` manually.

## Call the generated API

Inside a TypeScript application with bundler module resolution:

```ts
import { products } from "./generated";

const catalog = await products.listProducts({ limit: 20 }); // Product[]
const product = await products.getProduct("p-1"); // Product
const created = await products.createProduct({ name: "Notebook", price: 12.5 });
await products.updateProduct(created.id, { name: "Large notebook", price: 15 });
```

The fetch runtime sends query parameters and JSON bodies, handles HTTP errors and
returns the response body. `getProduct` and `updateProduct` encode the path parameter.

## Use the options with Lit Query

[`catalog-element.ts`](catalog-element.ts) supplies a shared `QueryClient` directly
to its controllers. The query reads products with inferred `Product[]` data. The
mutation accepts a `ProductInput` object and invalidates product queries on success.
Loading, errors, rendering and cache invalidation are application code.

For a mutation with both a path parameter and a body, use the generated tuple:

```ts
// Inside a LitElement, with the same shared queryClient:
const update = createMutationController(this, products.updateProductMutation(), queryClient);
update.mutate(["p-1", { name: "Large notebook", price: 15 }]);
```

Import `createMutationController` from `@tanstack/lit-query` when using this snippet.

To use the full component, copy this example into a Lit application, install the
dependencies described in the [main README](../../README.md#installation), import
`catalog-element.ts` from the app's entry point, and render:

```html
<product-catalog></product-catalog>
```

By default, requests go to `/products` on the application's origin. Point the runtime
at a matching API before mounting the component if it lives elsewhere:

```ts
import { configureApiFetch } from "lit-query-codegen/runtime";

configureApiFetch({ baseUrl: "http://localhost:3000" });
```

This example does not include an API server or a development server. Generation and
typechecking work without a backend; fetching and saving products require a Lit app
and an API implementing the included contract.
