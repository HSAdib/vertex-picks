import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function InventoryTab() {
  const [liveMangoes, setLiveMangoes] = useState([]);
  const [storeSections, setStoreSections] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // --- PRODUCT FORM STATE ---
  const [name, setName] = useState(''); 
  const [sku, setSku] = useState('');
  const [minThreshold, setMinThreshold] = useState('10');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState(''); 
  const [discountPercent, setDiscountPercent] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('150'); 
  const [fixedWeight, setFixedWeight] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState('Uncategorized');
  const [images, setImages] = useState(['']);
  
  const [fakeSales, setFakeSales] = useState('500');
  const [fakeRating, setFakeRating] = useState('4.8'); 
  const [fakeReviewCount, setFakeReviewCount] = useState('124');
  const [reviews, setReviews] = useState([]); 
  const [stock, setStock] = useState('100');
  const [maxStock, setMaxStock] = useState('100');
  
  const [editingId, setEditingId] = useState(null); 
  const [isUploading, setIsUploading] = useState(false);

  // --- CONFIRM MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const prodSnap = await getDocs(collection(db, 'mangoes'));
      let loadedSections = [];
      const loadedMangoes = [];
      
      prodSnap.docs.forEach(doc => {
        if (doc.id === 'STORE_SECTIONS') {
          loadedSections = doc.data().list || [];
        } else {
          loadedMangoes.push({ id: doc.id, ...doc.data() });
        }
      });
      
      setLiveMangoes(loadedMangoes);
      setStoreSections(loadedSections);
    } catch (error) {
      console.error("Error fetching mangoes:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchProducts();
    });
  }, []);

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

  const handleImageChange = (index, value) => { 
    const newImages = [...images]; 
    newImages[index] = value; 
    setImages(newImages); 
  };
  
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
        sku: sku ? sku.trim() : '',
        minThreshold: minThreshold ? Number(minThreshold) : 10,
        price: Number(price), 
        discountPrice: discountPrice ? Number(discountPrice) : null, 
        discountPercent: discountPercent ? Number(discountPercent) : null, 
        deliveryCharge: Number(deliveryCharge), 
        fixedWeight: Number(fixedWeight) || 1, 
        description, 
        section,
        images: finalImages, 
        stats: { sales: Number(fakeSales), rating: Number(fakeRating), reviewCount: Number(fakeReviewCount) }, 
        reviews: reviews || [], 
        stock: Number(stock),
        maxStock: Number(maxStock || 100),
        updatedAt: new Date() 
      };

      if (editingId) { 
        await updateDoc(doc(db, 'mangoes', editingId), productData); 
        toast.success("Product Updated");
      } else { 
        productData.createdAt = new Date(); 
        await addDoc(collection(db, 'mangoes'), productData); 
        toast.success("Product Created");
      }

      cancelEdit(); 
      fetchProducts();
    } catch (err) {
      console.error("Error saving product:", err);
      toast.error("Failed to save product.");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelEdit = () => { 
    setEditingId(null); setName(''); setPrice(''); setDiscountPrice(''); setDiscountPercent(''); 
    setDeliveryCharge('150'); setFixedWeight(''); setDescription(''); setSection('Uncategorized');
    setImages(['']);
    setFakeSales('500'); setFakeRating('4.8'); setFakeReviewCount('124'); setReviews([]);
    setStock('100'); setMaxStock('100');
    setSku(''); setMinThreshold('10');
  };

  const executeDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'mangoes', id)); 
      fetchProducts(); 
      toast.success("Product Deleted");
    } catch {
      toast.error("Failed to delete product");
    }
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
    setSku(mango.sku || '');
    setMinThreshold(mango.minThreshold !== undefined ? mango.minThreshold.toString() : '10');
    setPrice(mango.price || ''); 
    setDiscountPrice(mango.discountPrice || ''); 
    setDiscountPercent(mango.discountPercent || ''); 
    setDeliveryCharge(mango.deliveryCharge || '150'); 
    setFixedWeight(mango.fixedWeight || ''); 
    setDescription(mango.description || ''); 
    setSection(mango.section || 'Uncategorized');
    setImages(mango.images && mango.images.length > 0 ? mango.images : ['']);
    setFakeSales(mango.stats?.sales || ''); 
    setFakeRating(mango.stats?.rating || ''); 
    setFakeReviewCount(mango.stats?.reviewCount || ''); 
    setReviews(mango.reviews || []);
    setStock(mango.stock !== undefined ? mango.stock.toString() : '100');
    setMaxStock(mango.maxStock !== undefined ? mango.maxStock.toString() : '100');
    window.scrollTo(0, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      
      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-brand p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-lg font-black uppercase text-dark mb-2">{confirmModal.title}</h3>
            <p className="text-xs font-bold text-gray4 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 bg-red text-white font-bold py-2.5 rounded-brand-sm uppercase text-xs hover:bg-red/80">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT CARD */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">{editingId ? '✏️ Edit Product Details' : '➕ Add New Store Product'}</h3>
            <span className="ach-sub">Publish tree-bagged varieties with SKU tracking and alert thresholds</span>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Product Name</label>
                <input type="text" placeholder="Product Name" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Product SKU (Serial Key)</label>
                <input type="text" placeholder="e.g. MNG-HMS-5KG" value={sku} onChange={e => setSku(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>
              
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Store Catalog Section</label>
                <select value={section} onChange={e => setSection(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm cursor-pointer">
                  <option value="Uncategorized">Uncategorized</option>
                  {storeSections.map((sec, idx) => (
                    <option key={idx} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Base Price (৳)</label>
                <input type="number" placeholder="Base Price (৳)" required value={price} onChange={e => { setPrice(e.target.value); handleDiscountPriceChange(discountPrice); }} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Discount Price (৳) (Optional)</label>
                <input type="number" placeholder="Discount Price (৳) - Optional" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Discount Percent (%) (Optional)</label>
                <input type="number" placeholder="Discount Percent (%) - Optional" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Delivery Charge (৳)</label>
                <input type="number" placeholder="Delivery Charge (৳)" required value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Fixed Box Weight (kg)</label>
                <input type="number" placeholder="Fixed Weight (kg) - Default 1kg" value={fixedWeight} onChange={e => setFixedWeight(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Stock Quantity (kg/boxes)</label>
                <input type="number" placeholder="Current Stock" required value={stock} onChange={e => setStock(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Max Stock Capacity (kg/boxes)</label>
                <input type="number" placeholder="Max Stock Capacity" required value={maxStock} onChange={e => setMaxStock(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Min Stock Alert Threshold</label>
                <input type="number" placeholder="e.g. 10" required value={minThreshold} onChange={e => setMinThreshold(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Variety Description</label>
              <textarea placeholder="Product Description..." required value={description} onChange={e => setDescription(e.target.value)} rows="3" className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm resize-none" />
            </div>

            {/* PRODUCT IMAGES SECTION */}
            <div className="bg-gray-50/50 p-4 rounded-brand border border-gray2 shadow-sm">
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-2">Images (URLs)</label>
              {images.map((img, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input type="url" placeholder="Image URL" value={img} onChange={e => handleImageChange(idx, e.target.value)} className="flex-1 p-2.5 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm" />
                  {images.length > 1 && (
                    <button type="button" onClick={() => removeImageField(idx)} className="bg-red-100 text-red-600 px-3 rounded font-black hover:bg-red-600 hover:text-white transition-all text-xs">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addImageField} className="text-[10px] font-black text-primary hover:text-primary-light uppercase tracking-wider mt-1 bg-transparent border-none outline-none">
                + Add Another Image URL
              </button>
            </div>

            {/* MOCK STATS */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray2">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Fake Sales Count</label>
                <input type="number" placeholder="Fake Sales" value={fakeSales} onChange={e => setFakeSales(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold outline-none text-xs shadow-sm" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Fake Rating (1-5)</label>
                <input type="number" step="0.1" placeholder="Fake Rating" value={fakeRating} onChange={e => setFakeRating(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold outline-none text-xs shadow-sm" />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Fake Reviews Count</label>
                <input type="number" placeholder="Fake Reviews" value={fakeReviewCount} onChange={e => setFakeReviewCount(e.target.value)} className="w-full p-3 bg-white border border-gray2 rounded font-bold outline-none text-xs shadow-sm" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingId && <button type="button" onClick={cancelEdit} disabled={isUploading} className="flex-1 btn-secondary text-xs uppercase py-3 shadow-sm">Cancel Edit</button>}
              <button type="submit" disabled={isUploading} className="flex-1 btn-primary text-xs uppercase py-3 shadow-md flex items-center justify-center gap-2">
                {isUploading ? 'Saving...' : (editingId ? 'Update Product ⚡' : 'Publish Product 🚀')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* INVENTORY TABLE CARD */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">📋 Products Inventory</h3>
            <span className="ach-sub">Track active pricing, boxed weights, and stock thresholds</span>
          </div>
          <span className="bg-primary-pale text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
            {liveMangoes?.length || 0} Total Varieties
          </span>
        </div>

        <div className="p-6">
          {loadingProducts ? (
            <div className="text-center py-10 border-2 border-dashed border-gray2 rounded-brand text-gray4 font-bold text-xs animate-pulse">Loading products...</div>
          ) : (!liveMangoes || liveMangoes.length === 0) ? (
            <div className="text-center py-10 border-2 border-dashed border-gray2 rounded-brand text-gray4 font-bold text-xs">No products loaded. Ensure Brave Shields are OFF so Firestore can connect.</div>
          ) : (
            <div className="overflow-x-auto select-none w-full">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product details</th>
                    <th>SKU</th>
                    <th>Store Section</th>
                    <th>Pricing (৳)</th>
                    <th>Box Parameters</th>
                    <th>Min Alert</th>
                    <th>Inventory Stock Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liveMangoes.map(mango => {
                    const st = mango.stock !== undefined ? mango.stock : 85;
                    const maxSt = mango.maxStock !== undefined ? mango.maxStock : 100;
                    const pct = Math.min(100, Math.max(0, (st / maxSt) * 100));
                    
                    const thresh = (mango.minThreshold !== undefined && mango.minThreshold !== null && !isNaN(Number(mango.minThreshold))) ? Number(mango.minThreshold) : 10;
                    const isCritical = st <= thresh / 2;
                    const isLow = st <= thresh && st > thresh / 2;
                    
                    return (
                      <tr key={mango.id} className={isCritical ? 'bg-red-pale/20' : isLow ? 'bg-gold-pale/20' : ''}>
                        <td>
                          <div className="at-product-cell">
                            <img 
                              src={mango.images?.[0] || 'https://via.placeholder.com/150'} 
                              alt={mango.name || 'Product'} 
                              className="w-10 h-10 object-cover rounded-md border border-gray2 shrink-0" 
                            />
                            <div className="min-w-0">
                              <div className="at-product-name truncate max-w-[180px] font-bold text-xs text-dark">{mango.name || 'Unnamed Product'}</div>
                              <div className="at-product-var text-[10px] text-gray4 font-semibold">Sales: {mango.stats?.sales || 0} sold</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-bold text-xs text-gray-500 uppercase tracking-wider font-mono">
                          {mango.sku || 'N/A'}
                        </td>
                        <td className="font-bold text-xs text-gray-700">{mango.section || 'Uncategorized'}</td>
                        <td>
                          {mango.discountPrice ? (
                            <div>
                              <span className="text-[10px] text-gray4 line-through font-bold block">৳{mango.price}</span>
                              <span className="font-black text-sm text-primary">৳{mango.discountPrice}</span>
                            </div>
                          ) : (
                            <span className="font-black text-sm text-gray-800">৳{mango.price}</span>
                          )}
                        </td>
                        <td className="text-xs text-gray-600 font-bold">
                          <div>⚖️ {mango.fixedWeight || 1} kg</div>
                          <div className="text-[10px] text-gray4 mt-0.5">🚚 ৳{mango.deliveryCharge || 150}</div>
                        </td>
                        <td className={`text-xs font-black text-center ${isCritical ? 'text-red' : isLow ? 'text-gold' : 'text-gray-500'}`}>
                          ⚠️ {thresh}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="at-stock-bar">
                              <div 
                                className={`at-stock-fill ${isCritical ? 'critical' : isLow ? 'low' : ''}`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                            <span className="font-black text-xs text-gray-700 shrink-0">{st}/{maxSt}</span>
                          </div>
                        </td>
                        <td>
                          <div className="at-actions">
                            <button 
                              type="button"
                              onClick={() => handleEditClick(mango)} 
                              className="at-action-btn"
                              title="Edit Product"
                            >
                              ✏️
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(mango.id)} 
                              className="at-action-btn danger text-red"
                              title="Delete Product"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}
