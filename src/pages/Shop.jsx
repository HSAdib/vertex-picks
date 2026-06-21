import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../hooks/useWishlist';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function Shop() {
  const [mangoes, setMangoes] = useState([]);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlSearch = queryParams.get('search');
  const urlCategory = queryParams.get('category');

  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ rating: [], season: [], weight: [], priceRange: [], variety: [] });
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [cardSelectedWeights, setCardSelectedWeights] = useState({});

  const [selectedCategories, setSelectedCategories] = useState(urlCategory ? [urlCategory] : []);
  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [minRating, setMinRating] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sortOption, setSortOption] = useState('featured');
  const [viewMode, setViewMode] = useState('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { toggleWishlist, isInWishlist } = useWishlist();

  // B11 fix: sync URL search param changes via useEffect, not during render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery(urlSearch || '');
  }, [urlSearch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCategories(urlCategory ? [urlCategory] : []);
  }, [urlCategory]);

  const { addToCart } = useCart();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMangoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'mangoes'));
        const productsArray = [];
        let fetchedCategories = [];
        let fetchedFilters = { rating: [], season: [], weight: [], priceRange: [], variety: [] };

        querySnapshot.docs.forEach(d => {
          if (d.id === 'CATEGORIES') {
            fetchedCategories = d.data().list || [];
          } else if (d.id === 'FILTERS') {
            fetchedFilters = d.data() || fetchedFilters;
          } else if (d.id !== 'STORE_SECTIONS' && d.id !== 'NAVBAR_TABS' && d.id !== 'STORE_SETTINGS' && d.id !== 'VARIETIES' && d.id !== 'PACKAGING_OPTIONS' && d.id !== 'DELIVERY_OPTIONS') {
            productsArray.push({ id: d.id, ...d.data() });
          }
        });

        productsArray.sort((a, b) => (a.order || 0) - (b.order || 0));
        setCategories(fetchedCategories);
        // Fix: If FILTERS document is functionally empty, use the same defaults as Admin > FiltersTab
        const isFiltersEmpty = !fetchedFilters.variety?.length && !fetchedFilters.weight?.length && !fetchedFilters.season?.length;
        if (isFiltersEmpty) {
          fetchedFilters = {
            variety: ['Himsagar', 'Langra', 'Fazli', 'Gopalbhog', 'Amrapali', 'Gift Box'],
            weight: ['5kg', '10kg', '20kg'],
            season: ['Early Season', 'Peak Season', 'Late Season'],
            priceRange: ['0-500', '501-1000', '1000+'],
            rating: fetchedFilters.rating || []
          };
        }

        setFilters({
          rating: fetchedFilters.rating || [],
          season: fetchedFilters.season || [],
          weight: fetchedFilters.weight || [],
          priceRange: fetchedFilters.priceRange || [],
          variety: fetchedFilters.variety || []
        });
        setMangoes(productsArray);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching shop data:', error);
        setLoading(false);
      }
    };
    fetchMangoes();
  }, []);

  const updateQty = (id, amount) => {
    setQuantities(prev => {
      const newQty = Math.max(1, (prev[id] || 1) + amount);
      return { ...prev, [id]: newQty };
    });
  };

  const handleAddToCart = (mango) => {
    const qtyToAdd = quantities[mango.id] || 1;
    const selW = cardSelectedWeights[mango.id] || (mango.weightOptions && mango.weightOptions.length > 0 ? mango.weightOptions[0] : `${mango.fixedWeight || 1}kg Box`);
    addToCart(mango.id, qtyToAdd, mango, selW);
    setQuantities(prev => ({ ...prev, [mango.id]: 1 }));
  };

  const handleGodModeEdit = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem('teleportEditId', id);
    navigate('/admin');
  };



  const getCategoryCount = (catName) =>
    mangoes.filter(m => {
      const v = m.category || '';
      const vArray = Array.isArray(v) ? v : [v];
      return vArray.some(item => String(item).toLowerCase() === String(catName || '').toLowerCase());
    }).length;

  const getVarietyCount = (varietyName) =>
    mangoes.filter(m => {
      const v = m.variety || m.section || m.name || '';
      return String(v).toLowerCase().includes(String(varietyName || '').toLowerCase());
    }).length;

  const filteredMangoes = mangoes
    .filter(mango => {
      if (selectedCategories.length > 0) {
        const v = mango.category || '';
        const vArray = Array.isArray(v) ? v : [v];
        if (!selectedCategories.some(sc => vArray.some(item => String(item).toLowerCase() === (sc || '').toLowerCase()))) return false;
      }
      if (selectedVarieties.length > 0) {
        const v = mango.variety || mango.section || mango.name || '';
        const vArray = Array.isArray(v) ? v : [v];
        if (!selectedVarieties.some(sv => vArray.some(item => String(item).toLowerCase().includes(String(sv || '').toLowerCase())))) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const vStr = Array.isArray(mango.variety) ? mango.variety.join(' ') : (mango.variety || '');
        const cStr = Array.isArray(mango.category) ? mango.category.join(' ') : (mango.category || '');
        if (
          !mango.name?.toLowerCase().includes(q) &&
          !mango.description?.toLowerCase().includes(q) &&
          !(cStr || mango.section || vStr || '').toLowerCase().includes(q)
        ) return false;
      }
      const activePrice = Number(mango.discountPrice) || Number(mango.price) || 0;
      if (selectedPriceRanges.length > 0) {
        const passPrice = selectedPriceRanges.some(pr => {
          if (pr.includes('+')) {
            const min = Number(pr.replace('+', '').trim());
            return activePrice >= min;
          }
          const [minStr, maxStr] = pr.split('-');
          const min = Number(minStr?.trim() || 0);
          const max = Number(maxStr?.trim() || Infinity);
          return activePrice >= min && activePrice <= max;
        });
        if (!passPrice) return false;
      }
      if (selectedWeights.length > 0) {
        const wVal = mango.fixedWeight || '';
        const wArray = Array.isArray(wVal) ? wVal : [wVal];
        const pass = selectedWeights.some(sw => wArray.some(item => String(item).toLowerCase() === sw.toLowerCase()));
        if (!pass) return false;
      }
      if (selectedSeasons.length > 0) {
        const sVal = mango.season || 'Peak';
        const sArray = Array.isArray(sVal) ? sVal : [sVal];
        const pass = selectedSeasons.some(ss => sArray.some(item => String(item).toLowerCase().includes(ss.toLowerCase())));
        if (!pass) return false;
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
  selectedCategories.forEach(v => activeFiltersList.push({ label: v, clear: () => setSelectedCategories(p => p.filter(i => i !== v)) }));
  selectedVarieties.forEach(v => activeFiltersList.push({ label: v, clear: () => setSelectedVarieties(p => p.filter(i => i !== v)) }));
  selectedPriceRanges.forEach(v => activeFiltersList.push({ label: `৳${v}`, clear: () => setSelectedPriceRanges(p => p.filter(i => i !== v)) }));
  selectedWeights.forEach(w => activeFiltersList.push({ label: w, clear: () => setSelectedWeights(p => p.filter(i => i !== w)) }));
  selectedSeasons.forEach(s => activeFiltersList.push({ label: `${s} Season`, clear: () => setSelectedSeasons(p => p.filter(i => i !== s)) }));
  if (minRating !== null) activeFiltersList.push({ label: `★ ${minRating} & Up`, clear: () => setMinRating(null) });
  if (inStockOnly) activeFiltersList.push({ label: 'In Stock Only', clear: () => setInStockOnly(false) });
  if (onSaleOnly) activeFiltersList.push({ label: 'On Sale', clear: () => setOnSaleOnly(false) });

  const clearAllFilters = () => {
    setSelectedCategories([]); setSelectedVarieties([]); setSelectedPriceRanges([]);
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
      <div style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Syncing Harvests…</p>
        </div>
      </div>
    );
  }

  const titleRaw = urlCategory ? `${urlCategory}` : 'Mango Baba';
  const subtitleRaw = urlCategory ? `Browse our fresh selection of ${urlCategory}.` : 'Fresh from the orchards of Rajshahi. Hand-picked for excellence.';
  const showTitle = true;
  const showSubtitle = true;
  const showHeader = true;

  return (
    <div style={{ paddingTop: 'var(--nav-height)', background: 'var(--peach-gradient)', minHeight: '100vh' }}>

      {/* HERO HEADER */}
      {showHeader && (
        <section style={{ padding: '1rem 5% 1rem', textAlign: 'center' }}>
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

          {/* Categories */}
          <div className="sidebar-block">
            <div className="sb-title">
              Category
              {selectedCategories.length > 0 && <span className="sb-clear" onClick={() => setSelectedCategories([])}>Clear</span>}
            </div>
            {categories.map(v => (
              <label key={v} className="filter-check">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(v)}
                  onChange={() => setSelectedCategories(p => p.includes(v) ? p.filter(i => i !== v) : [...p, v])}
                />
                <span>{v}</span>
                <span className="fc-count">{getCategoryCount(v)}</span>
              </label>
            ))}
          </div>

          {/* Variety */}
          <div className="sidebar-block">
            <div className="sb-title">
              Variety
              {selectedVarieties.length > 0 && <span className="sb-clear" onClick={() => setSelectedVarieties([])}>Clear</span>}
            </div>
            {filters.variety.map(v => (
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

          {/* Price Range */}
          <div className="sidebar-block">
            <div className="sb-title">
              Price Range (৳)
              {selectedPriceRanges.length > 0 && <span className="sb-clear" onClick={() => setSelectedPriceRanges([])}>Clear</span>}
            </div>
            {filters.priceRange.map(pr => (
              <label key={pr} className="filter-check">
                <input
                  type="checkbox"
                  checked={selectedPriceRanges.includes(pr)}
                  onChange={() => setSelectedPriceRanges(p => p.includes(pr) ? p.filter(i => i !== pr) : [...p, pr])}
                />
                <span>{pr}</span>
              </label>
            ))}
          </div>

          {/* Weight */}
          <div className="sidebar-block">
            <div className="sb-title">
              Weight
              {selectedWeights.length > 0 && <span className="sb-clear" onClick={() => setSelectedWeights([])}>Clear</span>}
            </div>
            <div className="chip-group">
              {filters.weight.map(w => (
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
            {filters.season.map(s => (
              <label key={s} className="filter-check">
                <input type="checkbox" checked={selectedSeasons.includes(s)} onChange={() => setSelectedSeasons(p => p.includes(s) ? p.filter(i => i !== s) : [...p, s])} />
                <span>{s} Season</span>
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
                const mainImage = mango.images?.[0] || mango.image;
                const displayPrice = mango.discountPrice || mango.price;
                const oldPrice = mango.discountPrice ? mango.price : null;
                const ratingStars = Math.round(Number(mango.stats?.rating) || Number(mango.rating) || 5);
                const isLiked = isInWishlist(mango.id);

                return (
                  <div key={mango.id} className="product-card" onClick={() => navigate(`/product/${mango.id}`)}>







                    {/* Image */}
                    <div className="pc-img">
                      {mango.discountPercent && (
                        <div className="pc-discount-badge">-{mango.discountPercent}%</div>
                      )}
                      {isAdmin && (
                        <button className="pc-edit-btn" onClick={e => handleGodModeEdit(e, mango.id)}>
                          EDIT
                        </button>
                      )}
                      {mainImage
                        ? <img src={mainImage} alt={mango.name} loading="lazy" />
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
                      <div className="pc-sub" style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {mango.weightOptions && mango.weightOptions.length > 1 ? (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem', marginBottom: '0.2rem' }} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                            {mango.weightOptions.map(opt => {
                              const isSelected = (cardSelectedWeights[mango.id] || mango.weightOptions[0]) === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setCardSelectedWeights(prev => ({ ...prev, [mango.id]: opt }))}
                                  style={{
                                    background: isSelected ? '#E8540A' : 'var(--bg-card)',
                                    borderColor: isSelected ? '#E8540A' : 'var(--border-color)',
                                    borderStyle: 'solid',
                                    borderWidth: '1.5px',
                                    borderRadius: '100px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                                    padding: '0.3rem 0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span>📦 {mango.weightOptions && mango.weightOptions.length === 1 ? mango.weightOptions[0] : `${mango.fixedWeight || 1}kg Box`}</span>
                        )}
                        {mango.season && <span> · 🌱 {mango.season} Season</span>}
                      </div>
                      <div className="pc-rating">
                        <span className="stars">{'★'.repeat(ratingStars)}{'☆'.repeat(5 - ratingStars)}</span>
                        <span>({mango.stats?.reviewCount || mango.reviews?.length || 0})</span>
                      </div>
                      <div className="pc-price-row">
                        <div className="pc-price">
                          ৳{Number(displayPrice).toLocaleString()}
                          {oldPrice && (
                            <>
                              <span className="old">৳{Number(oldPrice).toLocaleString()}</span>
                              {Number(oldPrice) > Number(displayPrice) && (
                                <span className="pc-savings-pill">Save ৳{Number(oldPrice) - Number(displayPrice)}</span>
                              )}
                            </>
                          )}
                        </div>
                        <button
                          style={{ 
                            background: 'var(--gray1)', border: 'none', cursor: 'pointer',
                            fontSize: '1.2rem', color: isLiked ? 'var(--primary)' : 'var(--gray4)',
                            width: '32px', height: '32px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s', marginTop: '-4px'
                          }}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(mango); }}
                          title={isLiked ? "Remove from Wishlist" : "Add to Wishlist"}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = isLiked ? 'var(--primary)' : 'var(--gray4)'}
                        >
                          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      {/* Bottom Actions */}
                      <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--gray2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '0.6rem', width: '100%' }}>
                          <div className="pc-qty-stepper">
                            <button className="pc-qty-btn" onClick={e => { e.stopPropagation(); updateQty(mango.id, -1); }}>−</button>
                            <input
                              type="number"
                              className="pc-qty-input"
                              value={quantities[mango.id] === undefined ? 1 : quantities[mango.id]}
                              min="1"
                              onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                              onChange={e => {
                                const val = e.target.value;
                                setQuantities(prev => ({ ...prev, [mango.id]: val === '' ? '' : Math.max(1, parseInt(val) || 1) }));
                              }}
                              onBlur={() => {
                                if (quantities[mango.id] === '' || quantities[mango.id] < 1) {
                                  setQuantities(prev => ({ ...prev, [mango.id]: 1 }));
                                }
                              }}
                            />
                            <button className="pc-qty-btn" onClick={e => { e.stopPropagation(); updateQty(mango.id, 1); }}>+</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button className="pc-add-btn-new" onClick={e => { e.stopPropagation(); handleAddToCart(mango); }}>
                            Add to Cart
                          </button>
                          <button className="pc-buy-btn-new" onClick={e => { e.stopPropagation(); handleAddToCart(mango); navigate('/checkout'); }}>
                            Buy Now
                          </button>
                        </div>
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
