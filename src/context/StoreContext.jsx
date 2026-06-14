import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const StoreContext = createContext({ storeName: 'Vertex Picks' });

export function StoreProvider({ children }) {
  const [storeName, setStoreName] = useState('Vertex Picks');

  useEffect(() => {
    // Single real-time listener for the whole app — updates navbar, login, footer, etc.
    const unsub = onSnapshot(
      doc(db, 'mangoes', 'STORE_SETTINGS'),
      (snap) => {
        if (snap.exists()) {
          const name = snap.data().storeName;
          if (name) setStoreName(name);
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

export const useStore = () => useContext(StoreContext);
