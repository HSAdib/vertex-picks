import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';

export default function Admin() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [liveMangoes, setLiveMangoes] = useState([]);
  const [orders, setOrders] = useState([]);

  // --- FORM STATE ---
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState(['']); 
  
  // Custom Fake Stats
  const [fakeSales, setFakeSales] = useState('500');
  const [fakeRating, setFakeRating] = useState('4.8');
  const [fakeReviewCount, setFakeReviewCount] = useState('124');

  // --- NEW: REVIEW BUILDER STATE ---
  const [reviews, setReviews] = useState([]);
  const [revName, setRevName] = useState('');
  const [revRating, setRevRating] = useState('5');
  const [revText, setRevText] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleImageChange = (index, value) => {
    const newImages = [...images];
    newImages[index] = value;
    setImages(newImages);
  };
  const addImageField = () => setImages([...images, '']);
  const removeImageField = (index) => setImages(images.filter((_, i) => i !== index));

  const handleDiscountPriceChange = (val) => {
    setDiscountPrice(val);
    if (price && val) setDiscountPercent(Math.round(((price - val) / price) * 100));
    else setDiscountPercent('');
  };

  const handlePercentChange = (val) => {
    setDiscountPercent(val);
    if (price && val) setDiscountPrice(Math.round(price - (price * (val / 100))));
    else setDiscountPrice('');
  };

  // ADD CUSTOM REVIEW TO LOCAL STATE
  const handleAddReview = () => {
    if(!revName || !revText) return alert("Review needs a name and text!");
    const newReview = {
      id: Date.now().toString(),
      name: revName,
      rating: Number(revRating),
      text: revText,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      isVerified: true
    };
    setReviews([newReview, ...reviews]);
    setRevName(''); setRevText(''); setRevRating('5');
  };

  // REMOVE REVIEW
  const handleRemoveReview = (idToRemove) => {
    setReviews(reviews.filter(r => r.id !== idToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const cleanImages = images.filter(img => img.trim() !== '');

    const productData = { 
      name, 
      price: Number(price), 
      discountPrice: discountPrice ? Number(discountPrice) : null,
      discountPercent: discountPercent ? Number(discountPercent) : null,
      description, 
      images: cleanImages.length > 0 ? cleanImages : ['https://via.placeholder.com/400'], 
      stats: { sales: Number(fakeSales), rating: Number(fakeRating), reviewCount: Number(fakeReviewCount) },
      reviews: reviews, // Save the custom reviews!
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
    setDiscountPercent(''); setDescription(''); setImages(['']); 
    setFakeSales('500'); setFakeRating('4.8'); setFakeReviewCount('124');
    setReviews([]); setRevName(''); setRevText('');
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this?')) { await deleteDoc(doc(db, 'mangoes', id)); fetchAllData(); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-500 uppercase">Securing...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pb-20">
      <div className="w-full bg-white shadow-md border-b-4 border-orange-500 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <h1 className="text-2xl font-black tracking-tighter">ADMIN <span className="text-orange-500">PRO</span></h1>
          <nav className="flex gap-6">
            {['inventory', 'orders'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-xs font-black uppercase tracking-widest ${activeTab === tab ? 'text-orange-500' : 'text-gray-400'}`}>{tab}</button>
            ))}
          </nav>
          <button onClick={() => signOut(auth)} className="text-xs font-black bg-black text-white px-4 py-2 rounded">Exit</button>
      </div>

      <div className="max-w-7xl w-full mt-10 px-4">
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT SIDE: FORM */}
            <div className="lg:col-span-5">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h2 className="font-black uppercase text-xl">{editingId ? 'Edit Mango' : 'Add New Harvest'}</h2>
                  {editingId && <button type="button" onClick={cancelEdit} className="text-xs bg-gray-200 px-3 py-1 rounded font-bold text-gray-700 hover:bg-gray-300">Cancel</button>}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* BASIC INFO */}
                  <div className="space-y-3">
                    <input type="text" placeholder="Mango Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold focus:border-orange-500" required />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" placeholder="Price" value={price} onChange={e => {setPrice(e.target.value); setDiscountPrice(''); setDiscountPercent('');}} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" required />
                      <input type="number" placeholder="Disc. Price" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded text-orange-600 font-bold" />
                      <input type="number" placeholder="Disc. %" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="w-full p-3 bg-orange-50 border border-orange-200 rounded text-orange-600 font-bold" />
                    </div>
                    <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-gray-50 border rounded outline-none font-bold" rows="3" required />
                  </div>

                  {/* IMAGES */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Gallery</label>
                    {images.map((img, index) => (
                      <div key={index} className="flex gap-2">
                        <input type="url" placeholder={`URL ${index + 1}`} value={img} onChange={e => handleImageChange(index, e.target.value)} className="w-full p-2 border rounded font-medium text-sm outline-none" required={index === 0} />
                        {images.length > 1 && <button type="button" onClick={() => removeImageField(index)} className="bg-red-100 text-red-500 px-3 rounded font-bold">✕</button>}
                      </div>
                    ))}
                    <button type="button" onClick={addImageField} className="text-xs font-bold text-orange-500 border border-orange-500 border-dashed w-full py-2 rounded hover:bg-orange-50">+ Add Photo</button>
                  </div>

                  {/* FAKE SOCIAL PROOF */}
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest">Custom Social Proof</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div><span className="text-[10px] uppercase font-bold text-gray-500">Sold</span><input type="number" value={fakeSales} onChange={e => setFakeSales(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" /></div>
                      <div><span className="text-[10px] uppercase font-bold text-gray-500">Rating</span><input type="number" step="0.1" value={fakeRating} onChange={e => setFakeRating(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" /></div>
                      <div><span className="text-[10px] uppercase font-bold text-gray-500">Reviews</span><input type="number" value={fakeReviewCount} onChange={e => setFakeReviewCount(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" /></div>
                    </div>
                  </div>

                  {/* CUSTOM REVIEW BUILDER */}
                  <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <label className="text-xs font-black text-orange-600 uppercase tracking-widest">Custom Review Builder</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Fake Customer Name" value={revName} onChange={e => setRevName(e.target.value)} className="w-2/3 p-2 border rounded text-sm font-bold" />
                      <select value={revRating} onChange={e => setRevRating(e.target.value)} className="w-1/3 p-2 border rounded text-sm font-bold bg-white">
                        <option value="5">⭐⭐⭐⭐⭐</option>
                        <option value="4">⭐⭐⭐⭐</option>
                        <option value="3">⭐⭐⭐</option>
                      </select>
                    </div>
                    <textarea placeholder="Write the glowing review here..." value={revText} onChange={e => setRevText(e.target.value)} className="w-full p-2 border rounded text-sm font-medium" rows="2"></textarea>
                    {/* MUST BE TYPE="BUTTON" so it doesn't submit the main form! */}
                    <button type="button" onClick={handleAddReview} className="w-full bg-orange-500 text-white font-bold py-2 rounded text-xs uppercase tracking-widest">Add Review to Product</button>
                    
                    {/* List of custom reviews added */}
                    {reviews.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                        {reviews.map(r => (
                          <div key={r.id} className="bg-white p-2 border rounded text-xs flex justify-between items-start shadow-sm">
                            <div>
                              <p className="font-bold">{r.name} <span className="text-orange-400">({r.rating}★)</span></p>
                              <p className="text-gray-500 truncate w-48">{r.text}</p>
                            </div>
                            <button type="button" onClick={() => handleRemoveReview(r.id)} className="text-red-500 font-bold px-2 hover:bg-red-50 rounded">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={isUploading} className="w-full bg-black text-white font-black py-4 rounded hover:bg-orange-500 uppercase tracking-widest transition-all shadow-lg">
                    {isUploading ? 'Saving...' : (editingId ? 'Update Product' : 'Push to Live Store')}
                  </button>
                </form>
              </div>
            </div>
            
            {/* RIGHT SIDE: INVENTORY LIST (Truncated for brevity, stays the same) */}
            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-black uppercase text-gray-400 text-sm tracking-widest mb-2">Live Inventory ({liveMangoes.length})</h2>
              {liveMangoes.map(mango => (
                <div key={mango.id} className="bg-white p-4 rounded-xl flex items-center gap-4 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors">
                  <img src={mango.images ? mango.images[0] : mango.image} className="w-20 h-20 object-cover rounded-lg shadow-inner bg-gray-50" />
                  <div className="flex-grow">
                    <h3 className="font-black text-gray-900 leading-tight">{mango.name}</h3>
                    <div className="flex gap-4 mt-1 text-xs font-bold text-gray-400">
                      <span>⭐ {mango.stats?.rating || 0}</span>
                      <span>🛒 {mango.stats?.sales || 0} Sold</span>
                      <span>📝 {mango.reviews?.length || 0} Reviews</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => {
                        setEditingId(mango.id); setName(mango.name); setPrice(mango.price);
                        setDiscountPrice(mango.discountPrice || ''); setDiscountPercent(mango.discountPercent || '');
                        setDescription(mango.description); setImages(mango.images || [mango.image || '']);
                        setFakeSales(mango.stats?.sales || '0'); setFakeRating(mango.stats?.rating || '0'); setFakeReviewCount(mango.stats?.reviewCount || '0');
                        setReviews(mango.reviews || []); // Load the reviews!
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }} 
                      className="px-4 py-2 bg-gray-100 rounded font-bold text-xs hover:bg-black hover:text-white uppercase"
                    >Edit</button>
                    <button onClick={() => handleDelete(mango.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded font-bold text-xs hover:bg-red-600 hover:text-white uppercase">Delete</button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}