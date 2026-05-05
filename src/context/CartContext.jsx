import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (productId, quantityToAdd = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      }
      return [...prevCart, { id: productId, quantity: quantityToAdd, selected: true }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return; 
    setCart((prevCart) => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };

  // NEW: Toggle the checkbox on/off for checkout
  const toggleSelection = (productId) => {
    setCart((prevCart) => prevCart.map(item => item.id === productId ? { ...item, selected: !item.selected } : item));
  };

  // Clear the cart
  const clearCart = () => setCart([]);

  // Auto-clear cart on logout
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) clearCart();
    });
    return () => unsubscribe();
  }, []);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, toggleSelection, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);