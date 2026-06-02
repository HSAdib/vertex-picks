import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

function generateUniqueId() {
  return Date.now().toString();
}

export default function CategoriesTab() {
  const [navTabs, setNavTabs] = useState([]);
  const [storeSections, setStoreSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab Editing
  const [newTabName, setNewTabName] = useState('');

  // Section Editing Modal
  const [editingSection, setEditingSection] = useState(null); // The original section string name
  const [newSectionName, setNewSectionName] = useState(''); // For renaming
  const [sectionProducts, setSectionProducts] = useState([]);

  // Product Quick Add/Edit
  const [editingProductId, setEditingProductId] = useState(null); // 'new' for adding, or product ID
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [prodForm, setProdForm] = useState({ name: '', price: '', discountPrice: '', description: '', images: [''] });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Nav Tabs
      const navDoc = await getDoc(doc(db, 'mangoes', 'NAVBAR_TABS'));
      if (navDoc.exists() && navDoc.data().list) {
        setNavTabs(navDoc.data().list);
      } else {
        // Fallback default
        const defaultTabs = [{ id: 'tab_default', name: 'Premium Mangoes', sections: [] }];
        await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: defaultTabs });
        setNavTabs(defaultTabs);
      }

      // 2. Fetch Store Sections
      const secDoc = await getDoc(doc(db, 'mangoes', 'STORE_SECTIONS'));
      if (secDoc.exists() && secDoc.data().list) {
        setStoreSections(secDoc.data().list);
      } else {
        setStoreSections([]);
      }

      // 3. Fetch Products
      const pSnap = await getDocs(collection(db, 'mangoes'));
      const pList = [];
      pSnap.forEach(d => {
        if (d.id !== 'STORE_SECTIONS' && d.id !== 'STORE_SETTINGS' && d.id !== 'NAVBAR_TABS') {
          pList.push({ id: d.id, ...d.data() });
        }
      });
      // Sort by order
      pList.sort((a, b) => (a.order || 0) - (b.order || 0));
      setProducts(pList);

    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Helper to open edit mode
  const openEditForm = (prod) => {
    setEditingProductId(prod.id);
    setProdForm({
      name: prod.name || '',
      price: prod.price || '',
      discountPrice: prod.discountPrice || '',
      description: prod.description || '',
      images: prod.images?.length ? prod.images : ['']
    });
  };

  // --- NAVBAR TABS MANAGEMENT ---
  const handleAddTab = async (e) => {
    e.preventDefault();
    if (!newTabName.trim()) return;
    const newTab = {
      id: generateUniqueId(),
      name: newTabName.trim(),
      sections: [],
      heroTitle: newTabName.trim(),
      heroSubtitle: 'Fresh from the orchards of Rajshahi. Hand-picked for excellence.'
    };
    const updated = [...navTabs, newTab];
    await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updated });
    setNavTabs(updated);
    setNewTabName('');
    toast.success('Navbar Tab Added');
  };

  const handleDeleteTab = async (id) => {
    if (!window.confirm("Delete this Navbar Tab?")) return;
    const updated = navTabs.filter(t => t.id !== id);
    await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updated });
    setNavTabs(updated);
    toast.success('Navbar Tab Deleted');
  };

  const toggleSectionInTab = async (tabId, sectionName) => {
    const updated = navTabs.map(t => {
      if (t.id === tabId) {
        const sections = t.sections || [];
        if (sections.includes(sectionName)) {
          return { ...t, sections: sections.filter(s => s !== sectionName) };
        } else {
          return { ...t, sections: [...sections, sectionName] };
        }
      }
      return t;
    });
    await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updated });
    setNavTabs(updated);
  };

  const updateTabHero = (tabId, field, value) => {
    const updated = navTabs.map(t => t.id === tabId ? { ...t, [field]: value } : t);
    setNavTabs(updated);
    setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updated });
  };

  // --- STORE SECTIONS MANAGEMENT ---
  const handleAddStoreSection = async () => {
    const name = window.prompt("Enter new Store Section name:");
    if (!name || storeSections.includes(name.trim())) return;
    const updated = [...storeSections, name.trim()];
    await setDoc(doc(db, 'mangoes', 'STORE_SECTIONS'), { list: updated }, { merge: true });
    setStoreSections(updated);
    toast.success('Section Added');
  };

  const openSectionModal = (sec) => {
    setEditingSection(sec);
    setNewSectionName(sec);
    const secProds = products.filter(p => p.section === sec).sort((a, b) => (a.order || 0) - (b.order || 0));
    setSectionProducts(secProds);
  };

  const closeSectionModal = () => {
    setEditingSection(null);
    setEditingProductId(null);
    setShowAddExisting(false);
    fetchData(); // Refresh to ensure global state matches what we did in modal
  };

  const handleRenameSection = async () => {
    if (!newSectionName.trim() || newSectionName === editingSection) return;
    if (storeSections.includes(newSectionName)) return toast.error("Name already exists");

    // Update STORE_SECTIONS list
    const updatedSecs = storeSections.map(s => s === editingSection ? newSectionName : s);
    await setDoc(doc(db, 'mangoes', 'STORE_SECTIONS'), { list: updatedSecs }, { merge: true });

    // Update NAVBAR_TABS references
    const updatedTabs = navTabs.map(t => ({
      ...t,
      sections: (t.sections || []).map(s => s === editingSection ? newSectionName : s)
    }));
    await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updatedTabs });

    // Update all products in this section
    for (const p of sectionProducts) {
      await updateDoc(doc(db, 'mangoes', p.id), { section: newSectionName });
    }

    setProducts(prev => prev.map(p => p.section === editingSection ? { ...p, section: newSectionName } : p));
    setStoreSections(updatedSecs);
    setNavTabs(updatedTabs);
    setEditingSection(newSectionName);
    toast.success("Section Renamed");
  };

  // --- PRODUCT REORDERING ---
  const moveProduct = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === sectionProducts.length - 1) return;

    const newProds = [...sectionProducts];
    const temp = newProds[index];
    newProds[index] = newProds[index + direction];
    newProds[index + direction] = temp;

    // Update orders
    const batchPromises = newProds.map((p, i) => {
      p.order = i;
      return updateDoc(doc(db, 'mangoes', p.id), { order: i });
    });

    setSectionProducts(newProds);
    await Promise.all(batchPromises);
    toast.success("Order Saved");
  };

  const removeFromSection = async (prodId) => {
    try {
      await updateDoc(doc(db, 'mangoes', prodId), { section: 'Uncategorized' });
      setSectionProducts(sectionProducts.filter(p => p.id !== prodId));
      // Fix: Update main products list so it instantly appears in "Add Existing" view
      setProducts(prev => prev.map(p => p.id === prodId ? { ...p, section: 'Uncategorized' } : p));
      toast.success("Removed from section");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const addExistingProductToSection = async (prod) => {
    try {
      await updateDoc(doc(db, 'mangoes', prod.id), { section: editingSection, order: sectionProducts.length });
      setSectionProducts([...sectionProducts, { ...prod, section: editingSection, order: sectionProducts.length }]);
      // Fix: Update main products list so it instantly disappears from "Add Existing" view
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, section: editingSection } : p));
      toast.success("Added to section");
    } catch {
      toast.error("Failed to add");
    }
  };

  // --- PRODUCT QUICK ADD/EDIT ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const isNew = editingProductId === 'new';

    const prodData = {
      name: prodForm.name,
      price: Number(prodForm.price),
      discountPrice: prodForm.discountPrice ? Number(prodForm.discountPrice) : '',
      description: prodForm.description,
      images: prodForm.images.filter(i => i.trim() !== ''),
      section: editingSection,
      order: isNew ? sectionProducts.length : (sectionProducts.find(p => p.id === editingProductId)?.order || 0)
    };

    try {
      if (isNew) {
        const newRef = doc(collection(db, 'mangoes'));
        await setDoc(newRef, prodData);
        const newProductWithId = { id: newRef.id, ...prodData };
        setSectionProducts([...sectionProducts, newProductWithId]);
        setProducts([...products, newProductWithId]);
        toast.success("Product Added");
      } else {
        await updateDoc(doc(db, 'mangoes', editingProductId), prodData);
        setSectionProducts(sectionProducts.map(p => p.id === editingProductId ? { id: p.id, ...prodData } : p));
        setProducts(products.map(p => p.id === editingProductId ? { id: p.id, ...prodData } : p));
        toast.success("Product Updated");
      }
      setEditingProductId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save product");
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-gray-500 uppercase tracking-widest text-sm animate-pulse">Loading Categories...</div>;

  return (
    <div className="space-y-6">
      
      {/* NAVBAR TABS MANAGER */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">🌐 Top Navigation Tabs</h3>
            <span className="ach-sub">Map storefront header columns and varieties</span>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleAddTab} className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="New Tab Name (e.g., Premium Varieties)"
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded font-bold text-sm outline-none focus:border-primary shadow-sm"
            />
            <button type="submit" className="bg-black text-white font-black px-6 py-3 rounded uppercase text-xs tracking-wider hover:bg-primary transition-all shadow-md shrink-0">
              + Add Tab
            </button>
          </form>

          <div className="space-y-4">
            {navTabs.map(tab => (
              <div key={tab.id} className="border border-gray-200 rounded-brand p-5 bg-gray-50/50">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <h3 className="font-black text-base text-gray-800">{tab.name}</h3>
                  <button onClick={() => handleDeleteTab(tab.id)} className="text-red font-black text-xs uppercase hover:underline">
                    Delete Tab ✕
                  </button>
                </div>

                {/* HERO TEXT EDITING */}
                <div className="mb-4 p-4 bg-white border border-gray2 rounded-brand shadow-sm space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Header Display Title</label>
                    <input
                      type="text"
                      value={tab.heroTitle ?? tab.name}
                      onChange={e => updateTabHero(tab.id, 'heroTitle', e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded font-black text-gray-800 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray4 mb-1">Header Display Subtitle</label>
                    <textarea
                      rows="2"
                      value={tab.heroSubtitle ?? ''}
                      onChange={e => updateTabHero(tab.id, 'heroSubtitle', e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-500 text-xs outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>

                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray4">Assigned Storefront Sections</div>
                <div className="flex flex-wrap gap-2">
                  {storeSections.map(sec => {
                    const isAssigned = (tab.sections || []).includes(sec);
                    return (
                      <button
                        key={sec}
                        onClick={() => toggleSectionInTab(tab.id, sec)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${isAssigned
                          ? 'bg-primary border-primary text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-primary hover:text-primary'
                          }`}
                      >
                        {isAssigned ? '✓ ' : '+ '}{sec}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STORE SECTIONS MANAGER */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">📁 Storefront Sections</h3>
            <span className="ach-sub">Manage active shop catalogs and catalog cards</span>
          </div>
          <button onClick={handleAddStoreSection} className="btn-primary text-xs uppercase py-1.5 px-3 shadow">
            + Add Section
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {storeSections.map(sec => {
              const secProdsCount = products.filter(p => p.section === sec).length;
              return (
                <div 
                  key={sec} 
                  onClick={() => openSectionModal(sec)} 
                  className="bg-white border-2 border-gray-100 hover:border-primary p-5 rounded-brand shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-95 flex justify-between items-center group"
                >
                  <div>
                    <span className="font-black text-sm text-gray-800 group-hover:text-primary transition-colors">{sec}</span>
                    <p className="text-[10px] text-gray4 font-bold mt-0.5">{secProdsCount} Products listed</p>
                  </div>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-black uppercase px-2 py-1 rounded tracking-wider shrink-0 group-hover:bg-primary-pale group-hover:text-primary transition-colors">
                    Edit →
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FLOATING SECTION EDITOR MODAL */}
      <AnimatePresence>
        {editingSection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeSectionModal}
              className="absolute inset-0 bg-dark/60"
            ></motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-brand shadow-2xl flex flex-col overflow-hidden"
            >
              {/* MODAL HEADER */}
              <div className="p-6 border-b border-gray2 flex justify-between items-center bg-gray1 flex-wrap gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    className="font-black text-xl bg-transparent outline-none border-b-2 border-transparent focus:border-primary transition-colors w-full max-w-xs"
                  />
                  {newSectionName !== editingSection && (
                    <button onClick={handleRenameSection} className="btn-primary text-xs uppercase px-3 py-1.5 shadow rounded-brand-sm">
                      Rename
                    </button>
                  )}
                </div>
                <button onClick={closeSectionModal} className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 hover:bg-red-100 hover:text-red transition-all">
                  ✕
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 overflow-y-auto flex-1 bg-gray1 flex flex-col min-h-[60vh]">

                {/* 1. ADD EXISTING PRODUCT VIEW */}
                {showAddExisting && !editingProductId && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-base uppercase tracking-tight text-gray-800">Add Product to {editingSection}</h3>
                      <button onClick={() => setShowAddExisting(false)} className="text-gray4 text-xs font-black uppercase hover:text-black">
                        ← Back to List
                      </button>
                    </div>

                    <button
                      onClick={() => { setShowAddExisting(false); setEditingProductId('new'); setProdForm({ name: '', price: '', discountPrice: '', description: '', images: [''] }); }}
                      className="w-full bg-black text-white font-black py-3 rounded uppercase hover:bg-primary transition-all mb-6 text-xs tracking-widest shadow-md"
                    >
                      + Create Brand New Product
                    </button>

                    <h4 className="font-black text-[10px] text-gray4 uppercase tracking-widest mb-3">Select existing uncategorized/other product:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {products.filter(p => p.section !== editingSection).map(prod => (
                        <div key={prod.id} className="bg-white rounded-brand shadow-sm border border-gray2 overflow-hidden flex flex-col relative group hover:border-primary/50 transition-colors">
                          <div
                            className="h-28 w-full bg-gray-100 relative cursor-pointer"
                            onClick={() => { setShowAddExisting(false); openEditForm(prod); }}
                          >
                            <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                          </div>

                          <div className="p-3 flex-1 flex flex-col">
                            <h4 className="font-black text-xs text-gray-800 line-clamp-2 leading-tight">{prod.name}</h4>
                            <p className="font-extrabold text-primary text-xs mt-1">৳{prod.discountPrice || prod.price}</p>
                            <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase">Section: {prod.section || 'Uncategorized'}</span>
                          </div>

                          {/* Floating Add Button */}
                          <button
                            onClick={() => addExistingProductToSection(prod)}
                            className="absolute bottom-2 right-2 w-7 h-7 bg-black text-white rounded-full flex items-center justify-center shadow hover:bg-primary transition-all font-black text-sm pb-0.5 outline-none"
                            title="Add to Section"
                          >
                            +
                          </button>
                        </div>
                      ))}
                      {products.filter(p => p.section !== editingSection).length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-400 font-bold text-xs">No other products available to add.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. PRODUCT FORM VIEW (Create/Edit) */}
                {editingProductId && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="font-black text-base uppercase tracking-tight text-gray-800">
                        {editingProductId === 'new' ? 'Create New Product' : 'Edit Product Details'}
                      </h3>
                      <button onClick={() => setEditingProductId(null)} className="text-gray4 text-xs font-black uppercase hover:text-black">
                        ← Back to List
                      </button>
                    </div>

                    <form onSubmit={handleSaveProduct} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Product Name</label>
                        <input type="text" placeholder="Product Name" required value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} className="w-full p-3 bg-white border border-gray2 shadow-sm rounded font-bold text-sm outline-none focus:border-primary" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Base Price (৳)</label>
                          <input type="number" placeholder="Base Price (৳)" required value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} className="w-full p-3 bg-white border border-gray2 shadow-sm rounded font-bold text-sm outline-none focus:border-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Discount Price (৳) (Optional)</label>
                          <input type="number" placeholder="Discount Price (৳) (Optional)" value={prodForm.discountPrice} onChange={e => setProdForm({ ...prodForm, discountPrice: e.target.value })} className="w-full p-3 bg-white border border-gray2 shadow-sm rounded font-bold text-sm outline-none focus:border-primary" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Description</label>
                        <textarea placeholder="Product Description..." required rows="4" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className="w-full p-3 bg-white border border-gray2 shadow-sm rounded font-bold text-xs outline-none focus:border-primary resize-none"></textarea>
                      </div>

                      <div className="bg-white p-5 rounded-brand border border-gray2 shadow-sm">
                        <label className="block font-black text-[10px] uppercase tracking-widest text-gray4 mb-2">Product Images (URLs)</label>
                        <div className="space-y-2">
                          {prodForm.images.map((img, idx) => (
                            <input key={idx} type="url" placeholder="https://..." value={img} onChange={e => {
                              const newImgs = [...prodForm.images];
                              newImgs[idx] = e.target.value;
                              setProdForm({ ...prodForm, images: newImgs });
                            }} className="w-full p-2.5 bg-gray1 border border-gray-200 rounded font-bold text-xs outline-none focus:border-primary" />
                          ))}
                        </div>
                        <button type="button" onClick={() => setProdForm({ ...prodForm, images: [...prodForm.images, ''] })} className="mt-2 text-primary font-black text-[10px] uppercase hover:text-primary-light transition-colors bg-transparent border-none">
                          + Add another image URL
                        </button>
                      </div>

                      <button type="submit" className="w-full btn-primary font-black py-3.5 rounded uppercase text-xs tracking-wider shadow-md hover:shadow-lg transition-all mt-4">
                        Save Product Data
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. GRID LIST VIEW */}
                {!editingProductId && !showAddExisting && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">

                    {/* ADD NEW SQUARED BOX */}
                    <div
                      onClick={() => setShowAddExisting(true)}
                      className="bg-white border-2 border-dashed border-gray3 rounded-brand flex flex-col items-center justify-center text-gray4 hover:text-primary hover:border-primary hover:bg-primary-pale cursor-pointer aspect-square transition-all shadow-sm"
                    >
                      <span className="text-xl mb-1.5">➕</span>
                      <span className="font-black text-[9px] uppercase tracking-widest text-center px-2">Add Product</span>
                    </div>

                    {/* PRODUCTS IN THIS SECTION */}
                    {sectionProducts.map((prod, idx) => (
                      <div key={prod.id} className="bg-white rounded-brand shadow-sm border border-gray2 overflow-hidden flex flex-col relative group">

                        {/* Remove from section button */}
                        <button
                          onClick={() => removeFromSection(prod.id)}
                          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity at-action-btn danger text-red font-black"
                          title="Remove from Section"
                        >
                          ✕
                        </button>

                        {/* Order controls */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow border border-gray-200 text-gray-600 font-black text-xs hover:bg-gray-100 disabled:opacity-50">↑</button>
                          <button onClick={() => moveProduct(idx, 1)} disabled={idx === sectionProducts.length - 1} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow border border-gray-200 text-gray-600 font-black text-xs hover:bg-gray-100 disabled:opacity-50">↓</button>
                        </div>

                        {/* Clickable Image to Edit */}
                        <div
                          className="h-28 w-full bg-gray1 relative cursor-pointer"
                          onClick={() => openEditForm(prod)}
                        >
                          <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" alt="" />
                          <div className="absolute inset-0 bg-dark/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="bg-dark/70 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded tracking-widest">Edit</span>
                          </div>
                        </div>

                        <div className="p-3 flex-1 flex flex-col">
                          <h4 className="font-black text-xs text-dark line-clamp-2 leading-tight min-h-[32px]">{prod.name}</h4>
                          <p className="font-extrabold text-primary text-xs mt-1">৳{prod.discountPrice || prod.price}</p>
                          <div className="mt-auto pt-2">
                            <button
                              onClick={() => openEditForm(prod)}
                              className="w-full bg-gray1 text-dark py-1.5 rounded font-black text-[9px] uppercase tracking-widest hover:bg-gray2 transition-colors border border-gray2"
                            >
                              Edit Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}