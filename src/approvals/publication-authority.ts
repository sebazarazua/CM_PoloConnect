import type { ContentItem, Store } from "../domain/models.js";
/** Trusted application capability, never reconstructed from source/LLM JSON. Manual approval remains unchanged. */
export interface PublicationAuthority {
  readonly kind: "policy";
  assert(store: Store, item: ContentItem): { id: string };
}
