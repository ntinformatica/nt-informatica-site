import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cartTotals, itemKey, readCartItems, writeCartItems } from "./cartStorage";

const CartContext = createContext(null);

function normalizeItem(item) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const stock = Number(item.stock ?? 999);
  return {
    itemType: item.itemType,
    productId: item.productId || "",
    variationId: item.variationId || "",
    assembledPcId: item.assembledPcId || "",
    name: item.name || "Produto NT",
    variationName: item.variationName || "",
    image: item.image || "",
    unitPrice: Number(item.unitPrice || 0),
    cashPrice: Number(item.cashPrice || 0),
    stock: Number.isFinite(stock) ? stock : 999,
    sku: item.sku || "",
    slug: item.slug || "",
    quantity,
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCartItems());
  const [lastAction, setLastAction] = useState("");

  useEffect(() => {
    function sync(event) {
      if (event.detail?.items) setItems(event.detail.items);
      else setItems(readCartItems());
    }
    window.addEventListener("storage", sync);
    window.addEventListener("nt-cart-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("nt-cart-updated", sync);
    };
  }, []);

  function commit(nextItems, message = "") {
    setItems(nextItems);
    writeCartItems(nextItems);
    if (message) {
      setLastAction(message);
      window.setTimeout(() => setLastAction(""), 2400);
    }
  }

  function addItem(rawItem, options = {}) {
    const item = normalizeItem(rawItem);
    if (item.stock <= 0) {
      setLastAction("Produto indisponível.");
      return false;
    }
    const key = itemKey(item);
    const existing = items.find((entry) => itemKey(entry) === key);
    const nextItems = existing
      ? items.map((entry) => itemKey(entry) === key
        ? { ...entry, quantity: Math.min(Number(entry.stock || item.stock || 999), Number(entry.quantity || 0) + item.quantity) }
        : entry)
      : [...items, item];
    commit(nextItems, options.buyNow ? "Produto adicionado. Indo para o checkout..." : "Produto adicionado ao carrinho.");
    return true;
  }

  function updateQuantity(key, quantity) {
    const nextQuantity = Number(quantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;
    commit(items.map((item) => itemKey(item) === key ? { ...item, quantity: Math.min(Number(item.stock || 999), nextQuantity) } : item));
  }

  function removeItem(key) {
    commit(items.filter((item) => itemKey(item) !== key), "Item removido.");
  }

  function clearCart() {
    commit([], "Carrinho limpo.");
  }

  const value = useMemo(() => ({
    items,
    totals: cartTotals(items),
    lastAction,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }), [items, lastAction]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider.");
  return context;
}
