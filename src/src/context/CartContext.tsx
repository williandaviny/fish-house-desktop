import { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  unit?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity' | 'unit'> & { quantity?: number; unit?: string }) => void;
  removeFromCart: (id: string | number) => void;
  updateQuantity: (id: string | number, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (newItem: Omit<CartItem, 'quantity' | 'unit'> & { quantity?: number; unit?: string }) => {
    const qty = newItem.quantity || 1;
    
    setItems(current => {
      const existing = current.find(item => item.id === newItem.id);
      if (existing) {
        return current.map(item => 
          item.id === newItem.id 
          ? { ...item, quantity: Number((item.quantity + qty).toFixed(1)) } 
          : item
        );
      }
      return [...current, { ...newItem, quantity: qty, unit: newItem.unit || 'un' }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string | number) => {
    setItems(current => current.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string | number, quantity: number) => {
    const cleanQty = Number(quantity.toFixed(1));
    
    if (cleanQty <= 0) {
      removeFromCart(id);
      return;
    }
    setItems(current => 
      current.map(item => item.id === id ? { ...item, quantity: cleanQty } : item)
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      isCartOpen,
      setIsCartOpen,
      cartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
