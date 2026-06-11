import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export function useWishlist() {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('vertex_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('vertex_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Clear wishlist on sign-out so it doesn't leak to the next user on the same device
  useEffect(() => {
    let previousUser = auth.currentUser;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && previousUser) {
        setWishlist([]);
        localStorage.removeItem('vertex_wishlist');
      }
      previousUser = user;
    });
    return () => unsubscribe();
  }, []);

  const toggleWishlist = (mango) => {
    const isAlreadyLiked = wishlist.includes(mango.id);
    
    if (isAlreadyLiked) {
      toast.success(`Removed ${mango.name || 'item'} from Wishlist!`, { icon: '💔' });
      setWishlist(prev => prev.filter(id => id !== mango.id));
    } else {
      toast.success(`Added ${mango.name || 'item'} to Wishlist!`, { icon: '❤️' });
      setWishlist(prev => [...prev, mango.id]);
    }
  };

  const isInWishlist = (productId) => wishlist.includes(productId);

  return { wishlist, toggleWishlist, isInWishlist };
}
