import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDglphHIHtNElpryJTBQvkY_qp4pkHCx4A",
  authDomain: "vertex-picks.firebaseapp.com",
  projectId: "vertex-picks",
  storageBucket: "vertex-picks.firebasestorage.app",
  messagingSenderId: "219494137985",
  appId: "1:219494137985:web:8f18133ac92894e791cd80",
  measurementId: "G-T5EQ7SC2K0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence so Firestore serves from IndexedDB cache
// on repeat visits — data loads instantly while Firestore syncs in background
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — falls back to memory cache, still works fine
    console.warn('Firestore persistence unavailable (multiple tabs open)');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB
    console.warn('Firestore persistence not supported in this browser');
  }
});

export default app;