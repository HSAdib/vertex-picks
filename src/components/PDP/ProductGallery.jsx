import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useWishlist } from '../../hooks/useWishlist';

export default function ProductGallery({ product }) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const showToast = (msg) => {
    toast.success(msg);
  };

  const thumbs = product.images || [];

  return (
    <div className="pdp-gallery">
      <div className="pdp-main-img" id="pdp-main-img">
        {thumbs.length > 0 ? (
          <img 
            src={thumbs[activeImageIndex] || thumbs[0]} 
            alt="Product Main" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray1)', color: 'var(--gray4)', fontSize: '1rem', fontWeight: 600 }}>
            No Image Available
          </div>
        )}
        <div className="pdp-badge-overlay" id="pdp-badge-overlay">
          {product.badge && (
            <span
              className={`badge badge-${
                product.badge === 'Best Seller'
                  ? 'orange'
                  : product.badge === 'Rare' || product.badge === 'Gift'
                  ? 'gold'
                  : 'green'
              }`}
            >
              {product.badge}
            </span>
          )}
        </div>
        <button
          className="pdp-wishlist-btn"
          id="pdp-wishlist-btn"
          onClick={() => toggleWishlist(product)}
          style={{ color: isInWishlist(product.id) ? 'var(--primary)' : 'inherit' }}
        >
          {isInWishlist(product.id) ? '♥' : '♡'}
        </button>
      </div>

      {thumbs.length > 1 && (
        <div className="pdp-thumbnails" id="pdp-thumbnails">
          {thumbs.map((thumb, i) => (
            <div
              key={i}
              className={`pdp-thumb ${activeImageIndex === i ? 'active' : ''}`}
              onClick={() => setActiveImageIndex(i)}
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <img 
                src={thumb} 
                alt={`Thumbnail ${i}`} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
          ))}
        </div>
      )}

      <div className="pdp-share-row">
        <span className="pdp-share-label">Share:</span>
        <button className="pdp-share-btn" onClick={() => showToast('Link copied! 🔗')}>
          🔗
        </button>
        <button className="pdp-share-btn" onClick={() => showToast('Shared to Facebook!')}>
          📘
        </button>
        <button className="pdp-share-btn" onClick={() => showToast('Shared to WhatsApp!')}>
          💬
        </button>
        <button className="pdp-share-btn" onClick={() => showToast('Shared to Twitter!')}>
          🐦
        </button>
      </div>
    </div>
  );
}
