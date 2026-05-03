import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export default app;