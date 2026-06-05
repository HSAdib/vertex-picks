import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

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

  const toggleWishlist = (mango) => {
    setWishlist(prev => {
      let updated;
      if (prev.includes(mango.id)) {
        updated = prev.filter(id => id !== mango.id);
        toast.success(`Removed ${mango.name || 'item'} from Wishlist!`, { icon: '💔' });
      } else {
        updated = [...prev, mango.id];
        toast.success(`Added ${mango.name || 'item'} to Wishlist!`, { icon: '❤️' });
      }
      return updated;
    });
  };

  const isInWishlist = (productId) => wishlist.includes(productId);

  return { wishlist, toggleWishlist, isInWishlist };
}
