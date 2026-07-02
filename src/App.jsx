import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import SwipeableToaster from './components/SwipeableToaster';
import { motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import { useStore } from './context/useStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Analytics } from "@vercel/analytics/react";
import AdminRoute from './components/AdminRoute';
import Navbar from './components/Navbar';

const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Checkout = lazy(() => import('./pages/Checkout'));
const ProductDetail = lazy(() => import('./components/PDP/ProductDetail'));

const RouteFallback = () => (
  <div className="min-h-[70vh] flex items-center justify-center font-black text-orange-500 uppercase tracking-widest">
    Loading...
  </div>
);

const FloatingWhatsApp = () => {
  const { storeName } = useStore();
  const [waUrl, setWaUrl] = useState("https://wa.me/8801581221084?text=Hello!%20I%20need%20help%20with%20my%20Vertex%20Picks%20order.");

  useEffect(() => {
    const fetchPhone = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          const phone = data.floatingWhatsappPhone || data.contactPhone || '8801581221084';
          const cleanPhone = phone.replace(/\D/g, '');
          const waPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone;
          setWaUrl(`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello! I need help with my ${storeName} order.`)}`);
        }
      } catch (err) {
        console.error("Error loading floating WhatsApp phone:", err);
      }
    };
    fetchPhone();
  }, [storeName]);

  return (
    <motion.a
      href={waUrl}
      target="_blank"
      rel="noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 200 }}
      className="floating-whatsapp-btn fixed bottom-6 right-6 z-[200] bg-[#25D366]/40 backdrop-blur-lg border border-white/30 text-white w-14 h-14 md:w-16 md:h-16 rounded-full shadow-lg shadow-green-500/20 flex items-center justify-center hover:scale-110 transition-transform print:hidden"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 md:w-8 md:h-8">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></span>
    </motion.a>
  );
};

function App() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Analytics />
            <Router>
              <div className="min-h-screen bg-white dark:bg-[#222222] flex flex-col">
                <SwipeableToaster />
                <Navbar />
                <main className="flex-grow">
                  <Routes>
                    <Route path="/product/:id" element={<Suspense fallback={<RouteFallback />}><ProductDetail /></Suspense>} />
                    <Route path="/profile" element={<Suspense fallback={<RouteFallback />}><Profile /></Suspense>} />
                    <Route path="/login" element={<Suspense fallback={<RouteFallback />}><Login /></Suspense>} />
                    <Route path="/admin" element={<Suspense fallback={<RouteFallback />}><AdminRoute><Admin /></AdminRoute></Suspense>} />
                    <Route path="/" element={<Suspense fallback={<RouteFallback />}><Home /></Suspense>} />
                    <Route path="/shop" element={<Suspense fallback={<RouteFallback />}><Shop /></Suspense>} />
                    <Route path="/checkout" element={<Suspense fallback={<RouteFallback />}><Checkout /></Suspense>} />
                    {/* Fix #8: catch-all 404 — renders instead of a blank page */}
                    <Route path="*" element={
                      <div style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '4rem' }}>🥭</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--dark)' }}>Page Not Found</h2>
                        <p style={{ color: 'var(--gray4)', fontSize: '.9rem' }}>The page you're looking for doesn't exist.</p>
                        <Link to="/" style={{ background: 'var(--primary)', color: '#fff', padding: '.6rem 1.5rem', borderRadius: 100, fontWeight: 700, fontSize: '.85rem', textDecoration: 'none' }}>← Back to Home</Link>
                      </div>
                    } />
                  </Routes>
                </main>
                <FloatingWhatsApp />
              </div>
            </Router>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}
export default App;
