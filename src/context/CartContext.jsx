import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-hot-toast';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('vertex_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('vertex_cart', JSON.stringify(cart));
  }, [cart]);

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
    toast.success('Item added to Cart!', { 
      icon: '🛒',
      style: {
        borderRadius: '10px',
        background: '#111',
        color: '#fff',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        fontSize: '12px',
        letterSpacing: '1px'
      }
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