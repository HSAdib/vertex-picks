import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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

// Modern persistent cache — works across multiple tabs and survives page refreshes.
// Replaces the deprecated enableIndexedDbPersistence() call.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export default app;