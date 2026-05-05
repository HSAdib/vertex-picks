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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black uppercase">{editingId ? 'Edit Mango' : 'Add New Harvest'}</h2>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="text-xs font-bold text-gray-400 hover:text-black underline">Cancel</button>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="text" placeholder="Mango Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold focus:border-orange-500" required />
                  <input type="number" placeholder="Original Price (BDT)" value={price} onChange={e => {setPrice(e.target.value); setDiscountPrice(''); setDiscountPercent('');}} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold focus:border-orange-500" required />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Disc. Price</label>
                      <input type="number" placeholder="৳" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded outline-none font-bold focus:border-orange-500" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Disc. %</label>
                      <input type="number" placeholder="%" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded outline-none font-bold focus:border-orange-500" />
                    </div>
                  </div>

                  <input type="url" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold focus:border-orange-500" required />
                  <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold focus:border-orange-500" rows="3" required />
                  <button type="submit" disabled={isUploading} className="w-full bg-black text-white font-black py-4 rounded hover:bg-orange-500 uppercase tracking-widest transition-all">
                    {isUploading ? 'Saving...' : (editingId ? 'Update Product' : 'Push to Live Store')}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-black uppercase text-gray-400 text-sm tracking-widest mb-2">Live Inventory ({liveMangoes.length})</h2>
              {liveMangoes.length === 0 ? (
                <div className="p-10 border-2 border-dashed rounded-xl text-center text-gray-400 font-bold">Your storefront is empty.</div>
              ) : (
                liveMangoes.map(mango => (
                  <div key={mango.id} className="bg-white p-4 rounded-xl flex items-center gap-4 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors">
                    <img src={mango.image} className="w-20 h-20 object-cover rounded-lg shadow-inner bg-gray-50" onError={(e) => e.target.src='https://via.placeholder.com/150'} />
                    <div className="flex-grow">
                      <h3 className="font-black text-gray-900 leading-tight">{mango.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {mango.discountPrice ? (
                          <>
                            <span className="text-orange-500 font-black">৳{mango.discountPrice}</span>
                            <span className="text-gray-300 text-xs line-through font-bold">৳{mango.price}</span>
                            <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-black">{mango.discountPercent}% OFF</span>
                          </>
                        ) : (
                          <span className="text-gray-900 font-black">৳{mango.price}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setEditingId(mango.id);
                          setName(mango.name);
                          setPrice(mango.price);
                          setDiscountPrice(mango.discountPrice || '');
                          setDiscountPercent(mango.discountPercent || '');
                          setDescription(mango.description);
                          setImageUrl(mango.image);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        className="px-4 py-2 bg-gray-100 rounded font-bold text-xs hover:bg-black hover:text-white transition-all uppercase"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(mango.id)} 
                        className="px-4 py-2 bg-red-50 text-red-600 rounded font-bold text-xs hover:bg-red-600 hover:text-white transition-all uppercase"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}