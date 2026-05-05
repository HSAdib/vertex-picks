import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { AnimatePresence } from 'framer-motion';

import OrdersTab from '../components/admin/OrdersTab';
import InventoryTab from '../components/admin/InventoryTab';
import PromosTab from '../components/admin/PromosTab';

export default function Admin() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) { 
        setLoading(false); 
      } else { 
        navigate('/login'); 
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-500 uppercase tracking-widest">Securing Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20">
      
      {/* HEADER */}
      <div className="w-full bg-white shadow-md border-b-4 border-orange-500 px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4">
        <h1 className="text-2xl font-black tracking-tighter">ADMIN <span className="text-orange-500">PRO</span></h1>
        
        {/* TABS */}
        <nav className="flex gap-4 md:gap-6 overflow-x-auto w-full md:w-auto justify-center">
          {['orders', 'inventory', 'promos'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                activeTab === tab 
                  ? 'text-orange-500 border-b-2 border-orange-500 pb-1' 
                  : 'text-gray-400 hover:text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <button onClick={() => signOut(auth)} className="text-xs font-black bg-black text-white px-4 py-2 rounded hover:bg-orange-500 transition-colors hidden md:block">
          Exit
        </button>
      </div>

      <div className="max-w-7xl w-full mt-10 px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'orders' && <OrdersTab key="orders" />}
          {activeTab === 'inventory' && <InventoryTab key="inventory" />}
          {activeTab === 'promos' && <PromosTab key="promos" />}
        </AnimatePresence>
      </div>
    </div>
  );
}