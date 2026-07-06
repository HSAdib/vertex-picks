import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { resolvePrice, getOptionLabel } from '../../utils/price';

export default function ProductInfo({ 
  product, 
  qty, 
  setQty, 
  displayRating,
  selectedWeight,
  setSelectedWeight 
}) {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [isAdded, setIsAdded] = useState(false);

  // B2 fix: actually add the product to cart
  const handleAddToCart = () => {
    if (!product.inStock) return;
    addToCart(product.id, qty, product, selectedWeight);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  // B17 fix: Buy Now → add to cart + navigate
  const handleBuyNow = () => {
    if (!product.inStock) return;
    addToCart(product.id, qty, product, selectedWeight);
    navigate('/checkout');
  };


  const { displayPrice, oldPrice } = resolvePrice(product, selectedWeight);

  return (
    <div className="pdp-info">
      <div className="pdp-variety-tag" id="pdp-variety-tag">
        🥭 {product.variety}
      </div>
      <h1 className="pdp-title" id="pdp-title">{product.name}</h1>
      <p className="pdp-subtitle" id="pdp-subtitle">{product.desc}</p>

      <div className="pdp-meta-row">
        <div className="pdp-rating-block">
          <span className="pdp-stars" id="pdp-stars">
            {'★'.repeat(product.rating || 5) + '☆'.repeat(5 - (product.rating || 5))}
          </span>
          <span className="pdp-rating-num" id="pdp-rating-num">{(displayRating ?? product.rating ?? 5).toFixed(1)}</span>
          <span
            className="pdp-review-count"
            id="pdp-review-count"
            onClick={() => document.getElementById('pdp-tab-btn-reviews')?.click()}
          >
            ({product.reviews || 0} reviews)
          </span>
        </div>
        <div className="pdp-meta-sep"></div>
        <div className={`pdp-stock-dot ${!product.inStock ? 'out' : ''}`} id="pdp-stock-dot">
          {product.inStock ? 'In Stock' : 'Out of Stock'}
        </div>
        <div className="pdp-meta-sep"></div>
        <span className="badge badge-orange" id="pdp-season-badge">
          {product.season} Season
        </span>
      </div>

      <div className="pdp-price-block">
        <div>
          <div className="pdp-price-main" id="pdp-price-main">
            ৳{Number(displayPrice || 0).toLocaleString()}
          </div>
          <span className="pdp-price-unit" id="pdp-price-unit">per {product.unit || 'unit'}</span>
          {oldPrice && (
            <div id="pdp-save-badge">
              <span className="pdp-price-save">
                🎉 You save <span id="pdp-save-amount">৳{oldPrice - displayPrice}</span>
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {oldPrice && (
            <div className="pdp-price-old" id="pdp-price-old">
              ৳{Number(oldPrice || 0).toLocaleString()}
            </div>
          )}
          <div style={{ fontSize: '.72rem', color: 'var(--gray4)', marginTop: '.3rem' }}>
            Inclusive of all taxes
          </div>
        </div>
      </div>

      {/* Weight / Size Options */}
      <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="pdp-section-label">Weight / Size</div>
        {product.weightOptions && product.weightOptions.length > 1 ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {product.weightOptions.map(opt => {
              const optLabel = getOptionLabel(opt);
              const isSelected = selectedWeight === optLabel;
              return (
                <button
                  key={optLabel}
                  type="button"
                  onClick={() => setSelectedWeight(optLabel)}
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
                  {optLabel}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
            📦 {product.weightOptions && product.weightOptions.length === 1 ? getOptionLabel(product.weightOptions[0]) : product.weight}
          </div>
        )}
      </div>


      <div className="pdp-section-label">Quantity</div>
      <div className="pdp-buy-row" id="pdp-buy-row">
        <div className="pdp-qty">
          <button className="pdp-qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <div className="pdp-qty-val" id="pdp-qty-val">
            <input
              type="number"
              value={qty}
              min="1"
              onChange={(e) => {
                const val = e.target.value;
                setQty(val === '' ? '' : Math.max(1, parseInt(val) || 1));
              }}
              onBlur={() => { if (qty === '' || qty < 1) setQty(1); }}
              style={{ width: '100%', height: '100%', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, fontSize: 'inherit', color: 'inherit', margin: 0, padding: 0 }}
            />
          </div>
          <button className="pdp-qty-btn" onClick={() => setQty(qty + 1)}>+</button>
        </div>
        <button
          className={`pdp-add-cart ${isAdded ? 'added' : ''}`}
          id="pdp-add-cart-btn"
          onClick={handleAddToCart}
          disabled={!product.inStock}
        >
          {product.inStock ? '🛒 Add to Cart' : 'Out of Stock'}
        </button>
        <button className="pdp-buy-now" onClick={handleBuyNow} disabled={!product.inStock}>
          Buy Now <span style={{ opacity: 0.85, fontWeight: 700 }}>• ৳{Number((displayPrice || 0) * (qty || 1)).toLocaleString()}</span>
        </button>
      </div>

      <div className="pdp-trust-strip">
        <div className="pdp-trust-item">
          <div className="pdp-trust-icon">🌿</div>
          <div className="pdp-trust-text">Chemical-Free<br />Guaranteed</div>
        </div>
        <div className="pdp-trust-item">
          <div className="pdp-trust-icon">⚡</div>
          <div className="pdp-trust-text">Same-Day<br />Dispatch</div>
        </div>
        <div className="pdp-trust-item">
          <div className="pdp-trust-icon">🔄</div>
          <div className="pdp-trust-text">100% Refund<br />Guarantee</div>
        </div>
      </div>


      <div className="pdp-delivery-card">
        <div className="pdp-delivery-title">🚚 Delivery Info</div>
        <div className="pdp-delivery-row">
          <span className="pdp-delivery-icon">⚡</span>
          <span className="pdp-delivery-text"><strong>Same-Day Dispatch</strong> — order before 12pm</span>

        </div>

        <div className="pdp-delivery-row">
          <span className="pdp-delivery-icon">📦</span>
          <span className="pdp-delivery-text"><strong>Eco-Friendly Packaging</strong> — no plastic</span>
        </div>
      </div>


    </div>
  );
}
