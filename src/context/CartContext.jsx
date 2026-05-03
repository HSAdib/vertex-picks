import { createContext, useState, useContext } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = (product) => {
    setCart((prevCart) => {
      // Check if item is already in the cart
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        // If it exists, just increase the quantity
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // If it's new, add it with quantity: 1
      return [...prevCart, { ...product, quantity: 1 }];
    });
    // The new premium, animated popup!
    toast.success(`${product.name} added to cart!`, {
      style: {
        border: '1px solid #15803d',
        padding: '16px',
        color: '#1a1a1a',
        fontWeight: 'bold',
      },
      iconTheme: {
        primary: '#15803d',
        secondary: '#fafafa',
      },
    });
  };

  const removeFromCart = (indexToRemove) => {
    setCart((prevCart) => prevCart.filter((_, index) => index !== indexToRemove));
    toast.error('Item removed from cart');
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);