import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
    fetchData();
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
      id: Date.now().toString(),
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
    } catch (err) {
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
    } catch (err) {
      toast.error("Failed to add");
    }
  };

  // --- PRODUCT QUICK ADD/EDIT ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const isNew = editingProductId === 'new';

    const prodData = {
      name: prodForm.name,
      price: prodForm.price,
      discountPrice: prodForm.discountPrice || '',
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

  if (loading) return <div className="p-10 text-center font-bold text-gray-500">Loading Categories...</div>;

  return (
    <div className="space-y-8">
      {/* NAVBAR TABS MANAGER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6 flex items-center gap-2">
          🌐 Top Navigation Tabs
        </h2>

        <form onSubmit={handleAddTab} className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="New Tab Name (e.g., Premium Mangoes)"
            value={newTabName}
            onChange={e => setNewTabName(e.target.value)}
            className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold outline-none focus:border-orange-500"
          />
          <button type="submit" className="bg-black text-white font-black px-6 py-3 rounded-lg uppercase hover:bg-orange-500 transition-colors">
            + Add Tab
          </button>
        </form>

        <div className="space-y-4">
          {navTabs.map(tab => (
            <div key={tab.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-lg text-gray-800">{tab.name}</h3>
                <button onClick={() => handleDeleteTab(tab.id)} className="text-red-500 font-bold text-sm uppercase hover:underline">Delete Tab</button>
              </div>

              {/* HERO TEXT EDITING */}
              <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Header Title</label>
                  <input
                    type="text"
                    value={tab.heroTitle ?? tab.name}
                    onChange={e => updateTabHero(tab.id, 'heroTitle', e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-100 rounded font-black text-gray-800 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Header Subtitle</label>
                  <textarea
                    rows="2"
                    value={tab.heroSubtitle ?? ''}
                    onChange={e => updateTabHero(tab.id, 'heroSubtitle', e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-100 rounded font-bold text-gray-500 text-xs outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="mb-2 text-xs font-black uppercase tracking-widest text-gray-500">Assigned Sections</div>
              <div className="flex flex-wrap gap-2">
                {storeSections.map(sec => {
                  const isAssigned = (tab.sections || []).includes(sec);
                  return (
                    <button
                      key={sec}
                      onClick={() => toggleSectionInTab(tab.id, sec)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${isAssigned
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
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

      {/* STORE SECTIONS MANAGER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black uppercase text-xl flex items-center gap-2">
            📦 Store Sections
          </h2>
          <button onClick={handleAddStoreSection} className="bg-gray-100 text-black font-black px-4 py-2 rounded uppercase text-xs hover:bg-gray-200 transition-colors">
            + Add Section
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {storeSections.map(sec => (
            <div key={sec} onClick={() => openSectionModal(sec)} className="bg-white border-2 border-gray-100 hover:border-orange-400 p-5 rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md flex justify-between items-center group">
              <span className="font-black text-gray-800 group-hover:text-orange-500 transition-colors">{sec}</span>
              <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded">Edit →</span>
            </div>
          ))}
        </div>
      </div>

      {/* FLOATING SECTION EDITOR MODAL */}
      <AnimatePresence>
        {editingSection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeSectionModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* MODAL HEADER */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4 flex-1">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    className="font-black text-2xl bg-transparent outline-none border-b-2 border-transparent focus:border-orange-500 transition-colors w-1/2"
                  />
                  {newSectionName !== editingSection && (
                    <button onClick={handleRenameSection} className="bg-black text-white text-xs font-black uppercase px-3 py-1 rounded">Save Name</button>
                  )}
                </div>
                <button onClick={closeSectionModal} className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors">X</button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 overflow-y-auto flex-1 bg-gray-100 flex flex-col min-h-[60vh]">

                {/* 1. ADD EXISTING PRODUCT VIEW */}
                {showAddExisting && !editingProductId && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-xl uppercase tracking-tight text-gray-800">Add Product to {editingSection}</h3>
                      <button onClick={() => setShowAddExisting(false)} className="text-gray-500 text-sm font-bold hover:text-black">Cancel</button>
                    </div>

                    <button
                      onClick={() => { setShowAddExisting(false); setEditingProductId('new'); setProdForm({ name: '', price: '', discountPrice: '', description: '', images: [''] }); }}
                      className="w-full bg-black text-white font-black py-4 rounded-xl uppercase hover:bg-orange-500 transition-colors mb-8 shadow-md"
                    >
                      + Create Brand New Product
                    </button>

                    <h4 className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-4">Or select an existing product:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {products.filter(p => p.section !== editingSection).map(prod => (
                        <div key={prod.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative group hover:border-orange-500 transition-colors">
                          <div
                            className="h-32 w-full bg-gray-100 relative cursor-pointer"
                            onClick={() => { setShowAddExisting(false); openEditForm(prod); }}
                          >
                            <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                          </div>

                          <div className="p-3 flex-1 flex flex-col">
                            <h4 className="font-black text-sm text-gray-800 line-clamp-2">{prod.name}</h4>
                            <p className="font-bold text-gray-500 text-xs mt-1">৳{prod.discountPrice || prod.price}</p>
                            <span className="text-[10px] text-gray-400 font-bold mt-1">In: {prod.section || 'Uncategorized'}</span>
                          </div>

                          {/* Floating Plus Icon Bottom Right */}
                          <button
                            onClick={() => addExistingProductToSection(prod)}
                            className="absolute bottom-2 right-2 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center shadow hover:bg-orange-500 hover:scale-110 transition-all font-black text-lg pb-0.5"
                            title="Add to Section"
                          >
                            +
                          </button>
                        </div>
                      ))}
                      {products.filter(p => p.section !== editingSection).length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-400 font-bold text-sm">No other products available to add.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. PRODUCT FORM VIEW (Create/Edit) */}
                {editingProductId && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-xl uppercase tracking-tight text-gray-800">{editingProductId === 'new' ? 'Create New Product' : 'Edit Product'}</h3>
                      <button onClick={() => setEditingProductId(null)} className="text-gray-500 text-sm font-bold hover:text-black">Cancel</button>
                    </div>

                    <form onSubmit={handleSaveProduct} className="space-y-5">
                      <input type="text" placeholder="Product Name" required value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} className="w-full p-4 bg-white border border-gray-200 shadow-sm rounded-xl font-bold outline-none focus:border-orange-500" />
                      <div className="flex flex-col md:flex-row gap-5">
                        <input type="number" placeholder="Base Price (৳)" required value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} className="flex-1 p-4 bg-white border border-gray-200 shadow-sm rounded-xl font-bold outline-none focus:border-orange-500" />
                        <input type="number" placeholder="Discount Price (৳) (Optional)" value={prodForm.discountPrice} onChange={e => setProdForm({ ...prodForm, discountPrice: e.target.value })} className="flex-1 p-4 bg-white border border-gray-200 shadow-sm rounded-xl font-bold outline-none focus:border-orange-500" />
                      </div>
                      <textarea placeholder="Product Description..." required rows="4" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className="w-full p-4 bg-white border border-gray-200 shadow-sm rounded-xl font-bold outline-none focus:border-orange-500"></textarea>

                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="block font-black text-xs uppercase tracking-widest text-gray-500 mb-3">Product Images (URLs)</label>
                        <div className="space-y-3">
                          {prodForm.images.map((img, idx) => (
                            <input key={idx} type="url" placeholder="https://..." value={img} onChange={e => {
                              const newImgs = [...prodForm.images];
                              newImgs[idx] = e.target.value;
                              setProdForm({ ...prodForm, images: newImgs });
                            }} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm outline-none focus:border-orange-500" />
                          ))}
                        </div>
                        <button type="button" onClick={() => setProdForm({ ...prodForm, images: [...prodForm.images, ''] })} className="mt-3 text-orange-500 font-black text-xs uppercase hover:text-orange-600 transition-colors">+ Add another image URL</button>
                      </div>

                      <button type="submit" className="w-full bg-black text-white font-black py-4 rounded-xl uppercase text-lg shadow-md hover:bg-orange-500 hover:shadow-lg transition-all mt-4">
                        Save Product
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
                      className="bg-white border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-50 cursor-pointer aspect-square transition-all shadow-sm"
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                      <span className="font-black text-[10px] uppercase tracking-widest text-center px-2">Add Product</span>
                    </div>

                    {/* PRODUCTS IN THIS SECTION */}
                    {sectionProducts.map((prod, idx) => (
                      <div key={prod.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative group">

                        {/* Remove from section button */}
                        <button
                          onClick={() => removeFromSection(prod.id)}
                          className="absolute top-2 right-2 z-10 bg-white shadow border border-red-100 text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all text-xs font-black"
                          title="Remove from Section"
                        >
                          ×
                        </button>

                        {/* Order controls */}
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow border border-gray-200 text-gray-600 font-black text-xs hover:bg-gray-100 disabled:opacity-50">↑</button>
                          <button onClick={() => moveProduct(idx, 1)} disabled={idx === sectionProducts.length - 1} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow border border-gray-200 text-gray-600 font-black text-xs hover:bg-gray-100 disabled:opacity-50">↓</button>
                        </div>

                        {/* Clickable Image to Edit */}
                        <div
                          className="h-32 w-full bg-gray-100 relative cursor-pointer"
                          onClick={() => openEditForm(prod)}
                        >
                          <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" alt="" />
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="bg-black/70 text-white text-[10px] uppercase font-black px-2 py-1 rounded tracking-widest">Edit</span>
                          </div>
                        </div>

                        <div className="p-3 flex-1 flex flex-col">
                          <h4 className="font-black text-sm text-gray-800 line-clamp-2 leading-tight">{prod.name}</h4>
                          <p className="font-bold text-gray-500 text-xs mt-1">৳{prod.discountPrice || prod.price}</p>
                          <div className="mt-auto pt-3">
                            <button
                              onClick={() => openEditForm(prod)}
                              className="w-full bg-gray-100 text-gray-700 py-1.5 rounded font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors"
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