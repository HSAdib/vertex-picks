/* eslint-disable react-refresh/only-export-components */
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
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('vertex_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (productId, quantityToAdd = 1, productData = null, selectedWeight = null) => {
    // B7: check stock if product data is provided
    if (productData && productData.inStock === false) {
      toast.error('Sorry, this item is out of stock!', { icon: '🚫' });
      return;
    }

    // Resolve weight if not explicitly passed
    let resolvedWeight = selectedWeight;
    if (!resolvedWeight && productData) {
      if (productData.weightOptions && productData.weightOptions.length > 0) {
        resolvedWeight = productData.weightOptions[0];
      } else if (productData.fixedWeight) {
        resolvedWeight = `${productData.fixedWeight}kg Box`;
      }
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === productId && item.selectedWeight === resolvedWeight);
      if (existingItem) {
        return prevCart.map(item =>
          (item.id === productId && item.selectedWeight === resolvedWeight) ? { ...item, quantity: item.quantity + quantityToAdd } : item
        );
      }
      return [...prevCart, { id: productId, quantity: quantityToAdd, selected: true, selectedWeight: resolvedWeight }];
    });
    // B18: toast here only — callers (ProductInfo, ProductDetail) should NOT show their own toast
    toast.success('Added to cart!', { 
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

  const removeFromCart = (productId, selectedWeight = null) => {
    setCart((prevCart) => prevCart.filter(item => !(item.id === productId && item.selectedWeight === selectedWeight)));
  };

  const updateQuantity = (productId, newQuantity, selectedWeight = null) => {
    // B20: remove item when quantity reaches 0
    if (newQuantity < 1) {
      setCart((prevCart) => prevCart.filter(item => !(item.id === productId && item.selectedWeight === selectedWeight)));
      return;
    }
    setCart((prevCart) => prevCart.map(item => (item.id === productId && item.selectedWeight === selectedWeight) ? { ...item, quantity: newQuantity } : item));
  };

  // NEW: Toggle the checkbox on/off for checkout
  const toggleSelection = (productId, selectedWeight = null) => {
    setCart((prevCart) => prevCart.map(item => (item.id === productId && item.selectedWeight === selectedWeight) ? { ...item, selected: !item.selected } : item));
  };

  // Clear the cart
  const clearCart = () => setCart([]);

  // Auto-clear cart only on sign-out (not on initial load for guests)
  useEffect(() => {
    let previousUser = auth.currentUser;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && previousUser) clearCart(); // only fires when transitioning from logged-in → logged-out
      previousUser = user;
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