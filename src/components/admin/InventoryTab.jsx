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
  
  // --- RICH PDP DATA STATE ---
  const [badge, setBadge] = useState('');
  const [packs, setPacks] = useState([]); 
  const [specs, setSpecs] = useState({
    origin: 'Rajshahi, Bangladesh',
    sweetness: '⭐⭐⭐⭐⭐ Very High',
    fiber: 'Fibreless',
    preservation: 'No chemicals. Tree-bagged.',
    shelfLife: '5–7 days at room temp',
    bestFor: ''
  });
  const [highlights, setHighlights] = useState([
    'Handpicked at peak ripeness for maximum sweetness and aroma', 
    'Tree-bagged from early growth — zero pesticides', 
    'Sorted and graded by hand — only A-grade fruit ships'
  ]);
  
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

  // Handlers for Rich PDP Dynamic Arrays
  const handleHighlightChange = (index, value) => {
    const newH = [...highlights];
    newH[index] = value;
    setHighlights(newH);
  };
  const addHighlightField = () => setHighlights([...highlights, '']);
  const removeHighlightField = (index) => setHighlights(highlights.filter((_, i) => i !== index));

  const handlePackChange = (index, field, value) => {
    const newP = [...packs];
    newP[index][field] = value;
    setPacks(newP);
  };
  const addPackField = () => setPacks([...packs, { name: '', price: '' }]);
  const removePackField = (index) => setPacks(packs.filter((_, i) => i !== index));

  const handleSpecChange = (key, value) => {
    setSpecs({ ...specs, [key]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setIsUploading(true);

    try {
      const cleanImages = images.filter(img => img?.trim() !== '');
      const finalImages = cleanImages.length > 0 ? cleanImages : [];

      const cleanHighlights = highlights.filter(h => h?.trim() !== '');
      const cleanPacks = packs.filter(p => p.name?.trim() !== '' && p.price !== '');

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
        
        // Rich PDP fields
        badge: badge ? badge.trim() : '',
        packs: cleanPacks.map(p => ({ name: p.name.trim(), price: Number(p.price) })),
        specs,
        highlights: cleanHighlights,

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
    
    // Rich PDP defaults
    setBadge('');
    setPacks([]);
    setSpecs({
      origin: 'Rajshahi, Bangladesh',
      sweetness: '⭐⭐⭐⭐⭐ Very High',
      fiber: 'Fibreless',
      preservation: 'No chemicals. Tree-bagged.',
      shelfLife: '5–7 days at room temp',
      bestFor: ''
    });
    setHighlights([
      'Handpicked at peak ripeness for maximum sweetness and aroma', 
      'Tree-bagged from early growth — zero pesticides', 
      'Sorted and graded by hand — only A-grade fruit ships'
    ]);
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
    
    // Rich PDP population
    setBadge(mango.badge || '');
    setPacks(mango.packs || []);
    setSpecs(mango.specs || {
      origin: 'Rajshahi, Bangladesh',
      sweetness: '⭐⭐⭐⭐⭐ Very High',
      fiber: 'Fibreless',
      preservation: 'No chemicals. Tree-bagged.',
      shelfLife: '5–7 days at room temp',
      bestFor: ''
    });
    setHighlights(mango.highlights || [
      'Handpicked at peak ripeness for maximum sweetness and aroma', 
      'Tree-bagged from early growth — zero pesticides', 
      'Sorted and graded by hand — only A-grade fruit ships'
    ]);
    
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
          <div className="admin-card p-6 max-w-sm w-full">
            <h3 className="admin-title text-lg mb-2">{confirmModal.title}</h3>
            <p className="form-label text-gray4 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 btn-primary bg-red! text-xs uppercase py-2.5">Delete</button>
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
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" placeholder="Product Name" required value={name} onChange={e => setName(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Product SKU (Serial Key)</label>
                <input type="text" placeholder="e.g. MNG-HMS-5KG" value={sku} onChange={e => setSku(e.target.value)} className="form-input" />
              </div>
              
              <div className="form-group">
                <label className="form-label">Store Catalog Section</label>
                <select value={section} onChange={e => setSection(e.target.value)} className="form-input">
                  <option value="Uncategorized">Uncategorized</option>
                  {storeSections.map((sec, idx) => (
                    <option key={idx} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Base Price (৳)</label>
                <input type="number" placeholder="Base Price (৳)" required value={price} onChange={e => { setPrice(e.target.value); handleDiscountPriceChange(discountPrice); }} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Discount Price (৳) — Optional</label>
                <input type="number" placeholder="Discount Price (৳)" value={discountPrice} onChange={e => handleDiscountPriceChange(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Discount Percent (%) — Optional</label>
                <input type="number" placeholder="Discount Percent (%)" value={discountPercent} onChange={e => handlePercentChange(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Charge (৳)</label>
                <input type="number" placeholder="Delivery Charge (৳)" required value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Fixed Box Weight (kg)</label>
                <input type="number" placeholder="Fixed Weight (kg) — Default 1kg" value={fixedWeight} onChange={e => setFixedWeight(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Stock Quantity (kg/boxes)</label>
                <input type="number" placeholder="Current Stock" required value={stock} onChange={e => setStock(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Max Stock Capacity (kg/boxes)</label>
                <input type="number" placeholder="Max Stock Capacity" required value={maxStock} onChange={e => setMaxStock(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Alert Threshold</label>
                <input type="number" placeholder="e.g. 10" required value={minThreshold} onChange={e => setMinThreshold(e.target.value)} className="form-input" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Variety Description</label>
              <textarea placeholder="Product Description..." required value={description} onChange={e => setDescription(e.target.value)} rows="3" className="form-input resize-none" />
            </div>

            {/* PRODUCT IMAGES SECTION */}
            <div className="admin-card p-4">
              <label className="form-label mb-2">Images (URLs)</label>
              {images.map((img, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input type="url" placeholder="Image URL" value={img} onChange={e => handleImageChange(idx, e.target.value)} className="form-input flex-1" />
                  {images.length > 1 && (
                    <button type="button" onClick={() => removeImageField(idx)} className="btn-outline text-red border-red hover:bg-red-pale px-3 text-xs">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addImageField} className="btn-secondary text-xs mt-1">
                + Add Another Image URL
              </button>
            </div>

            {/* RICH PDP DETAILS SECTION */}
            <div className="admin-card p-4 border-primary/20">
              <h4 className="ach-title text-sm mb-4 pb-2" style={{ borderBottom: '1px solid var(--gray2)' }}>✨ Rich Product Details (Optional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Badge & Specs */}
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Overlay Badge</label>
                    <input type="text" placeholder="e.g. Best Seller, Rare, Gift" value={badge} onChange={e => setBadge(e.target.value)} className="form-input" />
                  </div>
                  
                  <div>
                    <label className="form-label mb-2">Specifications Table</label>
                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="form-group">
                        <label className="form-label">Origin</label>
                        <input type="text" value={specs.origin} onChange={e => handleSpecChange('origin', e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sweetness</label>
                        <input type="text" value={specs.sweetness} onChange={e => handleSpecChange('sweetness', e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fiber</label>
                        <input type="text" value={specs.fiber} onChange={e => handleSpecChange('fiber', e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Preservation</label>
                        <input type="text" value={specs.preservation} onChange={e => handleSpecChange('preservation', e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Shelf Life</label>
                        <input type="text" value={specs.shelfLife} onChange={e => handleSpecChange('shelfLife', e.target.value)} className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Best For</label>
                        <input type="text" placeholder="e.g. Juicing, Desserts" value={specs.bestFor} onChange={e => handleSpecChange('bestFor', e.target.value)} className="form-input" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Packs & Highlights */}
                <div className="space-y-6">
                  {/* Pack Options */}
                  <div>
                    <label className="form-label mb-2">Pack Options</label>
                    {packs.map((pack, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Pack Name (e.g. 1 Dozen)" value={pack.name} onChange={e => handlePackChange(idx, 'name', e.target.value)} className="form-input w-1/2" />
                        <input type="number" placeholder="Price (৳)" value={pack.price} onChange={e => handlePackChange(idx, 'price', e.target.value)} className="form-input w-1/3" />
                        <button type="button" onClick={() => removePackField(idx)} className="btn-outline text-red border-red hover:bg-red-pale px-3 text-xs">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={addPackField} className="btn-secondary text-xs mt-1">
                      + Add Pack Option
                    </button>
                  </div>

                  {/* Highlights */}
                  <div>
                    <label className="form-label mb-2">Feature Highlights</label>
                    {highlights.map((h, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Highlight bullet point" value={h} onChange={e => handleHighlightChange(idx, e.target.value)} className="form-input flex-1" />
                        <button type="button" onClick={() => removeHighlightField(idx)} className="btn-outline text-red border-red hover:bg-red-pale px-3 text-xs">✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={addHighlightField} className="btn-secondary text-xs mt-1">
                      + Add Highlight
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MOCK STATS */}
            <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', paddingTop: '1rem', borderTop: '1px solid var(--gray2)' }}>
              <div className="form-group">
                <label className="form-label">Fake Sales Count</label>
                <input type="number" placeholder="Fake Sales" value={fakeSales} onChange={e => setFakeSales(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Fake Rating (1–5)</label>
                <input type="number" step="0.1" placeholder="Fake Rating" value={fakeRating} onChange={e => setFakeRating(e.target.value)} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Fake Reviews Count</label>
                <input type="number" placeholder="Fake Reviews" value={fakeReviewCount} onChange={e => setFakeReviewCount(e.target.value)} className="form-input" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingId && <button type="button" onClick={cancelEdit} disabled={isUploading} className="flex-1 btn-secondary text-xs uppercase py-3">Cancel Edit</button>}
              <button type="submit" disabled={isUploading} className="flex-1 btn-primary text-xs uppercase py-3 flex items-center justify-center gap-2">
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
          <span className="badge badge-orange">
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
                            {mango.images?.[0] ? (
                              <img 
                                src={mango.images[0]} 
                                alt={mango.name || 'Product'} 
                                className="w-10 h-10 object-cover rounded-md border border-gray2 shrink-0" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md border border-[var(--gray2)] bg-[var(--gray1)] flex items-center justify-center text-lg shrink-0" title="No Image">🥭</div>
                            )}
                            <div className="min-w-0">
                              <div className="at-product-name truncate max-w-[180px]">{mango.name || 'Unnamed Product'}</div>
                              <div className="at-product-var">Sales: {mango.stats?.sales || 0} sold</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-bold text-xs uppercase tracking-wider font-mono" style={{ color: 'var(--gray4)' }}>
                          {mango.sku || 'N/A'}
                        </td>
                        <td className="font-bold text-xs" style={{ color: 'var(--dark)' }}>{mango.section || 'Uncategorized'}</td>
                        <td>
                          {mango.discountPrice ? (
                            <div>
                              <span className="text-[10px] line-through font-bold block" style={{ color: 'var(--gray4)' }}>৳{mango.price}</span>
                              <span className="font-black text-sm" style={{ color: 'var(--primary)' }}>৳{mango.discountPrice}</span>
                            </div>
                          ) : (
                            <span className="font-black text-sm" style={{ color: 'var(--dark)' }}>৳{mango.price}</span>
                          )}
                        </td>
                        <td className="text-xs font-bold" style={{ color: 'var(--dark)' }}>
                          <div>⚖️ {mango.fixedWeight || 1} kg</div>
                          <div className="text-[10px] mt-0.5" style={{ color: 'var(--gray4)' }}>🚚 ৳{mango.deliveryCharge || 150}</div>
                        </td>
                        <td className={`text-xs font-black text-center ${isCritical ? 'text-red' : isLow ? 'text-gold' : ''}`} style={!isCritical && !isLow ? { color: 'var(--gray4)' } : {}}>
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
                            <span className="font-black text-xs shrink-0" style={{ color: 'var(--dark)' }}>{st}/{maxSt}</span>
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
                              className="at-action-btn danger"
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
