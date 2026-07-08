import React from 'react';
import { useQuery } from '@tanstack/react-query';
import SEO from '../components/SEO';
import { fetchShopData } from '../api/shopApi';
import { useShopFilters } from '../hooks/useShopFilters';
import FilterSidebar from '../components/Shop/FilterSidebar';
import ProductGrid from '../components/Shop/ProductGrid';

export default function Shop() {
  const shopFilters = useShopFilters();
  const {
    searchQuery, setSearchQuery,
    selectedCategories,
    selectedVarieties,
    selectedPriceRanges,
    selectedWeights,
    selectedSeasons,
    minRating,
    inStockOnly,
    onSaleOnly,
    sortOption, setSortOption,
    viewMode, setViewMode,
    isSidebarOpen, setIsSidebarOpen,
    clearAllFilters,
    urlCategory
  } = shopFilters;

  const { data, isLoading } = useQuery({
    queryKey: ['shopData'],
    queryFn: fetchShopData,
  });

  const mangoes = data?.mangoes || [];
  const categories = data?.categories || [];
  const filters = data?.filters || { rating: [], season: [], weight: [], priceRange: [], variety: [] };

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
  selectedCategories.forEach(v => activeFiltersList.push({ label: v, clear: () => shopFilters.setSelectedCategories(p => p.filter(i => i !== v)) }));
  selectedVarieties.forEach(v => activeFiltersList.push({ label: v, clear: () => shopFilters.setSelectedVarieties(p => p.filter(i => i !== v)) }));
  selectedPriceRanges.forEach(v => activeFiltersList.push({ label: `৳${v}`, clear: () => shopFilters.setSelectedPriceRanges(p => p.filter(i => i !== v)) }));
  selectedWeights.forEach(w => activeFiltersList.push({ label: w, clear: () => shopFilters.setSelectedWeights(p => p.filter(i => i !== w)) }));
  selectedSeasons.forEach(s => activeFiltersList.push({ label: `${s} Season`, clear: () => shopFilters.setSelectedSeasons(p => p.filter(i => i !== s)) }));
  if (minRating !== null) activeFiltersList.push({ label: `★ ${minRating} & Up`, clear: () => shopFilters.setMinRating(null) });
  if (inStockOnly) activeFiltersList.push({ label: 'In Stock Only', clear: () => shopFilters.setInStockOnly(false) });
  if (onSaleOnly) activeFiltersList.push({ label: 'On Sale', clear: () => shopFilters.setOnSaleOnly(false) });

  const renderTwoToneTitle = (text) => {
    if (!text) return null;
    const words = text.trim().split(' ');
    if (words.length === 1) return text;
    const last = words.pop();
    return <>{words.join(' ')} <span style={{ color: 'var(--primary)' }}>{last}</span></>;
  };

  const titleRaw = urlCategory ? `${urlCategory}` : 'Shop Our Harvest';
  const subtitleRaw = urlCategory ? `Browse our fresh selection of ${urlCategory}.` : 'Fresh from the orchards of Rajshahi. Hand-picked for excellence.';

  return (
    <div style={{ paddingTop: 'var(--nav-height)', background: 'var(--peach-gradient)', minHeight: '100vh' }}>
      <SEO title="Shop" description="Browse our premium selection of Rajshahi mangoes. Freshly harvested and delivered to you." />
      
      {/* HERO HEADER */}
      <section style={{ padding: '1rem 5% 1rem', textAlign: 'center' }}>
        <h1 className="hero-h1" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)', marginBottom: '.5rem' }}>
          {renderTwoToneTitle(titleRaw)}
        </h1>
        <p className="hero-sub" style={{ maxWidth: 520, margin: '0 auto' }}>
          {subtitleRaw}
        </p>
      </section>

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
        <FilterSidebar
          {...shopFilters}
          categories={categories}
          filters={filters}
          getCategoryCount={getCategoryCount}
          getVarietyCount={getVarietyCount}
        />

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
          {!isLoading && (
            <div className="results-count">
              Showing <strong>{filteredMangoes.length}</strong> of <strong>{mangoes.length}</strong> harvests available
            </div>
          )}

          {/* PRODUCTS GRID */}
          <ProductGrid
            filteredMangoes={filteredMangoes}
            viewMode={viewMode}
            isLoading={isLoading}
          />
        </main>
      </div>
    </div>
  );
}
