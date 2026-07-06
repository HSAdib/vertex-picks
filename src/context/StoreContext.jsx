import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StoreContext } from './StoreContextValue';

const STORE_NAME_KEY = 'vp_store_name';
const STORE_PHONE_KEY = 'vp_floating_phone';

export function StoreProvider({ children }) {
  // Read from localStorage instantly — eliminates the "Vertex Picks" flash on every load
  const [storeName, setStoreName] = useState(
    () => localStorage.getItem(STORE_NAME_KEY) || 'Vertex Picks'
  );
  const [floatingWhatsappPhone, setFloatingWhatsappPhone] = useState(
    () => localStorage.getItem(STORE_PHONE_KEY) || ''
  );

  useEffect(() => {
    // Single real-time listener for the whole app — updates navbar, login, footer, etc.
    const unsub = onSnapshot(
      doc(db, 'mangoes', 'STORE_SETTINGS'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.storeName) {
            setStoreName(data.storeName);
            // Persist so next load is instant
            localStorage.setItem(STORE_NAME_KEY, data.storeName);
          }
          const phone = data.floatingWhatsappPhone || data.contactPhone || '';
          if (phone) {
            setFloatingWhatsappPhone(phone);
            localStorage.setItem(STORE_PHONE_KEY, phone);
          }
        }
      },
      (err) => console.error('StoreContext onSnapshot error:', err)
    );
    return () => unsub();
  }, []);

  return (
    <StoreContext.Provider value={{ storeName, floatingWhatsappPhone }}>
      {children}
    </StoreContext.Provider>
  );
}
