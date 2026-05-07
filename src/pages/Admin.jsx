import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { AnimatePresence } from 'framer-motion';

import OrdersTab from '../components/admin/OrdersTab';
import InventoryTab from '../components/admin/InventoryTab';
import PromosTab from '../components/admin/PromosTab';
import HomeTab from '../components/admin/HomeTab';
import UsersTab from '../components/admin/UsersTab';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('home');

  // Auth check is now handled by AdminRoute wrapper in App.jsx

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20">
      
      {/* HEADER */}
      <div className="w-full bg-white shadow-md border-b-4 border-orange-500 px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4 print:hidden">
        <h1 className="text-2xl font-black tracking-tighter">ADMIN <span className="text-orange-500">PRO</span></h1>
        
        {/* TABS & LOGOUT */}
        <nav className="flex gap-4 md:gap-6 overflow-x-auto w-full md:w-auto justify-center items-center">
          {['home', 'orders', 'inventory', 'customers', 'promos'].map(tab => (
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
          <button 
            onClick={() => signOut(auth)} 
            className="text-xs font-black uppercase tracking-widest whitespace-nowrap text-red-500 hover:text-red-700 transition-colors md:bg-black md:text-white md:px-4 md:py-2 md:rounded md:hover:bg-red-600"
          >
            Log Out
          </button>
        </nav>
      </div>

      <div className="max-w-7xl w-full mt-10 px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <HomeTab key="home" />}
          {activeTab === 'orders' && <OrdersTab key="orders" />}
          {activeTab === 'inventory' && <InventoryTab key="inventory" />}
          {activeTab === 'customers' && <UsersTab key="customers" />}
          {activeTab === 'promos' && <PromosTab key="promos" />}
        </AnimatePresence>
      </div>
    </div>
  );
}