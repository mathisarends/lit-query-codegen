import { defineConfig } from "lit-query-codegen";

// Copy to your application as lit-query-codegen.config.ts and adapt to your API.
export default defineConfig({
  input: "./openapi.json",
  output: "./src/api/generated",
  request: { path: "./src/api/request.ts" },
  excludeTags: ["system"],
  mutationOperations: ["start_login", "complete_login"],
  features: {
    products: {
      imports: [
        {
          from: "./src/api/auth.ts",
          names: ["authHeaders", "authScope", "hasSession"],
        },
      ],
      requestOptions: "{ headers: authHeaders() }",
      queryKey: ["authScope()"],
      enabled: "hasSession()",
    },
  },
  queryAliases: {
    products: {
      products: {
        list: "list_products",
        detail: "get_product",
      },
    },
  },
});
