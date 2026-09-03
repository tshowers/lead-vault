/**
 * Copied verbatim from web-products/network's models/product.model.ts -
 * trimmed from shared/data/interfaces/product.model.ts, only the fields
 * that were already needed there. Pulled in transitively because
 * contact.model.ts's Company interface references it.
 */
export interface Product {
  name?: string;
  active?: boolean;
  discontinued?: boolean;
  description: string;
  shortDescription?: string;
  priceLabel?: string;
  stripePriceIdMonthly?: string;
}
