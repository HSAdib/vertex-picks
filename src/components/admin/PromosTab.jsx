import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';

export default function PromosTab() {
  const [promos, setPromos] = useState([]);
  const [newPromoCode, setNewPromoCode] = useState(''); 
  const [newPromoPercent, setNewPromoPercent] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const promoSnap = await getDocs(collection(db, 'promos'));
      setPromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching promos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleAddPromo = async (e) => { 
    e.preventDefault(); 
    await addDoc(collection(db, 'promos'), { 
      code: newPromoCode.trim().toUpperCase(), 
      discountPercent: Number(newPromoPercent), 
      createdAt: new Date() 
    }); 
    setNewPromoCode(''); 
    setNewPromoPercent(''); 
    fetchPromos(); 
  };

  const handleDeletePromo = async (id) => { 
    await deleteDoc(doc(db, 'promos', id)); 
    fetchPromos(); 
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6">Add Promo Code</h2>
        <form onSubmit={handleAddPromo} className="flex flex-col sm:flex-row gap-4">
          <input type="text" placeholder="Promo Code (e.g. EID20)" required value={newPromoCode} onChange={e=>setNewPromoCode(e.target.value)} className="flex-1 p-3 bg-gray-50 border rounded font-bold outline-none uppercase" />
          <input type="number" placeholder="Discount %" required value={newPromoPercent} onChange={e=>setNewPromoPercent(e.target.value)} className="w-full sm:w-32 p-3 bg-gray-50 border rounded font-bold outline-none" />
          <button type="submit" className="bg-black text-white font-black px-6 py-3 rounded uppercase text-sm hover:bg-orange-500">Add</button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6">Active Promos</h2>
        {loading ? (
          <p className="text-gray-400 font-bold">Loading promos...</p>
        ) : (!promos || promos.length === 0) ? (
          <p className="text-gray-400 font-bold">No active promos.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {promos.map(promo => (
              <div key={promo.id} className="flex justify-between items-center p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
                <div>
                  <p className="font-black text-xl text-orange-600 uppercase tracking-widest">{promo.code || 'UNKNOWN'}</p>
                  <p className="text-sm font-bold text-gray-500">{promo.discountPercent || 0}% OFF</p>
                </div>
                <button onClick={() => handleDeletePromo(promo.id)} className="bg-red-100 text-red-600 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-red-600 hover:text-white">X</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
