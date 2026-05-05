import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';

export default function Admin() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [liveMangoes, setLiveMangoes] = useState([]);
  const [orders, setOrders] = useState([]);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(''); 
  const [editingId, setEditingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // AUTO-CALCULATION LOGIC
  const handleDiscountPriceChange = (val) => {
    setDiscountPrice(val);
    if (price && val) {
      const percent = ((price - val) / price) * 100;
      setDiscountPercent(Math.round(percent));
    } else { setDiscountPercent(''); }
  };

  const handlePercentChange = (val) => {
    setDiscountPercent(val);
    if (price && val) {
      const dPrice = price - (price * (val / 100));
      setDiscountPrice(Math.round(dPrice));
    } else { setDiscountPrice(''); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        fetchAllData();
        setLoading(false);
      } else { navigate('/login'); }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = async () => {
    const prodSnap = await getDocs(collection(db, 'mangoes'));
    setLiveMangoes(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const orderSnap = await getDocs(q);
    setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const productData = { 
      name, 
      price: Number(price), 
      discountPrice: discountPrice ? Number(discountPrice) : null,
      discountPercent: discountPercent ? Number(discountPercent) : null,
      description, 
      image: imageUrl, 
      updatedAt: new Date() 
    };
    if (editingId) {
      await updateDoc(doc(db, 'mangoes', editingId), productData);
    } else {
      productData.createdAt = new Date();
      await addDoc(collection(db, 'mangoes'), productData);
    }
    cancelEdit();
    fetchAllData();
    setIsUploading(false);
  };

  const cancelEdit = () => { 
    setEditingId(null); setName(''); setPrice(''); setDiscountPrice(''); 
    setDiscountPercent(''); setDescription(''); setImageUrl(''); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-500 uppercase">Securing Connection...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20">
      <div className="w-full bg-white shadow-md border-b-4 border-orange-500 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <h1 className="text-2xl font-black tracking-tighter">ADMIN <span className="text-orange-500">PRO</span></h1>
          <nav className="flex gap-6">
            {['inventory', 'orders', 'analytics'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-xs font-black uppercase tracking-widest ${activeTab === tab ? 'text-orange-500' : 'text-gray-400'}`}>{tab}</button>
            ))}
          </nav>
          <button onClick={() => signOut(auth)} className="text-xs font-black bg-black text-white px-4 py-2 rounded">Exit</button>
      </div>

      <div className="max-w-6xl w-full mt-10 px-4">
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="font-black uppercase mb-6">{editingId ? 'Edit Mango' : 'Add New Harvest'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="text" placeholder="Mango Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" required />
                  <input type="number" placeholder="Original Price (BDT)" value={price} onChange={e => {setPrice(e.target.value); setDiscountPrice(''); setDiscountPercent('');}} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" required />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Disc. Price" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded outline-none font-bold" />
                    <input type="number" placeholder="Disc. %" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded outline-none font-bold" />
                  </div>

                  <input type="url" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" required />
                  <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" rows="3" required />
                  <button type="submit" className="w-full bg-black text-white font-black py-4 rounded hover:bg-orange-500 uppercase tracking-widest">
                    {isUploading ? 'Saving...' : 'Save Product'}
                  </button>
                </form>
              </div>
            </div>
            {/* List remains similar to before */}
          </div>
        )}
      </div>
    </div>
  );
}