import { createContext, useContext, useMemo, useState } from "react";
import type { CartLine } from "@/types/storeos";
import {
  applyCompletedSale,
  createDemoData,
  type BusinessProfile,
  type Ingredient,
  type MovementType,
  type PaymentMethod,
  type Product,
  type StoreData,
} from "@/lib/storeos";

type StoreOSContextValue = {
  data: StoreData;
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  recordMovement: (input: { ingredientId: string; type: MovementType; quantity: number; note: string }) => void;
  completeSale: (lines: CartLine[], paymentMethod: PaymentMethod) => { id: string; total: number; grossProfit: number };
  updateBusiness: (business: BusinessProfile) => void;
};

const StoreOSContext = createContext<StoreOSContextValue | undefined>(undefined);

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function StoreOSProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<StoreData>(() => createDemoData());

  const value = useMemo<StoreOSContextValue>(() => ({
    data,
    upsertProduct: (product) => {
      setData((current) => {
        const exists = current.products.some((item) => item.id === product.id);
        return { ...current, products: exists ? current.products.map((item) => item.id === product.id ? product : item) : [...current.products, product] };
      });
    },
    deleteProduct: (id) => setData((current) => ({ ...current, products: current.products.filter((item) => item.id !== id) })),
    recordMovement: ({ ingredientId, type, quantity, note }) => {
      setData((current) => {
        const isInbound = type === "Purchase" || type === "Adjustment" || type === "Stock Opname";
        const movement = { id: createId("MV"), ingredientId, type, quantity, note, createdAt: new Date().toISOString() };
        return {
          ...current,
          ingredients: current.ingredients.map((ingredient) => ingredient.id === ingredientId ? { ...ingredient, currentStock: Math.max(0, ingredient.currentStock + (isInbound ? quantity : -quantity)) } : ingredient),
          movements: [movement, ...current.movements],
          auditEvents: [{ id: createId("AUD"), action: `${type} recorded`, detail: note || `${type} inventory movement`, createdAt: movement.createdAt }, ...current.auditEvents],
        };
      });
    },
    completeSale: (lines, paymentMethod) => {
      const id = `TRX-${Math.floor(1000 + Math.random() * 8999)}`;
      const timestamp = new Date().toISOString();
      setData((current) => applyCompletedSale(current, lines, paymentMethod, id, timestamp).data);
      return applyCompletedSale(data, lines, paymentMethod, id, timestamp).receipt;
    },
    updateBusiness: (business) => setData((current) => ({ ...current, business })),
  }), [data]);

  return <StoreOSContext.Provider value={value}>{children}</StoreOSContext.Provider>;
}

export function useStoreOS() {
  const context = useContext(StoreOSContext);
  if (!context) throw new Error("useStoreOS must be used inside StoreOSProvider");
  return context;
}
