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
  const [editingSection, setEditingSection] = useState(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionProducts, setSectionProducts] = useState([]);

  // Product Quick Add/Edit
  const [editingProductId, setEditingProductId] = useState(null);
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
    fetchData();
  };

  const handleRenameSection = async () => {
    if (!newSectionName.trim() || newSectionName === editingSection) return;
    if (storeSections.includes(newSectionName)) return toast.error("Name already exists");

    const updatedSecs = storeSections.map(s => s === editingSection ? newSectionName : s);
    await setDoc(doc(db, 'mangoes', 'STORE_SECTIONS'), { list: updatedSecs }, { merge: true });

    const updatedTabs = navTabs.map(t => ({
      ...t,
      sections: (t.sections || []).map(s => s === editingSection ? newSectionName : s)
    }));
    await setDoc(doc(db, 'mangoes', 'NAVBAR_TABS'), { list: updatedTabs });

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

  if (loading) return <div className="p-10 text-center font-bold text-gray-400 uppercase tracking-widest text-sm animate-pulse">Loading Categories...</div>;

  return (
    <div className="space-y-10">

      {/* NAVBAR TABS MANAGER */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">🌐 Top Navigation Tabs</h3>
            <span className="ach-sub">Map storefront header columns and varieties</span>
          </div>
        </div>

        <div style={{background:'var(--gray1)',padding:'1.5rem 2rem',borderRadius:14}}>
          <form onSubmit={handleAddTab} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8 w-full" style={{background:'#fff',padding:'1.25rem 1.5rem',borderRadius:14,border:'1.5px solid var(--gray2)',boxShadow:'var(--shadow-sm)'}}>
            <input
              type="text"
              placeholder="New Tab Name (e.g., Premium Varieties)"
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              className="form-input flex-1"
            />
            <button type="submit" className="btn-primary shrink-0 w-full sm:w-auto" style={{justifyContent:'center'}}>
              + Add Tab
            </button>
          </form>

          <div className="space-y-8">
            {navTabs.map(tab => (
              <div key={tab.id} style={{background:'#fff',padding:'2rem',borderRadius:14,boxShadow:'var(--shadow-sm)',border:'1.5px solid var(--gray2)',display:'flex',flexDirection:'column',overflow:'visible',position:'relative'}}>

                {/* ENLARGED & ALIGNED HEADER */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',borderBottom:'2px solid var(--gray2)',paddingBottom:'1.25rem',marginBottom:'1.25rem'}}>
                  <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.75rem',fontWeight:900,color:'var(--dark)'}}>{tab.name}</h3>
                  <button
                    onClick={() => handleDeleteTab(tab.id)}
                    className="order-action-btn"
                    style={{background:'var(--red-pale)',color:'var(--red)',padding:'.6rem 1rem',display:'flex',alignItems:'center',gap:'.4rem'}}
                  >
                    Delete Tab <span style={{fontSize:'1rem'}}>✕</span>
                  </button>
                </div>

                {/* HERO TEXT EDITING */}
                <div style={{background:'var(--gray1)',padding:'1.25rem 1.5rem',borderRadius:12,border:'1.5px solid var(--gray2)',marginTop:'.5rem',display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                  <div className="form-group w-full">
                    <label className="form-label">Header Display Title</label>
                    <input
                      type="text"
                      value={tab.heroTitle ?? tab.name}
                      onChange={e => updateTabHero(tab.id, 'heroTitle', e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Header Display Subtitle</label>
                    <textarea
                      rows="3"
                      value={tab.heroSubtitle ?? ''}
                      onChange={e => updateTabHero(tab.id, 'heroSubtitle', e.target.value)}
                      className="form-input"
                      style={{resize:'none'}}
                    />
                  </div>
                </div>

                {/* ASSIGNED SECTIONS */}
                <div style={{marginTop:'1.5rem',paddingTop:'1.25rem',borderTop:'2px solid var(--gray2)',display:'flex',flexDirection:'column',gap:'.75rem'}}>
                  <div style={{fontSize:'.68rem',fontWeight:900,textTransform:'uppercase',letterSpacing:'.12em',color:'var(--gray4)'}}>Assigned Storefront Sections</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'.5rem'}}>
                    {storeSections.map(sec => {
                      const isAssigned = (tab.sections || []).includes(sec);
                      return (
                        <button
                          key={sec}
                          onClick={() => toggleSectionInTab(tab.id, sec)}
                          style={{
                            padding:'.5rem 1rem',
                            borderRadius:100,
                            fontSize:'.82rem',
                            fontWeight:700,
                            border:'1.5px solid',
                            cursor:'pointer',
                            transition:'all .15s',
                            background: isAssigned ? 'var(--primary)' : '#fff',
                            borderColor: isAssigned ? 'var(--primary)' : 'var(--gray2)',
                            color: isAssigned ? '#fff' : 'var(--gray4)'
                          }}
                        >
                          {isAssigned ? '✓ ' : '+ '}{sec}
                        </button>
                      );
                    })}
                  </div>
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
          <button onClick={handleAddStoreSection} className="add-btn">
            + Add Section
          </button>
        </div>

        <div style={{padding:'1.5rem 2rem',background:'var(--gray1)'}}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {storeSections.map(sec => {
              const secProdsCount = products.filter(p => p.section === sec).length;
              return (
                <div
                  key={sec}
                  onClick={() => openSectionModal(sec)}
                  style={{background:'#fff',border:'1.5px solid var(--gray2)',padding:'1.25rem 1.5rem',borderRadius:14,boxShadow:'var(--shadow-sm)',cursor:'pointer',transition:'all .2s',display:'flex',flexDirection:'column',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',minHeight:100}}
                  className="hover:border-[var(--primary)] hover:shadow-md hover:-translate-y-1 group"
                >
                  <div style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <span style={{fontWeight:900,fontSize:'1.1rem',color:'var(--dark)',lineHeight:1.2,paddingRight:'0.5rem'}} className="group-hover:text-[var(--primary)] transition-colors">{sec}</span>
                    <span style={{background:'var(--gray1)',color:'var(--gray4)',fontSize:'.68rem',fontWeight:900,textTransform:'uppercase',padding:'.25rem .65rem',borderRadius:100,letterSpacing:'.08em',flexShrink:0}} className="group-hover:bg-[var(--primary-pale)] group-hover:text-[var(--primary)] transition-colors">
                      Edit →
                    </span>
                  </div>
                  <p style={{fontSize:'.72rem',color:'var(--gray4)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>{secProdsCount} Products listed</p>
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
              className="absolute inset-0 bg-gray-900/60"
            ></motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{position:'relative',width:'100%',maxWidth:'56rem',maxHeight:'90vh',background:'#fff',borderRadius:14,boxShadow:'var(--shadow-lg)',display:'flex',flexDirection:'column',overflow:'hidden'}}
            >
              {/* MODAL HEADER */}
              <div style={{padding:'1.25rem 1.5rem',borderBottom:'1.5px solid var(--gray2)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--gray1)',flexWrap:'wrap',gap:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'.75rem',flex:1,minWidth:200}}>
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    className="form-input w-full"
                  />
                  {newSectionName !== editingSection && (
                    <button onClick={handleRenameSection} className="btn-primary shrink-0" style={{fontSize:'.75rem',padding:'.5rem 1rem',whiteSpace:'nowrap'}}>
                      Rename
                    </button>
                  )}
                </div>
                <button onClick={closeSectionModal} style={{width:44,height:44,background:'#fff',border:'1.5px solid var(--gray2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'var(--gray4)',cursor:'pointer',flexShrink:0}} className="hover:bg-[var(--red-pale)] hover:text-[var(--red)] hover:border-[var(--red)]/20 transition-all">
                  ✕
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 overflow-y-auto flex-1 bg-white flex flex-col min-h-[60vh]">

                {/* 1. ADD EXISTING PRODUCT VIEW */}
                {showAddExisting && !editingProductId && (
                  <div className="flex-1 flex flex-col">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                      <h3 style={{fontFamily:'var(--ff-display)',fontWeight:900,fontSize:'1.1rem',textTransform:'uppercase',color:'var(--dark)'}}>Add Product to {editingSection}</h3>
                      <button onClick={() => setShowAddExisting(false)} style={{fontSize:'.72rem',fontWeight:900,textTransform:'uppercase',color:'var(--gray4)',background:'var(--gray1)',border:'1.5px solid var(--gray2)',borderRadius:100,padding:'.35rem .85rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'.4rem'}}>
                        <span>←</span> Back to List
                      </button>
                    </div>

                    <button
                      onClick={() => { setShowAddExisting(false); setEditingProductId('new'); setProdForm({ name: '', price: '', discountPrice: '', description: '', images: [''] }); }}
                      className="btn-primary w-full mb-6" style={{justifyContent:'center',fontSize:'.85rem',padding:'.875rem'}}
                    >
                      + Create Brand New Product
                    </button>

                    <h4 className="font-black text-xs text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-3">Select existing uncategorized/other product:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                      {products.filter(p => p.section !== editingSection).map(prod => (
                        <div key={prod.id} style={{background:'#fff',borderRadius:14,boxShadow:'var(--shadow-sm)',border:'1.5px solid var(--gray2)',overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}} className="group hover:border-[var(--primary)]/50 transition-colors">
                          <div
                            style={{height:144,width:'100%',background:'var(--gray1)',position:'relative',cursor:'pointer'}}
                            onClick={() => { setShowAddExisting(false); openEditForm(prod); }}
                          >
                            {prod.images?.[0] ? (
                              <img src={prod.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl group-hover:scale-105 transition-transform duration-300" title="No Image">🥭</div>
                            )}
                          </div>

                          <div style={{padding:'1rem',flex:1,display:'flex',flexDirection:'column'}}>
                            <h4 style={{fontWeight:900,fontSize:'.82rem',color:'var(--dark)',lineHeight:1.35,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{prod.name}</h4>
                            <p style={{fontWeight:900,color:'var(--primary)',fontSize:'.82rem',marginTop:'.5rem'}}>৳{prod.discountPrice || prod.price}</p>
                            <span style={{fontSize:'.65rem',color:'var(--gray4)',fontWeight:700,marginTop:'.6rem',textTransform:'uppercase',letterSpacing:'.06em',background:'var(--gray1)',padding:'.2rem .5rem',borderRadius:100}}>Section: {prod.section || 'Uncategorized'}</span>
                          </div>

                          <button
                            onClick={() => addExistingProductToSection(prod)}
                            style={{position:'absolute',bottom:'1rem',right:'1rem',width:38,height:38,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.25rem',background:'var(--primary)',color:'#fff',border:'none',cursor:'pointer',boxShadow:'0 4px 12px rgba(232,84,10,.3)',transition:'transform .15s'}}
                            className="hover:scale-110"
                            title="Add to Section"
                          >
                            +
                          </button>
                        </div>
                      ))}
                      {products.filter(p => p.section !== editingSection).length === 0 && (
                        <div className="col-span-full text-center py-12 rounded-[14px] border-2 border-dashed" style={{background:'var(--gray1)',borderColor:'var(--gray2)',color:'var(--gray4)',fontWeight:700,fontSize:'.85rem'}}>
                          No other products available to add.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. PRODUCT FORM VIEW (Create/Edit) */}
                {editingProductId && (
                  <div style={{flex:1,display:'flex',flexDirection:'column',maxWidth:'48rem',margin:'0 auto',width:'100%'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
                      <h3 style={{fontFamily:'var(--ff-display)',fontWeight:900,fontSize:'1.1rem',textTransform:'uppercase',color:'var(--dark)'}}>
                        {editingProductId === 'new' ? 'Create New Product' : 'Edit Product Details'}
                      </h3>
                      <button onClick={() => setEditingProductId(null)} style={{fontSize:'.72rem',fontWeight:900,textTransform:'uppercase',color:'var(--gray4)',background:'var(--gray1)',border:'1.5px solid var(--gray2)',borderRadius:100,padding:'.35rem .85rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'.4rem'}}>
                        <span>←</span> Back to List
                      </button>
                    </div>

                    <form onSubmit={handleSaveProduct} className="space-y-5" style={{background:'var(--gray1)',padding:'1.5rem 2rem',borderRadius:14,border:'1.5px solid var(--gray2)'}}>
                      <div className="form-group w-full">
                        <label className="form-label">Product Name</label>
                        <input type="text" placeholder="Product Name" required value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} className="form-input" />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-5">
                        <div style={{flex:1}} className="form-group w-full">
                          <label className="form-label">Base Price (৳)</label>
                          <input type="number" placeholder="Base Price (৳)" required value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} className="form-input" />
                        </div>
                        <div style={{flex:1}} className="form-group w-full">
                          <label className="form-label">Discount Price (৳) (Optional)</label>
                          <input type="number" placeholder="Discount Price (৳) (Optional)" value={prodForm.discountPrice} onChange={e => setProdForm({ ...prodForm, discountPrice: e.target.value })} className="form-input" />
                        </div>
                      </div>

                      <div className="form-group w-full">
                        <label className="form-label">Description</label>
                        <textarea placeholder="Product Description..." required rows="4" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className="form-input" style={{resize:'none'}}></textarea>
                      </div>

                      <div style={{background:'#fff',padding:'1.25rem 1.5rem',borderRadius:12,border:'1.5px solid var(--gray2)'}} className="form-group w-full">
                        <label className="form-label" style={{marginBottom:'1rem',borderBottom:'1px solid var(--gray2)',paddingBottom:'.75rem'}}>Product Images (URLs)</label>
                        <div className="space-y-3">
                          {prodForm.images.map((img, idx) => (
                            <input key={idx} type="url" placeholder="https://..." value={img} onChange={e => {
                              const newImgs = [...prodForm.images];
                              newImgs[idx] = e.target.value;
                              setProdForm({ ...prodForm, images: newImgs });
                            }} className="form-input" />
                          ))}
                        </div>
                        <button type="button" onClick={() => setProdForm({ ...prodForm, images: [...prodForm.images, ''] })} className="btn-secondary mt-4" style={{fontSize:'.78rem',padding:'.4rem .85rem'}}>
                          <span style={{fontSize:'1.1rem'}}>+</span> Add another image URL
                        </button>
                      </div>

                      <button type="submit" className="btn-primary w-full" style={{justifyContent:'center',fontSize:'.9rem',padding:'1rem',marginTop:'1rem'}}>
                        Save Product Data
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. GRID LIST VIEW */}
                {!editingProductId && !showAddExisting && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">

                    {/* ADD NEW SQUARED BOX */}
                    <div
                      onClick={() => setShowAddExisting(true)}
                      style={{background:'var(--gray1)',border:'2px dashed var(--gray2)',borderRadius:14,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--gray4)',cursor:'pointer',aspectRatio:'1/1',minHeight:200,transition:'all .2s'}}
                      className="hover:border-[var(--primary)] hover:bg-[var(--primary-pale)]/10 hover:text-[var(--primary)] group"
                    >
                      <span style={{fontSize:'2.5rem',marginBottom:'.75rem',background:'#fff',borderRadius:'50%',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'var(--shadow-sm)'}} className="group-hover:scale-110 transition-transform">➕</span>
                      <span style={{fontWeight:900,fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.12em',textAlign:'center',padding:'0 1rem'}}>Add Product</span>
                    </div>

                    {/* PRODUCTS IN THIS SECTION */}
                    {sectionProducts.map((prod, idx) => (
                      <div key={prod.id} style={{background:'#fff',borderRadius:14,boxShadow:'var(--shadow-sm)',border:'1.5px solid var(--gray2)',overflow:'hidden',display:'flex',flexDirection:'column',position:'relative',minHeight:220,transition:'box-shadow .2s'}} className="group hover:shadow-md">

                        {/* Remove from section button */}
                        <button
                          onClick={() => removeFromSection(prod.id)}
                          style={{position:'absolute',top:12,right:12,zIndex:10,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,.9)',backdropFilter:'blur(4px)',borderRadius:'50%',opacity:0,transition:'opacity .2s',color:'var(--red)',fontWeight:900,fontSize:'.82rem',boxShadow:'var(--shadow-sm)',border:'1px solid rgba(220,38,38,0.15)',cursor:'pointer'}}
                          className="group-hover:opacity-100 hover:bg-[var(--red)] hover:text-white"
                          title="Remove from Section"
                        >
                          ✕
                        </button>

                        {/* Order controls */}
                        <div style={{position:'absolute',top:12,left:12,zIndex:10,display:'flex',flexDirection:'column',gap:'.4rem',opacity:0,transition:'opacity .2s'}} className="group-hover:opacity-100">
                          <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,background:'#fff',boxShadow:'var(--shadow-sm)',border:'1.5px solid var(--gray2)',color:'var(--gray4)',fontWeight:900,fontSize:'.82rem',cursor:'pointer'}} className="hover:text-[var(--dark)] hover:border-[var(--gray3)] disabled:opacity-40">↑</button>
                          <button onClick={() => moveProduct(idx, 1)} disabled={idx === sectionProducts.length - 1} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,background:'#fff',boxShadow:'var(--shadow-sm)',border:'1.5px solid var(--gray2)',color:'var(--gray4)',fontWeight:900,fontSize:'.82rem',cursor:'pointer'}} className="hover:text-[var(--dark)] hover:border-[var(--gray3)] disabled:opacity-40">↓</button>
                        </div>

                        {/* Clickable Image to Edit */}
                        <div
                          style={{height:144,width:'100%',background:'var(--gray1)',position:'relative',cursor:'pointer'}}
                          onClick={() => openEditForm(prod)}
                        >
                          {prod.images?.[0] ? (
                            <img src={prod.images[0]} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity duration-300" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl group-hover:opacity-80 transition-opacity duration-300" title="No Image">🥭</div>
                          )}
                          <div style={{position:'absolute',inset:0,background:'rgba(18,18,18,0.3)',opacity:0,transition:'opacity .3s',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)',pointerEvents:'none'}} className="group-hover:opacity-100">
                            <span style={{background:'rgba(18,18,18,.9)',color:'#fff',fontSize:'.72rem',textTransform:'uppercase',fontWeight:900,padding:'.4rem 1rem',borderRadius:100,letterSpacing:'.12em',boxShadow:'0 4px 12px rgba(0,0,0,.2)'}}>Edit Details</span>
                          </div>
                        </div>

                        <div style={{padding:'1rem',flex:1,display:'flex',flexDirection:'column'}}>
                          <h4 style={{fontWeight:900,fontSize:'.82rem',color:'var(--dark)',lineHeight:1.35,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:40}}>{prod.name}</h4>
                          <p style={{fontWeight:900,color:'var(--primary)',fontSize:'.82rem',marginTop:'.5rem'}}>৳{prod.discountPrice || prod.price}</p>
                          <div style={{marginTop:'auto',paddingTop:'1rem'}}>
                            <button
                              onClick={() => openEditForm(prod)}
                              style={{width:'100%',background:'var(--gray1)',color:'var(--gray4)',padding:'.6rem',borderRadius:100,fontWeight:900,fontSize:'.68rem',textTransform:'uppercase',letterSpacing:'.1em',border:'1.5px solid var(--gray2)',cursor:'pointer',transition:'all .15s'}}
                              className="hover:bg-[var(--gray2)] hover:text-[var(--dark)]"
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