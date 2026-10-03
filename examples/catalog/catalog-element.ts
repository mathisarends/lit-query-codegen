import { LitElement, html } from "lit";
import { QueryClient, createMutationController, createQueryController } from "@tanstack/lit-query";
import { products } from "./generated";

// Share one client so components use the same cache. A QueryClientProvider can
// supply it through Lit context instead of passing it as the third argument.
const queryClient = new QueryClient();

export class ProductCatalog extends LitElement {
  private readonly catalog = createQueryController(
    this,
    () => ({ ...products.listProductsQuery({ limit: 20 }), staleTime: 60_000 }),
    queryClient,
  );

  private readonly createProduct = createMutationController(
    this,
    () => ({
      ...products.createProductMutation(),
      // Decide which data to refresh in the application, after a successful write.
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    }),
    queryClient,
  );

  override render() {
    const catalog = this.catalog();
    const creation = this.createProduct();

    if (catalog.isPending) return html`<p>Loading products…</p>`;
    if (catalog.isError) return html`<p role="alert">${catalog.error.message}</p>`;

    return html`
      <ul>
        ${catalog.data.map((product) => html`<li>${product.name} — ${product.price}</li>`)}
      </ul>
      <button
        ?disabled=${creation.isPending}
        @click=${() => this.createProduct.mutate({ name: "Notebook", price: 12.5 })}
      >
        Add a notebook
      </button>
      ${creation.isError ? html`<p role="alert">${creation.error.message}</p>` : null}
    `;
  }
}

customElements.define("product-catalog", ProductCatalog);
