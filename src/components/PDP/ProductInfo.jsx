import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast } from 'react-hot-toast';

export default function ProductInfo({ product, qty, setQty }) {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [activePackIndex, setActivePackIndex] = useState(0);
  const [isAdded, setIsAdded] = useState(false);

  const packs = product.packs || [
    { name: '1 Dozen', price: product.price },
    { name: '½ Dozen', price: Math.round(product.price * 0.55) },
    { name: '2 Kg', price: Math.round(product.price * 0.38) }
  ];

  const selectedPrice = packs[activePackIndex].price;

  // B2 fix: actually add the product to cart
  const handleAddToCart = () => {
    if (!product.inStock) return;
    addToCart(product.id, qty);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  // B17 fix: Buy Now → add to cart + navigate
  const handleBuyNow = () => {
    if (!product.inStock) return;
    addToCart(product.id, qty);
    navigate('/checkout');
  };


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
            {'★'.repeat(product.rating) + '☆'.repeat(5 - product.rating)}
          </span>
          <span className="pdp-rating-num" id="pdp-rating-num">{product.rating}.0</span>
          <span
            className="pdp-review-count"
            id="pdp-review-count"
            onClick={() => document.getElementById('pdp-tab-btn-reviews')?.click()}
          >
            ({product.reviews} reviews)
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
            ৳{packs[activePackIndex].price.toLocaleString()}
          </div>
          <span className="pdp-price-unit" id="pdp-price-unit">per {product.unit}</span>
          {product.oldPrice && (
            <div id="pdp-save-badge">
              <span className="pdp-price-save">
                🎉 You save <span id="pdp-save-amount">৳{product.oldPrice - packs[activePackIndex].price}</span>
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {product.oldPrice && (
            <div className="pdp-price-old" id="pdp-price-old">
              ৳{product.oldPrice.toLocaleString()}
            </div>
          )}
          <div style={{ fontSize: '.72rem', color: 'var(--gray4)', marginTop: '.3rem' }}>
            Inclusive of all taxes
          </div>
        </div>
      </div>

      <div className="pdp-section-label">Choose Pack Size</div>
      <div className="pdp-pack-options" id="pdp-pack-options">
        {packs.map((pack, index) => (
          <div
            key={index}
            className={`pdp-pack-opt ${activePackIndex === index ? 'active' : ''}`}
            onClick={() => setActivePackIndex(index)}
          >
            <div className="pdp-pack-opt-name">{pack.name}</div>
            <div className="pdp-pack-opt-price">৳{pack.price.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="pdp-section-label">Quantity</div>
      <div className="pdp-buy-row">
        <div className="pdp-qty">
          <button className="pdp-qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <div className="pdp-qty-val" id="pdp-qty-val">{qty}</div>
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
          ⚡ Buy Now
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
          <span className="pdp-delivery-icon">📍</span>
          <span className="pdp-delivery-text"><strong>Dhaka Metro</strong> — ৳60 delivery fee</span>
        </div>
        <div className="pdp-delivery-row">
          <span className="pdp-delivery-icon">📦</span>
          <span className="pdp-delivery-text"><strong>Eco-Friendly Packaging</strong> — no plastic</span>
        </div>
      </div>

      <div className="pdp-farmer-card">
        <div className="pdp-farmer-avatar">🧑‍🌾</div>
        <div>
          <div className="pdp-farmer-name">{product.farmerName || 'Abdul Karim'} — Lead Farmer</div>
          <div className="pdp-farmer-sub">{product.farmerSub || 'Rajshahi Orchards · 15+ years growing premium mangoes'}</div>
          <div className="pdp-farmer-badge">✅ Verified Farmer Partner</div>
        </div>
      </div>
    </div>
  );
}
