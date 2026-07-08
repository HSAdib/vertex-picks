import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { resolvePrice, getOptionLabel } from '../../utils/price';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../hooks/useWishlist';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../ui/Skeleton';

export default function ProductGrid({ filteredMangoes, viewMode, isLoading }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { isAdmin } = useAuth();
  
  const [quantities, setQuantities] = useState({});
  const [cardSelectedWeights, setCardSelectedWeights] = useState({});

  const updateQty = (id, amount) => {
    setQuantities(prev => {
      const newQty = Math.max(1, (prev[id] || 1) + amount);
      return { ...prev, [id]: newQty };
    });
  };

  const handleAddToCart = (mango) => {
    const qtyToAdd = quantities[mango.id] || 1;
    const selW = cardSelectedWeights[mango.id] || (mango.weightOptions && mango.weightOptions.length > 0 ? getOptionLabel(mango.weightOptions[0]) : `${mango.fixedWeight || 1}kg Box`);
    addToCart(mango.id, qtyToAdd, mango, selW);
    setQuantities(prev => ({ ...prev, [mango.id]: 1 }));
  };

  const handleGodModeEdit = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem('teleportEditId', id);
    navigate('/admin');
  };

  if (isLoading) {
    const skeletonCount = 8;
    return (
      <div className={`shop-grid${viewMode === 'list' ? ' list-view' : ''}`} id="shopGrid">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="product-card" style={{ padding: 0 }}>
            <Skeleton className="pc-img" style={{ height: '200px', width: '100%', borderRadius: '12px 12px 0 0' }} />
            <div className="pc-body">
              <Skeleton className="mb-2" style={{ height: '1.2rem', width: '80%' }} />
              <Skeleton className="mb-4" style={{ height: '0.8rem', width: '60%' }} />
              <Skeleton className="mb-2" style={{ height: '1.5rem', width: '40%' }} />
              <Skeleton style={{ height: '2.5rem', width: '100%', marginTop: 'auto', borderRadius: '100px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredMangoes.length === 0) {
    return (
      <div className="no-results">
        <div className="nr-icon">🥭</div>
        <p><strong>No mangoes found</strong><br />Try adjusting your filters or search term.</p>
      </div>
    );
  }

  return (
    <div className={`shop-grid${viewMode === 'list' ? ' list-view' : ''}`} id="shopGrid">
      {filteredMangoes.map(mango => {
        const mainImage = mango.images?.[0] || mango.image;
        const selW = cardSelectedWeights[mango.id] || (mango.weightOptions && mango.weightOptions.length > 0 ? getOptionLabel(mango.weightOptions[0]) : `${mango.fixedWeight || 1}kg Box`);
        const { displayPrice, oldPrice } = resolvePrice(mango, selW);
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
                      const optLabel = getOptionLabel(opt);
                      const isSelected = selW === optLabel;
                      return (
                        <button
                          key={optLabel}
                          type="button"
                          onClick={() => setCardSelectedWeights(prev => ({ ...prev, [mango.id]: optLabel }))}
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
                  <span>📦 {mango.weightOptions && mango.weightOptions.length === 1 ? getOptionLabel(mango.weightOptions[0]) : `${mango.fixedWeight || 1}kg Box`}</span>
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
  );
}
