import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';

export default function Admin() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // Defaults to Orders now
  const [liveMangoes, setLiveMangoes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);

  // --- PRODUCT FORM STATE (Truncated details for brevity, logic remains) ---
  const [name, setName] = useState(''); const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState(''); const [discountPercent, setDiscountPercent] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('150'); const [description, setDescription] = useState('');
  const [images, setImages] = useState(['']); const [fakeSales, setFakeSales] = useState('500');
  const [fakeRating, setFakeRating] = useState('4.8'); const [fakeReviewCount, setFakeReviewCount] = useState('124');
  const [reviews, setReviews] = useState([]); const [revName, setRevName] = useState('');
  const [revRating, setRevRating] = useState('5'); const [revText, setRevText] = useState('');
  const [newPromoCode, setNewPromoCode] = useState(''); const [newPromoPercent, setNewPromoPercent] = useState('');
  const [editingId, setEditingId] = useState(null); const [isUploading, setIsUploading] = useState(false);

  // --- ORDERS EXPANSION & MANUAL ORDER STATE ---
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [mName, setMName] = useState(''); const [mPhone, setMPhone] = useState('');
  const [mItem, setMItem] = useState(''); const [mCharged, setMCharged] = useState('');
  const [mCost, setMCost] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) { fetchAllData(); setLoading(false); } 
      else { navigate('/login'); }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchAllData = async () => {
    const prodSnap = await getDocs(collection(db, 'mangoes'));
    setLiveMangoes(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const orderSnap = await getDocs(q);
    setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const promoSnap = await getDocs(collection(db, 'promos'));
    setPromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // --- STANDARD INVENTORY SUBMITS ---
  const handleImageChange = (index, value) => { const newImages = [...images]; newImages[index] = value; setImages(newImages); };
  const addImageField = () => setImages([...images, '']);
  const removeImageField = (index) => setImages(images.filter((_, i) => i !== index));
  const handleDiscountPriceChange = (val) => { setDiscountPrice(val); if (price && val) setDiscountPercent(Math.round(((price - val) / price) * 100)); else setDiscountPercent(''); };
  const handlePercentChange = (val) => { setDiscountPercent(val); if (price && val) setDiscountPrice(Math.round(price - (price * (val / 100)))); else setDiscountPrice(''); };
  
  const handleSubmit = async (e) => {
    e.preventDefault(); setIsUploading(true);
    const cleanImages = images.filter(img => img.trim() !== '');
    const productData = { name, price: Number(price), discountPrice: discountPrice ? Number(discountPrice) : null, discountPercent: discountPercent ? Number(discountPercent) : null, deliveryCharge: Number(deliveryCharge), description, images: cleanImages.length > 0 ? cleanImages : ['https://via.placeholder.com/400'], stats: { sales: Number(fakeSales), rating: Number(fakeRating), reviewCount: Number(fakeReviewCount) }, reviews: reviews, updatedAt: new Date() };
    if (editingId) { await updateDoc(doc(db, 'mangoes', editingId), productData); } 
    else { productData.createdAt = new Date(); await addDoc(collection(db, 'mangoes'), productData); }
    cancelEdit(); fetchAllData(); setIsUploading(false);
  };

  const cancelEdit = () => { setEditingId(null); setName(''); setPrice(''); setDiscountPrice(''); setDiscountPercent(''); setDeliveryCharge('150'); setDescription(''); setImages(['']); setFakeSales('500'); setFakeRating('4.8'); setFakeReviewCount('124'); setReviews([]); };
  const handleDelete = async (id) => { if(window.confirm('Delete this?')) { await deleteDoc(doc(db, 'mangoes', id)); fetchAllData(); } };
  
  // --- PROMOS ---
  const handleAddPromo = async (e) => { e.preventDefault(); await addDoc(collection(db, 'promos'), { code: newPromoCode.trim().toUpperCase(), discountPercent: Number(newPromoPercent), createdAt: new Date() }); setNewPromoCode(''); setNewPromoPercent(''); fetchAllData(); };
  const handleDeletePromo = async (id) => { await deleteDoc(doc(db, 'promos', id)); fetchAllData(); };

  // --- ORDER MANAGEMENT ACTIONS ---
  const handleUpdateStatus = async (id, newStatus) => {
    await updateDoc(doc(db, 'orders', id), { status: newStatus });
    fetchAllData();
  };
  
  const handleDeleteOrder = async (id) => {
    if(window.confirm('Delete this order completely?')) { await deleteDoc(doc(db, 'orders', id)); fetchAllData(); }
  };

  const createWhatsAppLink = (phone, total, address) => {
    if(!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if(cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone; // Auto add BD code if missing
    const message = `হ্যালো, Vertex Picks থেকে বলছি! আপনার ${total} টাকার অর্ডারটি কনফার্ম করার জন্য মেসেজ দিচ্ছি। আপনার ডেলিভারি ঠিকানা: ${address}। অর্ডারটি কি কনফার্ম করব?`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleManualOrderSubmit = async (e) => {
    e.preventDefault();
    const profit = Number(mCharged) - Number(mCost);
    await addDoc(collection(db, 'orders'), {
      isManual: true,
      customerName: mName,
      deliveryPhone: mPhone,
      items: [{ name: mItem, quantity: 1, price: Number(mCharged) }],
      total: Number(mCharged),
      cost: Number(mCost),
      profit: profit,
      status: 'Done', // Manual offline orders assume completed
      createdAt: new Date()
    });
    setShowManualModal(false); setMName(''); setMPhone(''); setMItem(''); setMCharged(''); setMCost('');
    fetchAllData();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-500 uppercase">Securing...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20">
      
      {/* MANUAL ORDER MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-6">Create Offline Order</h3>
            <form onSubmit={handleManualOrderSubmit} className="space-y-4">
              <input type="text" placeholder="Customer Name" value={mName} onChange={e=>setMName(e.target.value)} required className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />
              <input type="text" placeholder="Phone Number" value={mPhone} onChange={e=>setMPhone(e.target.value)} required className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />
              <input type="text" placeholder="Item/Box Name" value={mItem} onChange={e=>setMItem(e.target.value)} required className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />
              <div className="flex gap-2">
                <input type="number" placeholder="Amt Charged" value={mCharged} onChange={e=>setMCharged(e.target.value)} required className="w-full p-3 bg-green-50 border border-green-200 text-green-700 rounded font-bold outline-none" />
                <input type="number" placeholder="True Cost" value={mCost} onChange={e=>setMCost(e.target.value)} required className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded font-bold outline-none" />
              </div>
              {mCharged && mCost && (
                <p className="text-center font-black text-sm uppercase text-blue-600 bg-blue-50 py-2 rounded border border-blue-200">
                  Calculated Profit: ৳{Number(mCharged) - Number(mCost)}
                </p>
              )}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 bg-black text-white font-black py-3 rounded uppercase text-sm hover:bg-orange-500">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="w-full bg-white shadow-md border-b-4 border-orange-500 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <h1 className="text-2xl font-black tracking-tighter">ADMIN <span className="text-orange-500">PRO</span></h1>
          <nav className="flex gap-6">
            {['orders', 'inventory', 'promos'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-xs font-black uppercase tracking-widest ${activeTab === tab ? 'text-orange-500 border-b-2 border-orange-500 pb-1' : 'text-gray-400 hover:text-black'}`}>{tab}</button>
            ))}
          </nav>
          <button onClick={() => signOut(auth)} className="text-xs font-black bg-black text-white px-4 py-2 rounded">Exit</button>
      </div>

      <div className="max-w-7xl w-full mt-10 px-4">
        
        {/* ORDERS TAB (NOW THE MAIN FEATURE) */}
        {activeTab === 'orders' && (
           <div className="space-y-6">
              
              <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div>
                  <h2 className="font-black uppercase text-xl">Order Management</h2>
                  <p className="text-gray-500 font-bold text-sm">Total Orders: {orders.length}</p>
                </div>
                <button onClick={() => setShowManualModal(true)} className="bg-orange-500 text-white font-black px-6 py-3 rounded hover:bg-black uppercase text-sm tracking-widest shadow-md">
                  + Add Offline Sale
                </button>
              </div>

              {orders.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed font-bold text-gray-400">No active orders.</div>
              ) : (
                 orders.map(order => (
                    <div key={order.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${order.status === 'Cancelled' ? 'border-red-300' : 'border-gray-200'}`}>
                       
                       {/* CANCELLATION BANNER */}
                       {order.status === 'Cancelled' && (
                         <div className="bg-red-500 text-white font-black text-xs uppercase tracking-widest py-1.5 px-6">
                           Order Cancelled • Reason: {order.cancelReason || 'Not specified'}
                         </div>
                       )}

                       {/* MAIN ROW (CLICKABLE TO EXPAND) */}
                       <div 
                         onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                         className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-gray-50 transition-colors ${order.isManual ? 'bg-blue-50' : ''}`}
                       >
                          <div>
                             <div className="flex items-center gap-3 mb-1">
                               <p className="text-xs font-black text-gray-400 uppercase tracking-widest">ID: {order.id.slice(-6)}</p>
                               {order.isManual && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">Offline Sale</span>}
                             </div>
                             <h3 className="text-xl font-black text-gray-900">{order.customerName || order.customerEmail}</h3>
                             <p className="text-gray-500 font-bold text-sm">
                               {order.isManual ? (
                                 <span className="text-green-600 font-black">Profit: ৳{order.profit}</span>
                               ) : (
                                 `Total: ৳${order.total}`
                               )} 
                               <span className="mx-2">•</span> 
                               Status: <span className={`${order.status === 'Done' ? 'text-green-500' : order.status === 'Cancelled' ? 'text-red-500' : 'text-orange-500'}`}>{order.status}</span>
                             </p>
                          </div>
                          <div className="text-gray-400 font-black mt-4 md:mt-0">
                            {expandedOrder === order.id ? '▲ CLOSE' : '▼ VIEW DETAILS'}
                          </div>
                       </div>

                       {/* EXPANDED DETAILS */}
                       {expandedOrder === order.id && (
                         <div className="bg-gray-50 p-6 border-t border-gray-200 animate-in slide-in-from-top-2">
                           
                           {/* Details Grid */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                             <div>
                               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Delivery Info</h4>
                               <p className="font-bold text-gray-800">Phone: <span className="text-blue-600">{order.deliveryPhone || mPhone || 'N/A'}</span></p>
                               <p className="font-bold text-gray-800 mt-1">Address: {order.deliveryAddress || 'N/A'}</p>
                             </div>
                             <div>
                               <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Items Ordered</h4>
                               <ul className="space-y-1">
                                 {order.items.map((item, idx) => (
                                   <li key={idx} className="font-bold text-gray-800 text-sm">
                                     {item.quantity}x {item.name} {item.weight ? `(${item.weight}kg)` : ''} 
                                   </li>
                                 ))}
                               </ul>
                               {!order.isManual && (
                                 <div className="mt-2 text-xs font-bold text-gray-500">
                                   Promo Used: <span className="text-orange-500">{order.promoUsed || 'None'}</span>
                                 </div>
                               )}
                             </div>
                           </div>

                           {/* Actions */}
                           <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                             
                             {/* ONLY SHOW WHATSAPP IF IT HAS A PHONE NUMBER AND IS NOT CANCELLED */}
                             {order.deliveryPhone && order.status !== 'Cancelled' && (
                               <a 
                                 href={createWhatsAppLink(order.deliveryPhone, order.total, order.deliveryAddress)}
                                 target="_blank" rel="noreferrer"
                                 className="bg-[#25D366] text-white font-black px-4 py-2 rounded text-xs uppercase tracking-widest shadow-sm hover:bg-[#128C7E] flex items-center gap-2"
                               >
                                 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.299 1.263.478 1.694.611.712.22 1.36.189 1.872.114.576-.084 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                 Send WA Confirm
                               </a>
                             )}

                             {order.status !== 'Done' && order.status !== 'Cancelled' && (
                               <button onClick={() => handleUpdateStatus(order.id, 'Done')} className="bg-black text-white font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-orange-500">
                                 Mark as Done
                               </button>
                             )}

                             <button onClick={() => handleDeleteOrder(order.id)} className="bg-red-100 text-red-600 font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white ml-auto">
                               Delete Record
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                 ))
              )}
           </div>
        )}

        {/* INVENTORY TAB & PROMOS TAB REMAIN UNCHANGED BELOW */}
        {/* ... (Note for you: The Inventory and Promos tabs code from the previous iteration remain exactly the same here, omitted to keep this block readable, but they live inside this div!) */}

      </div>
    </div>
  );
}