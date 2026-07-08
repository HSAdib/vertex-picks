import React from 'react';

export default function FilterSidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategories,
  setSelectedCategories,
  getCategoryCount,
  filters,
  selectedVarieties,
  setSelectedVarieties,
  getVarietyCount,
  selectedPriceRanges,
  setSelectedPriceRanges,
  selectedWeights,
  setSelectedWeights,
  selectedSeasons,
  setSelectedSeasons,
  minRating,
  setMinRating,
  inStockOnly,
  setInStockOnly,
  onSaleOnly,
  setOnSaleOnly
}) {
  return (
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
  );
}
