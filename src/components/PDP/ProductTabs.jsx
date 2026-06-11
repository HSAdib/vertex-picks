import { useState } from 'react';
import FAQSection from './FAQSection';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function ProductTabs({ product, onReviewSubmit, isSubmitting, hasPurchased, purchaseCheckDone, hasAlreadyReviewed }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [wrStar, setWrStar] = useState(5);
  const [wrTitle, setWrTitle] = useState('');
  const [wrBody, setWrBody] = useState('');

  const reviews = product.reviewsList || [];

  const handleReviewSubmit = () => {
    if (onReviewSubmit) {
      onReviewSubmit({ rating: wrStar, title: wrTitle, text: wrBody });
      setWrTitle('');
      setWrBody('');
      setWrStar(5);
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'verified') return r.isVerified;
    return r.rating === parseInt(reviewFilter);
  });

  return (
    <div className="pdp-tabs-section">
      <div className="pdp-tabs-nav">
        <button
          className={`pdp-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          id="pdp-tab-btn-details"
          onClick={() => setActiveTab('details')}
        >
          📋 Product Details
        </button>
        <button
          className={`pdp-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          id="pdp-tab-btn-reviews"
          onClick={() => setActiveTab('reviews')}
        >
          ⭐ Reviews <span className="tab-count" id="pdp-tab-review-count">{product.reviews}</span>
        </button>
        <button
          className={`pdp-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
          id="pdp-tab-btn-faq"
          onClick={() => setActiveTab('faq')}
        >
          ❓ FAQ
        </button>
      </div>

      <div className={`pdp-tab-panel ${activeTab === 'details' ? 'active' : ''}`} id="pdp-panel-details">
        <div className="pdp-details-grid">
          <div>
            <table className="pdp-spec-table" id="pdp-spec-table">
              <tbody>
                <tr><td>Variety</td><td id="spec-variety">{product.variety}</td></tr>
                <tr><td>Origin</td><td>Rajshahi, Bangladesh</td></tr>
                <tr><td>Season</td><td id="spec-season">{product.season} (Jun–Jul)</td></tr>
                <tr><td>Pack Size</td><td id="spec-weight">{product.weight}</td></tr>
                <tr><td>Sweetness</td><td>⭐⭐⭐⭐⭐ Very High</td></tr>
                <tr><td>Fiber</td><td>Fibreless</td></tr>
                <tr><td>Preservation</td><td>No chemicals. Tree-bagged.</td></tr>
                <tr><td>Shelf Life</td><td>5–7 days at room temp</td></tr>
                <tr><td>Best For</td><td>Eating fresh, juicing, desserts</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="pdp-highlights">
              <div className="pdp-highlight-item"><div className="hi-dot">✓</div>Handpicked at peak ripeness for maximum sweetness and aroma</div>
              <div className="pdp-highlight-item"><div className="hi-dot">✓</div>Tree-bagged from early growth — zero pesticides, zero artificial chemicals</div>
              <div className="pdp-highlight-item"><div className="hi-dot">✓</div>Sorted and graded by hand — only A-grade fruit ships</div>
              <div className="pdp-highlight-item"><div className="hi-dot">✓</div>Eco-friendly packaging — no styrofoam, no single-use plastic</div>
              <div className="pdp-highlight-item"><div className="hi-dot">✓</div>Dispatched within hours of picking — freshness guaranteed</div>
            </div>
            <div className="pdp-how-section">
              <div className="pdp-how-title">🌿 How We Grow & Ship</div>
              <div className="pdp-steps">
                <div className="pdp-step"><div className="pdp-step-num">1</div>Mangoes are tree-bagged at young stage to prevent pesticide exposure</div>
                <div className="pdp-step"><div className="pdp-step-num">2</div>Hand-picked at dawn when sugar content is highest</div>
                <div className="pdp-step"><div className="pdp-step-num">3</div>Graded for size, colour, and aroma — only A-grade passes</div>
                <div className="pdp-step"><div className="pdp-step-num">4</div>Packed in eco-friendly boxes and dispatched same morning</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`pdp-tab-panel ${activeTab === 'reviews' ? 'active' : ''}`} id="pdp-panel-reviews">
        <div className="reviews-layout">
          <div className="rating-summary-card">
            <div className="rs-big-num" id="rs-big-num">{product.rating}.0</div>
            <div className="rs-stars" id="rs-stars">
              {'★'.repeat(product.rating) + '☆'.repeat(5 - product.rating)}
            </div>
            <div className="rs-count" id="rs-count">Based on {product.reviews} reviews</div>
            <div className="rs-bars">
              {/* B21 fix: compute from real data */}
              {[5, 4, 3, 2, 1].map(star => {
                // prefer admin-set breakdown, fallback to counting reviewsList
                const breakdown = product.stats?.ratingBreakdown;
                const count = breakdown
                  ? (breakdown[star] || 0)
                  : reviews.filter(r => r.rating === star).length;
                const total = breakdown
                  ? Object.values(breakdown).reduce((s, v) => s + v, 0)
                  : reviews.length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={star} className="rs-bar-row">
                    <span className="rs-bar-label">{star}★</span>
                    <div className="rs-bar-track"><div className="rs-bar-fill" style={{ width: `${pct}%` }} /></div>
                    <span className="rs-bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="write-review-card">
              <div className="wr-title">✍️ Write a Review</div>
              <div className="wr-sub">Share your experience with this product</div>

              {/* Gate: not logged in */}
              {!user ? (
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#FFF7ED', borderRadius: 12, border: '1.5px solid #FED7AA', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>🔒</div>
                  <p style={{ fontSize: '.83rem', fontWeight: 600, color: '#9A3412', marginBottom: '.75rem' }}>You need to be logged in to write a review.</p>
                  <Link to="/login" style={{ display: 'inline-block', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '.8rem', padding: '.5rem 1.25rem', borderRadius: 100, textDecoration: 'none' }}>Log In</Link>
                </div>
              ) : !purchaseCheckDone ? (
                <div style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', color: 'var(--gray4)', fontSize: '.82rem' }}>Checking purchase history…</div>
              ) : hasAlreadyReviewed ? (
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#F0FDF4', borderRadius: 12, border: '1.5px solid #BBF7D0', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>✅</div>
                  <p style={{ fontSize: '.83rem', fontWeight: 600, color: '#166534' }}>You've already reviewed this product. Thank you!</p>
                </div>
              ) : !hasPurchased ? (
                <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#F8FAFC', borderRadius: 12, border: '1.5px dashed var(--gray3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>🥭</div>
                  <p style={{ fontSize: '.83rem', fontWeight: 700, color: 'var(--dark)', marginBottom: '.4rem' }}>Verified Purchase Required</p>
                  <p style={{ fontSize: '.78rem', color: 'var(--gray4)', marginBottom: '.75rem', lineHeight: 1.55 }}>Only customers who have received a delivery can leave a review. This keeps reviews honest and trustworthy.</p>
                  <Link to="/shop" style={{ display: 'inline-block', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: '.8rem', padding: '.5rem 1.25rem', borderRadius: 100, textDecoration: 'none' }}>Shop Now →</Link>
                </div>
              ) : (
                <>
                  <div className="wr-stars" id="wr-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`wr-star ${wrStar >= star ? 'active' : ''}`}
                        onClick={() => setWrStar(star)}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="wr-grid">
                    <div className="form-group"><label className="form-label">Review Title</label><input type="text" className="form-input" placeholder="Absolutely amazing!" value={wrTitle} onChange={e => setWrTitle(e.target.value)} id="wr-title-inp" /></div>
                    <div className="form-group wr-full"><label className="form-label">Your Review</label><textarea className="form-input" rows="3" placeholder="Tell others what you thought..." value={wrBody} onChange={e => setWrBody(e.target.value)} id="wr-body" style={{resize:'vertical'}}></textarea></div>
                  </div>
                  <div className="wr-actions">
                    <button className="btn-primary" onClick={handleReviewSubmit} disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                    <span style={{fontSize:'.75rem', color:'var(--gray4)'}}>* Reviews are published after admin moderation</span>
                  </div>
                </>
              )}
            </div>
            <div className="review-filter-row">
              <span style={{fontSize:'.8rem', fontWeight:600, color:'var(--gray4)'}}>Filter:</span>
              <div className={`rf-chip ${reviewFilter === 'all' ? 'active' : ''}`} onClick={() => setReviewFilter('all')}>All</div>
              <div className={`rf-chip ${reviewFilter === '5' ? 'active' : ''}`} onClick={() => setReviewFilter('5')}>★★★★★</div>
              <div className={`rf-chip ${reviewFilter === '4' ? 'active' : ''}`} onClick={() => setReviewFilter('4')}>★★★★</div>
              <div className={`rf-chip ${reviewFilter === '3' ? 'active' : ''}`} onClick={() => setReviewFilter('3')}>★★★</div>
              <div className={`rf-chip ${reviewFilter === 'verified' ? 'active' : ''}`} onClick={() => setReviewFilter('verified')}>✅ Verified</div>
            </div>
            <div className="review-list" id="pdp-review-list">
              {filteredReviews.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray4)' }}>No reviews matching this filter.</div>
              ) : (
                filteredReviews.map((ri, idx) => (
                  <div key={idx} className="review-item">
                    <div className="ri-head">
                      <div className="ri-author-row">
                        <div className="ri-avatar">{ri.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="ri-name">{ri.name}</div>
                          <div className="ri-meta">
                            {ri.isVerified && <span className="ri-verified">✅ Verified Purchase</span>}
                            <span>📍 {ri.location || 'Bangladesh'}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div className="ri-stars">
                          {'★'.repeat(ri.rating) + '☆'.repeat(5 - ri.rating)}
                        </div>
                        <div className="ri-date">{ri.date}</div>
                      </div>
                    </div>
                    <div className="ri-title">{ri.title}</div>
                    <div className="ri-body">{ri.body}</div>
                    {ri.images && ri.images.length > 0 && (
                      <div className="ri-images">
                        {ri.images.map((img, i) => <div key={i} className="ri-img">{img}</div>)}
                      </div>
                    )}
                    <div className="ri-footer">
                      <div className="ri-helpful">
                        Helpful? 
                        <button 
                          className="ri-helpful-btn" 
                          onClick={(e) => {
                            e.target.textContent = `👍 ${ri.helpful + 1}`;
                            e.target.style.color = 'var(--primary)';
                          }}
                        >
                          👍 {ri.helpful}
                        </button>
                      </div>
                      <span className="ri-report" onClick={() => alert('Review reported. Thanks!')}>Report</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`pdp-tab-panel ${activeTab === 'faq' ? 'active' : ''}`} id="pdp-panel-faq">
        {activeTab === 'faq' && <FAQSection />}
      </div>
    </div>
  );
}
