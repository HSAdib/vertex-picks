import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';

export default function InventoryTab() {
  const [liveMangoes, setLiveMangoes] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // --- PRODUCT FORM STATE ---
  const [name, setName] = useState(''); const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState(''); const [discountPercent, setDiscountPercent] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('150'); const [fixedWeight, setFixedWeight] = useState('');
  const [description, setDescription] = useState('');
  
  const [images, setImages] = useState(['']);
  
  const [fakeSales, setFakeSales] = useState('500');
  const [fakeRating, setFakeRating] = useState('4.8'); const [fakeReviewCount, setFakeReviewCount] = useState('124');
  const [reviews, setReviews] = useState([]); 
  
  const [editingId, setEditingId] = useState(null); 
  const [isUploading, setIsUploading] = useState(false);

  // --- CONFIRM MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const prodSnap = await getDocs(collection(db, 'mangoes'));
      setLiveMangoes(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching mangoes:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDiscountPriceChange = (val) => { setDiscountPrice(val); if (price && val) setDiscountPercent(Math.round(((price - val) / price) * 100)); else setDiscountPercent(''); };
  const handlePercentChange = (val) => { setDiscountPercent(val); if (price && val) setDiscountPrice(Math.round(price - (price * (val / 100)))); else setDiscountPrice(''); };

  const handleImageChange = (index, value) => { const newImages = [...images]; newImages[index] = value; setImages(newImages); };
  const addImageField = () => setImages([...images, '']);
  const removeImageField = (index) => setImages(images.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setIsUploading(true);

    try {
      const cleanImages = images.filter(img => img?.trim() !== '');
      const finalImages = cleanImages.length > 0 ? cleanImages : ['https://via.placeholder.com/400'];

      const productData = { 
        name, 
        price: Number(price), 
        discountPrice: discountPrice ? Number(discountPrice) : null, 
        discountPercent: discountPercent ? Number(discountPercent) : null, 
        deliveryCharge: Number(deliveryCharge), 
        fixedWeight: Number(fixedWeight), 
        description, 
        images: finalImages, 
        stats: { sales: Number(fakeSales), rating: Number(fakeRating), reviewCount: Number(fakeReviewCount) }, 
        reviews: reviews || [], 
        updatedAt: new Date() 
      };

      if (editingId) { 
        await updateDoc(doc(db, 'mangoes', editingId), productData); 
      } else { 
        productData.createdAt = new Date(); 
        await addDoc(collection(db, 'mangoes'), productData); 
      }

      cancelEdit(); 
      fetchProducts();
    } catch (err) {
      console.error("Error saving product:", err);
      alert("Failed to save product.");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelEdit = () => { 
    setEditingId(null); setName(''); setPrice(''); setDiscountPrice(''); setDiscountPercent(''); 
    setDeliveryCharge('150'); setFixedWeight(''); setDescription(''); 
    setImages(['']);
    setFakeSales('500'); setFakeRating('4.8'); setFakeReviewCount('124'); setReviews([]);
  };

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'mangoes', id)); 
    fetchProducts(); 
  };

  const handleDelete = (id) => { 
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? This action cannot be undone.',
      action: () => executeDelete(id)
    });
  };

  const handleEditClick = (mango) => {
    setEditingId(mango.id); 
    setName(mango.name || ''); 
    setPrice(mango.price || ''); 
    setDiscountPrice(mango.discountPrice || ''); 
    setDiscountPercent(mango.discountPercent || ''); 
    setDeliveryCharge(mango.deliveryCharge || '150'); 
    setFixedWeight(mango.fixedWeight || ''); 
    setDescription(mango.description || ''); 
    setImages(mango.images || ['']);
    setFakeSales(mango.stats?.sales || ''); 
    setFakeRating(mango.stats?.rating || ''); 
    setFakeReviewCount(mango.stats?.reviewCount || ''); 
    window.scrollTo(0, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Product Name" required value={name} onChange={e => setName(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
            <input type="number" placeholder="Base Price (৳)" required value={price} onChange={e => { setPrice(e.target.value); handleDiscountPriceChange(discountPrice); }} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
            <input type="number" placeholder="Discount Price (৳) - Optional" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
            <input type="number" placeholder="Discount Percent (%) - Optional" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
            <input type="number" placeholder="Delivery Charge (৳)" required value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
            <input type="number" placeholder="Fixed Weight per Unit/Box (kg)" required value={fixedWeight} onChange={e => setFixedWeight(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none" />
          </div>

          <textarea placeholder="Product Description..." required value={description} onChange={e => setDescription(e.target.value)} rows="3" className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />

          {/* FIREBASE STORAGE IMAGE UPLOAD */}
          <div>
            <h3 className="font-black text-sm uppercase mb-2">Images (URLs)</h3>
            {images.map((img, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="url" placeholder="Image URL" value={img} onChange={e => handleImageChange(idx, e.target.value)} className="flex-1 p-3 bg-gray-50 border rounded font-bold outline-none" />
                {images.length > 1 && (
                  <button type="button" onClick={() => removeImageField(idx)} className="bg-red-100 text-red-600 px-4 rounded font-black hover:bg-red-200">X</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addImageField} className="text-sm font-black text-orange-500 hover:text-black uppercase mt-1">+ Add Another Image</button>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <input type="number" placeholder="Fake Sales" value={fakeSales} onChange={e => setFakeSales(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none text-sm" />
            <input type="number" step="0.1" placeholder="Fake Rating" value={fakeRating} onChange={e => setFakeRating(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none text-sm" />
            <input type="number" placeholder="Fake Reviews" value={fakeReviewCount} onChange={e => setFakeReviewCount(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none text-sm" />
          </div>

          <div className="flex gap-4 pt-4">
            {editingId && <button type="button" onClick={cancelEdit} disabled={isUploading} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300 disabled:opacity-50">Cancel Edit</button>}
            <button type="submit" disabled={isUploading} className="flex-1 bg-black text-white font-black py-3 rounded uppercase text-sm hover:bg-orange-500 disabled:opacity-50 flex items-center justify-center gap-2">
              {isUploading ? 'Saving...' : (editingId ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6">Live Products ({liveMangoes?.length || 0})</h2>
        {loadingProducts ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400 font-bold">Loading products...</div>
        ) : (!liveMangoes || liveMangoes.length === 0) ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400 font-bold">No products loaded. Ensure Brave Shields are OFF so Firestore can connect.</div>
        ) : (
          <div className="space-y-4">
            {liveMangoes.map(mango => (
              <div key={mango.id} className="flex justify-between items-center p-4 bg-gray-50 border rounded-lg">
                <div className="flex items-center gap-4">
                  <img src={mango.images?.[0] || 'https://via.placeholder.com/150'} alt={mango.name || 'Product'} className="w-16 h-16 object-cover rounded-md border" />
                  <div>
                    <h3 className="font-black text-lg">{mango.name || 'Unnamed Product'}</h3>
                    <p className="text-gray-500 font-bold text-sm">৳{mango.discountPrice || mango.price || 0} {mango.discountPercent && <span className="text-orange-500 ml-2">-{mango.discountPercent}%</span>}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditClick(mango)} className="bg-gray-200 px-4 py-2 rounded font-black text-xs uppercase hover:bg-gray-300">Edit</button>
                  <button onClick={() => handleDelete(mango.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-red-600 hover:text-white">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 bg-red-600 text-white font-black py-3 rounded uppercase text-sm hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
