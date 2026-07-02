import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StoreContext } from './StoreContextValue';

const STORE_NAME_KEY = 'vp_store_name';

export function StoreProvider({ children }) {
  // Read from localStorage instantly — eliminates the "Vertex Picks" flash on every load
  const [storeName, setStoreName] = useState(
    () => localStorage.getItem(STORE_NAME_KEY) || 'Vertex Picks'
  );

  useEffect(() => {
    // Single real-time listener for the whole app — updates navbar, login, footer, etc.
    const unsub = onSnapshot(
      doc(db, 'mangoes', 'STORE_SETTINGS'),
      (snap) => {
        if (snap.exists()) {
          const name = snap.data().storeName;
          if (name) {
            setStoreName(name);
            // Persist so next load is instant
            localStorage.setItem(STORE_NAME_KEY, name);
          }
        }
      },
      (err) => console.error('StoreContext onSnapshot error:', err)
    );
    return () => unsub();
  }, []);

  return (
    <StoreContext.Provider value={{ storeName }}>
      {children}
    </StoreContext.Provider>
  );
}
