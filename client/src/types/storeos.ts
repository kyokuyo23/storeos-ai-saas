import type { Product } from "@/lib/storeos";

export type CartLine = {
  product: Product;
  quantity: number;
  discount: number;
};
