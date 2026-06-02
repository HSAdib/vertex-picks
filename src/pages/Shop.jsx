import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function Shop() {
  const [mangoes, setMangoes] = useState([]);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const tabId = queryParams.get('tabId');
  const urlSearch = queryParams.get('search');

  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch);
  const [sections, setSections] = useState([]);
  const [activeTabObj, setActiveTabObj] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});

  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [minRating, setMinRating] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sortOption, setSortOption] = useState('featured');
  const [viewMode, setViewMode] = useState('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem('vertex_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  if (urlSearch !== prevUrlSearch) {
    setPrevUrlSearch(urlSearch);
    setSearchQuery(urlSearch || '');
  }

  const { addToCart, cart } = useCart();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMangoes = async () => {
      try {
        let allowedSections = [];
        if (tabId) {
          const navDoc = await getDoc(doc(db, 'mangoes', 'NAVBAR_TABS'));
          if (navDoc.exists() && navDoc.data().list) {
            const activeTab = navDoc.data().list.find(t => t.id === tabId);
            if (activeTab) {
              setActiveTabObj(activeTab);
              if (activeTab.sections) allowedSections = activeTab.sections;
            }
          }
        } else {
          setActiveTabObj(null);
        }

        const querySnapshot = await getDocs(collection(db, 'mangoes'));
        const productsArray = [];
        let fetchedSections = [];

        querySnapshot.docs.forEach(d => {
          if (d.id === 'STORE_SECTIONS') {
            fetchedSections = d.data().list || [];
          } else if (d.id !== 'NAVBAR_TABS' && d.id !== 'STORE_SETTINGS') {
            productsArray.push({ id: d.id, ...d.data() });
          }
        });

        if (tabId && allowedSections.length > 0) {
          fetchedSections = fetchedSections.filter(s => allowedSections.includes(s));
        }

        productsArray.sort((a, b) => (a.order || 0) - (b.order || 0));
        setSections(fetchedSections);
        setMangoes(productsArray);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching shop data:', error);
        setLoading(false);
      }
    };
    fetchMangoes();
  }, [tabId]);

  const updateQty = (id, amount) => {
    setQuantities(prev => {
      const newQty = Math.max(1, (prev[id] || 1) + amount);
      return { ...prev, [id]: newQty };
    });
  };

  const handleAddToCart = (mango) => {
    const qtyToAdd = quantities[mango.id] || 1;
    addToCart(mango.id, qtyToAdd);
    setQuantities(prev => ({ ...prev, [mango.id]: 1 }));
  };

  const handleGodModeEdit = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem('teleportEditId', id);
    navigate('/admin');
  };

  const toggleWishlist = (mango) => {
    setWishlist(prev => {
      let updated;
      if (prev.includes(mango.id)) {
        updated = prev.filter(id => id !== mango.id);
        toast.success(`Removed ${mango.name} from Wishlist!`, { icon: '💔' });
      } else {
        updated = [...prev, mango.id];
        toast.success(`Added ${mango.name} to Wishlist!`, { icon: '❤️' });
      }
      localStorage.setItem('vertex_wishlist', JSON.stringify(updated));
      return updated;
    });
  };

  const getVarietyCount = (varietyName) =>
    mangoes.filter(m => {
      if (tabId && sections.length > 0 && !sections.includes(m.section)) return false;
      return (
        m.name?.toLowerCase().includes(varietyName.toLowerCase()) ||
        m.section?.toLowerCase().includes(varietyName.toLowerCase()) ||
        m.variety?.toLowerCase().includes(varietyName.toLowerCase())
      );
    }).length;

  const filteredMangoes = mangoes
    .filter(mango => {
      if (tabId && sections.length > 0 && !sections.includes(mango.section)) return false;
      if (selectedVarieties.length > 0) {
        const v = mango.variety || mango.section || mango.name || '';
        if (!selectedVarieties.some(sv => v.toLowerCase().includes(sv.toLowerCase()))) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        if (
          !mango.name?.toLowerCase().includes(q) &&
          !mango.description?.toLowerCase().includes(q) &&
          !mango.section?.toLowerCase().includes(q) &&
          !mango.variety?.toLowerCase().includes(q)
        ) return false;
      }
      const activePrice = Number(mango.discountPrice) || Number(mango.price) || 0;
      if (minPrice !== '' && activePrice < Number(minPrice)) return false;
      if (maxPrice !== '' && activePrice > Number(maxPrice)) return false;
      if (selectedWeights.length > 0) {
        const itemWeight = Number(mango.fixedWeight) || Number(mango.weight) || 1;
        const itemUnit = mango.unit || 'kg';
        const pass = selectedWeights.some(w => {
          const wl = w.toLowerCase();
          if (wl.includes('dozen')) {
            if (wl.includes('½') || wl.includes('1/2') || wl.includes('half'))
              return itemWeight === 6 || (itemUnit.toLowerCase().includes('dozen') && itemWeight === 0.5);
            return itemWeight === 12 || (itemUnit.toLowerCase().includes('dozen') && itemWeight === 1);
          }
          return itemWeight === parseFloat(wl);
        });
        if (!pass) return false;
      }
      if (selectedSeasons.length > 0) {
        const s = mango.season || 'Peak';
        if (!selectedSeasons.some(ss => s.toLowerCase().includes(ss.toLowerCase()))) return false;
      }
      if (minRating !== null) {
        const r = Number(mango.stats?.rating) || Number(mango.rating) || 5;
        if (r < minRating) return false;
      }
      if (inStockOnly) {
        const ok = mango.inStock !== false && (mango.stock === undefined || Number(mango.stock) > 0);
        if (!ok) return false;
      }
      if (onSaleOnly) {
        const ok = mango.onSale === true || (mango.discountPrice !== undefined && Number(mango.discountPrice) < Number(mango.price));
        if (!ok) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOption === 'price-asc') return (Number(a.discountPrice) || Number(a.price) || 0) - (Number(b.discountPrice) || Number(b.price) || 0);
      if (sortOption === 'price-desc') return (Number(b.discountPrice) || Number(b.price) || 0) - (Number(a.discountPrice) || Number(a.price) || 0);
      if (sortOption === 'rating') return (Number(b.stats?.rating) || Number(b.rating) || 5) - (Number(a.stats?.rating) || Number(a.rating) || 5);
      if (sortOption === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      if (sortOption === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      return (a.order || 0) - (b.order || 0);
    });

  const activeFiltersList = [];
  selectedVarieties.forEach(v => activeFiltersList.push({ label: v, clear: () => setSelectedVarieties(p => p.filter(i => i !== v)) }));
  if (minPrice > 0 || maxPrice < 2000) activeFiltersList.push({ label: `৳${minPrice}–৳${maxPrice}`, clear: () => { setMinPrice(0); setMaxPrice(2000); } });
  selectedWeights.forEach(w => activeFiltersList.push({ label: w, clear: () => setSelectedWeights(p => p.filter(i => i !== w)) }));
  selectedSeasons.forEach(s => activeFiltersList.push({ label: `${s} Season`, clear: () => setSelectedSeasons(p => p.filter(i => i !== s)) }));
  if (minRating !== null) activeFiltersList.push({ label: `★ ${minRating} & Up`, clear: () => setMinRating(null) });
  if (inStockOnly) activeFiltersList.push({ label: 'In Stock Only', clear: () => setInStockOnly(false) });
  if (onSaleOnly) activeFiltersList.push({ label: 'On Sale', clear: () => setOnSaleOnly(false) });

  const clearAllFilters = () => {
    setSelectedVarieties([]); setMinPrice(0); setMaxPrice(2000);
    setSelectedWeights([]); setSelectedSeasons([]); setMinRating(null);
    setInStockOnly(false); setOnSaleOnly(false); setSearchQuery('');
  };

  const renderTwoToneTitle = (text) => {
    if (!text) return null;
    const words = text.trim().split(' ');
    if (words.length === 1) return text;
    const last = words.pop();
    return <>{words.join(' ')} <span style={{ color: 'var(--primary)' }}>{last}</span></>;
  };

  if (loading) {
    return (
      <div style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Syncing Harvests…</p>
        </div>
      </div>
    );
  }

  const titleRaw = activeTabObj?.heroTitle;
  const subtitleRaw = activeTabObj?.heroSubtitle;
  const showTitle = titleRaw !== undefined ? titleRaw.trim() !== '' : true;
  const showSubtitle = subtitleRaw !== undefined ? subtitleRaw.trim() !== '' : true;
  const showHeader = showTitle || showSubtitle;

  return (
    <div style={{ paddingTop: 'var(--nav-height)', background: '#fff', minHeight: '100vh' }}>

      {/* HERO HEADER */}
      {showHeader && (
        <section style={{ background: 'linear-gradient(135deg,#FFF8F0,#FFF3E5)', padding: '3rem 5% 2.5rem', textAlign: 'center', borderBottom: '1px solid var(--gray2)' }}>
          {showTitle && (
            <h1 className="hero-h1" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)', marginBottom: '.5rem' }}>
              {titleRaw !== undefined ? renderTwoToneTitle(titleRaw) : <>Premium <span style={{ color: 'var(--primary)' }}>Selection</span></>}
            </h1>
          )}
          {showSubtitle && (
            <p className="hero-sub" style={{ maxWidth: 520, margin: '0 auto' }}>
              {subtitleRaw ?? 'Fresh from the orchards of Rajshahi. Hand-picked for excellence.'}
            </p>
          )}
        </section>
      )}

      {/* SHOP LAYOUT */}
      <div className="shop-layout">

        {/* MOBILE OVERLAY */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 290 }}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`shop-sidebar${isSidebarOpen ? ' open' : ''}`} id="shopSidebar">
          <button className="sidebar-close" onClick={() => setIsSidebarOpen(false)}>✕</button>

          {/* Search */}
          <div className="sidebar-block">
            <div className="sb-title">Search</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray4)', fontSize: '.8rem', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="price-inp"
                style={{ width: '100%', paddingLeft: '2rem' }}
                placeholder="Search products…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Variety */}
          <div className="sidebar-block">
            <div className="sb-title">
              Variety
              {selectedVarieties.length > 0 && <span className="sb-clear" onClick={() => setSelectedVarieties([])}>Clear</span>}
            </div>
            {['Himsagar', 'Langra', 'Fazli', 'Gopalbhog', 'Amrapali', 'Gift Box'].map(v => (
              <label key={v} className="filter-check">
                <input
                  type="checkbox"
                  checked={selectedVarieties.includes(v)}
                  onChange={() => setSelectedVarieties(p => p.includes(v) ? p.filter(i => i !== v) : [...p, v])}
                />
                <span>{v}</span>
                <span className="fc-count">{getVarietyCount(v)}</span>
              </label>
            ))}
          </div>

          {/* Price */}
          <div className="sidebar-block">
            <div className="sb-title">
              Price Range (৳)
              {(minPrice > 0 || maxPrice < 2000) && <span className="sb-clear" onClick={() => { setMinPrice(0); setMaxPrice(2000); }}>Clear</span>}
            </div>
            <input type="range" className="range-slider" min="0" max="2000" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} />
            <div className="price-inputs">
              <input type="number" className="price-inp" placeholder="Min ৳" value={minPrice || ''} onChange={e => setMinPrice(e.target.value === '' ? '' : Number(e.target.value))} />
              <input type="number" className="price-inp" placeholder="Max ৳" value={maxPrice || ''} onChange={e => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>

          {/* Weight */}
          <div className="sidebar-block">
            <div className="sb-title">
              Weight
              {selectedWeights.length > 0 && <span className="sb-clear" onClick={() => setSelectedWeights([])}>Clear</span>}
            </div>
            <div className="chip-group">
              {['½ Dozen', '1 Dozen', '2 Kg', '5 Kg', '10 Kg'].map(w => (
                <div key={w} className={`chip${selectedWeights.includes(w) ? ' active' : ''}`} onClick={() => setSelectedWeights(p => p.includes(w) ? p.filter(i => i !== w) : [...p, w])}>
                  {w}
                </div>
              ))}
            </div>
          </div>

          {/* Season */}
          <div className="sidebar-block">
            <div className="sb-title">
              Season
              {selectedSeasons.length > 0 && <span className="sb-clear" onClick={() => setSelectedSeasons([])}>Clear</span>}
            </div>
            {[{ key: 'Early', label: 'Early Season (May–Jun)' }, { key: 'Peak', label: 'Peak Season (Jun–Jul)' }, { key: 'Late', label: 'Late Season (Jul–Aug)' }].map(s => (
              <label key={s.key} className="filter-check">
                <input type="checkbox" checked={selectedSeasons.includes(s.key)} onChange={() => setSelectedSeasons(p => p.includes(s.key) ? p.filter(i => i !== s.key) : [...p, s.key])} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>

          {/* Rating */}
          <div className="sidebar-block">
            <div className="sb-title">
              Rating
              {minRating !== null && <span className="sb-clear" onClick={() => setMinRating(null)}>Clear</span>}
            </div>
            <div className="star-filter">
              {[5, 4, 3].map(r => (
                <label key={r} className="star-row">
                  <input type="checkbox" checked={minRating === r} onChange={() => setMinRating(minRating === r ? null : r)} />
                  <span className="stars">{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>
                  {r === 5 ? '5 only' : `${r} & up`}
                </label>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="sidebar-block">
            <div className="sb-title">Availability</div>
            <label className="filter-check">
              <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
              <span>In Stock Only</span>
            </label>
            <label className="filter-check">
              <input type="checkbox" checked={onSaleOnly} onChange={e => setOnSaleOnly(e.target.checked)} />
              <span>On Sale</span>
            </label>
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }} onClick={() => setIsSidebarOpen(false)}>
            Apply Filters
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="shop-main">

          {/* TOP BAR */}
          <div className="shop-topbar">
            <div className="shop-search-wrap">
              <span className="shop-search-icon">🔍</span>
              <input
                type="text"
                className="shop-search"
                placeholder="Search mangoes, varieties, gift boxes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="shop-topbar-right">
              <button className="filter-btn" style={{ display: 'flex' }} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                ☰ Filters
              </button>
              <select className="sort-select" value={sortOption} onChange={e => setSortOption(e.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="name-asc">Name A–Z</option>
              </select>
              <div className="view-toggle">
                <button className={`view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid">⊞</button>
                <button className={`view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List">☰</button>
              </div>
            </div>
          </div>

          {/* ACTIVE FILTER TAGS */}
          {activeFiltersList.length > 0 && (
            <div className="active-filters">
              <span className="af-label">Active:</span>
              {activeFiltersList.map((f, i) => (
                <span key={i} className="af-tag">{f.label} <span className="af-x" onClick={f.clear}>✕</span></span>
              ))}
              <span className="af-clear-all" onClick={clearAllFilters}>Clear All</span>
            </div>
          )}

          {/* RESULTS COUNT */}
          <div className="results-count">
            Showing <strong>{filteredMangoes.length}</strong> of <strong>{mangoes.length}</strong> harvests available
          </div>

          {/* PRODUCTS GRID */}
          {filteredMangoes.length === 0 ? (
            <div className="no-results">
              <div className="nr-icon">🥭</div>
              <p><strong>No mangoes found</strong><br />Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className={`shop-grid${viewMode === 'list' ? ' list-view' : ''}`} id="shopGrid">
              {filteredMangoes.map(mango => {
                const isAdded = cart?.some(item => item.id === mango.id);
                const mainImage = mango.images?.[0] || mango.image;
                const displayPrice = mango.discountPrice || mango.price;
                const oldPrice = mango.discountPrice ? mango.price : null;
                const ratingStars = Math.round(Number(mango.stats?.rating) || Number(mango.rating) || 5);
                const isLiked = wishlist.includes(mango.id);

                return (
                  <div key={mango.id} className="product-card" onClick={() => navigate(`/product/${mango.id}`)}>

                    {/* Admin quick-edit */}
                    {isAdmin && (
                      <button
                        onClick={e => handleGodModeEdit(e, mango.id)}
                        style={{ position: 'absolute', top: 10, right: 44, zIndex: 20, background: '#111', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', cursor: 'pointer', border: 'none' }}
                      >
                        ⚡ Edit
                      </button>
                    )}

                    {/* Discount badge */}
                    {mango.discountPercent && (
                      <div className="tag-strip">
                        <span className="badge badge-orange">-{mango.discountPercent}%</span>
                      </div>
                    )}

                    {/* Wishlist */}
                    <button
                      className="pc-wishlist"
                      style={{ color: isLiked ? 'var(--primary)' : 'inherit' }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(mango); }}
                    >
                      {isLiked ? '♥' : '♡'}
                    </button>

                    {/* Image */}
                    <div className="pc-img" style={{ background: 'var(--gray1)' }}>
                      {mainImage
                        ? <img src={mainImage} alt={mango.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '3.5rem' }}>🥭</span>
                      }
                    </div>

                    {/* Body */}
                    <div className="pc-body">
                      {mango.section && (
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--primary)', marginBottom: 4 }}>
                          {mango.section}
                        </div>
                      )}
                      <h4 className="pc-name" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{mango.name}</h4>
                      <div className="pc-sub">
                        <span>⚖️ {mango.fixedWeight || 1}kg Box</span>
                        {mango.grade && <span> · {mango.grade}</span>}
                        {mango.season && <span> · {mango.season} Season</span>}
                      </div>
                      <div className="pc-rating">
                        <span className="stars">{'★'.repeat(ratingStars)}{'☆'.repeat(5 - ratingStars)}</span>
                        <span>({mango.stats?.reviewCount || mango.reviews?.length || 0})</span>
                      </div>
                      <div className="pc-price-row">
                        <div className="pc-price">
                          ৳{Number(displayPrice).toLocaleString()}
                          {oldPrice && <span className="old">৳{Number(oldPrice).toLocaleString()}</span>}
                        </div>
                        <button
                          className={`pc-add${isAdded ? ' added' : ''}`}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); handleAddToCart(mango); }}
                        >
                          {isAdded ? '✓' : '+'}
                        </button>
                      </div>

                      {/* Quantity stepper */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--gray2)' }}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--gray2)', borderRadius: 8, background: 'var(--gray1)', overflow: 'hidden' }}>
                          <button style={{ padding: '4px 10px', fontWeight: 700, fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray4)' }} onClick={e => { e.stopPropagation(); updateQty(mango.id, -1); }}>−</button>
                          <span style={{ padding: '4px 10px', fontWeight: 700, fontSize: '.8rem', minWidth: 24, textAlign: 'center' }}>{quantities[mango.id] || 1}</span>
                          <button style={{ padding: '4px 10px', fontWeight: 700, fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray4)' }} onClick={e => { e.stopPropagation(); updateQty(mango.id, 1); }}>+</button>
                        </div>
                        <button
                          style={{ background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); handleAddToCart(mango); }}
                        >
                          Add 📦
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}