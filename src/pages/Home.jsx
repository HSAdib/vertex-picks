import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, getDoc, query, where, limit } from 'firebase/firestore';
import { Share2, Camera, Globe, MessageCircle, Heart } from 'lucide-react';
import { db } from '../firebaseConfig';
import { toast } from 'react-hot-toast';
import { useWishlist } from '../hooks/useWishlist';
import { sanitizeHTML } from '../utils/sanitizeHTML';

export default function Home() {
  const navigate = useNavigate();
  const [notifyText, setNotifyText] = useState('Notify Me');
  const [notifyBg, setNotifyBg] = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [whatsappVal, setWhatsappVal] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const { toggleWishlist, isInWishlist } = useWishlist();
  
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  
  const [footerSettings, setFooterSettings] = useState({
    footerDesc: "Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.",
    contactPhone: "+880 1581-221084",
    contactEmail: "hello@vertexpicks.com",
    contactAddress: "Rajshahi, Bangladesh"
  });

  const [uiSettings, setUiSettings] = useState({
    // Marquee
    marqueeItems: [
      '🚚 Free delivery on ৳1,500+',
      '🌿 100% tree-bagged & chemical-free',
      '⚡ Same-day dispatch before 12pm',
      '🎁 Eid gift boxes available',
      '🔄 Full refund if not satisfied',
      '⭐ 4.9/5 rating from 500+ customers'
    ],
    // Hero Copy
    heroBadge1: '🥭 Season 2026',
    heroBadge2: '🌿 100% Chemical-Free',
    heroBadge3: '⚡ Same-Day Dispatch',
    heroTitleLine1: 'The Finest Rajshahi',
    heroTitleLine2: 'Mangoes. Delivered',
    heroTitleLine3: 'Fresh.',
    heroSubtitle: 'Hand-picked, tree-bagged, and shipped within hours. No middlemen, no cold storage — just pure mango perfection from Rajshahi to your door.',
    heroTrust1: '⭐ <strong>4.9/5</strong> from 500+ reviews',
    heroTrust2: '📦 <strong>2,000+</strong> orders shipped',
    heroTrust3: '🔄 <strong>100%</strong> refund guarantee',
    // Promise
    promiseTitle: '✦ The Vertex <span>Promise</span>',
    promiseFeature1Title: 'Chemical-Free',
    promiseFeature1Text: 'Tree-bagged from the start. Zero pesticides, zero artificial ripening.',
    promiseFeature1Icon: '🌿',
    promiseFeature2Title: 'Same-Day Dispatch',
    promiseFeature2Text: 'Picked at dawn, shipped by noon. Freshness measured in hours, not days.',
    promiseFeature2Icon: '⚡',
    promiseFeature3Title: 'A-Grade Only',
    promiseFeature3Text: 'We reject 40% of fruit. Only perfect size, colour, and sweetness passes.',
    promiseFeature3Icon: '🏅',
    promiseFeature4Title: 'Full Refund',
    promiseFeature4Text: 'Not happy? 100% refund, no questions asked. That\'s our commitment.',
    promiseFeature4Icon: '🔄'
  });

  // Fetch footer settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (snap.exists()) {
          const data = snap.data();
          setFooterSettings(prev => ({
            ...prev,
            footerDesc: data.footerDesc || prev.footerDesc,
            contactPhone: data.contactPhone || prev.contactPhone,
            contactEmail: data.contactEmail || prev.contactEmail,
            contactAddress: data.contactAddress || prev.contactAddress
          }));
          
          setUiSettings(prev => ({
            ...prev,
            marqueeItems: data.marqueeItems || prev.marqueeItems,
            heroBadge1: data.heroBadge1 !== undefined ? data.heroBadge1 : prev.heroBadge1,
            heroBadge2: data.heroBadge2 !== undefined ? data.heroBadge2 : prev.heroBadge2,
            heroBadge3: data.heroBadge3 !== undefined ? data.heroBadge3 : prev.heroBadge3,
            heroTitleLine1: data.heroTitleLine1 !== undefined ? data.heroTitleLine1 : prev.heroTitleLine1,
            heroTitleLine2: data.heroTitleLine2 !== undefined ? data.heroTitleLine2 : prev.heroTitleLine2,
            heroTitleLine3: data.heroTitleLine3 !== undefined ? data.heroTitleLine3 : prev.heroTitleLine3,
            heroSubtitle: data.heroSubtitle !== undefined ? data.heroSubtitle : prev.heroSubtitle,
            heroTrust1: data.heroTrust1 !== undefined ? data.heroTrust1 : prev.heroTrust1,
            heroTrust2: data.heroTrust2 !== undefined ? data.heroTrust2 : prev.heroTrust2,
            heroTrust3: data.heroTrust3 !== undefined ? data.heroTrust3 : prev.heroTrust3,
            promiseTitle: data.promiseTitle !== undefined ? data.promiseTitle : prev.promiseTitle,
            promiseFeature1Title: data.promiseFeature1Title !== undefined ? data.promiseFeature1Title : prev.promiseFeature1Title,
            promiseFeature1Text: data.promiseFeature1Text !== undefined ? data.promiseFeature1Text : prev.promiseFeature1Text,
            promiseFeature1Icon: data.promiseFeature1Icon !== undefined ? data.promiseFeature1Icon : prev.promiseFeature1Icon,
            promiseFeature2Title: data.promiseFeature2Title !== undefined ? data.promiseFeature2Title : prev.promiseFeature2Title,
            promiseFeature2Text: data.promiseFeature2Text !== undefined ? data.promiseFeature2Text : prev.promiseFeature2Text,
            promiseFeature2Icon: data.promiseFeature2Icon !== undefined ? data.promiseFeature2Icon : prev.promiseFeature2Icon,
            promiseFeature3Title: data.promiseFeature3Title !== undefined ? data.promiseFeature3Title : prev.promiseFeature3Title,
            promiseFeature3Text: data.promiseFeature3Text !== undefined ? data.promiseFeature3Text : prev.promiseFeature3Text,
            promiseFeature3Icon: data.promiseFeature3Icon !== undefined ? data.promiseFeature3Icon : prev.promiseFeature3Icon,
            promiseFeature4Title: data.promiseFeature4Title !== undefined ? data.promiseFeature4Title : prev.promiseFeature4Title,
            promiseFeature4Text: data.promiseFeature4Text !== undefined ? data.promiseFeature4Text : prev.promiseFeature4Text,
            promiseFeature4Icon: data.promiseFeature4Icon !== undefined ? data.promiseFeature4Icon : prev.promiseFeature4Icon
          }));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();
  }, []);

  const handleNotify = async () => {
    const cleanEmail = emailVal.trim();
    const cleanWhatsapp = whatsappVal.trim();
    
    if (!cleanEmail && !cleanWhatsapp) {
      toast.error('Please enter at least an email or WhatsApp number.');
      return;
    }

    try {
      setNotifyText('Sending...');
      await addDoc(collection(db, 'leads'), {
        email: cleanEmail || null,
        whatsapp: cleanWhatsapp || null,
        createdAt: new Date().toISOString()
      });
      toast.success('🎉 Welcome to early access list!');
      setNotifyText('✓ Subscribed!');
      setNotifyBg('var(--green)');
      setEmailVal('');
      setWhatsappVal('');
      setTimeout(() => {
        setNotifyText('Notify Me');
        setNotifyBg('');
      }, 4000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to register subscription. Please try again.');
      setNotifyText('Notify Me');
    }
  };

  

  // Fetch reviews from Firestore
  useEffect(() => {
    const loadReviews = async () => {
      try {
        // Fix #10: removed dual orderBy to avoid requiring a Firestore composite
        // index (where + two orderBy clauses). Fetch published reviews and sort
        // client-side instead — same result, no index needed.
        const q = query(
          collection(db, 'reviews'),
          where('status', '==', 'published'),
          limit(10)
        );
        const snap = await getDocs(q);
        const fetchedReviews = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            if ((b.rating || 5) !== (a.rating || 5)) return (b.rating || 5) - (a.rating || 5);
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          })
          .slice(0, 3);
        setReviews(fetchedReviews);
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    };
    loadReviews();
  }, []);

  // Fetch featured products from Firestore
  useEffect(() => {
    const loadFeatured = async () => {
      try {
        const snap = await getDocs(collection(db, 'mangoes'));
        const list = snap.docs
          .filter(d => !['STORE_SECTIONS', 'STORE_SETTINGS', 'NAVBAR_TABS', 'CATEGORIES'].includes(d.id))
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.featured === true)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .slice(0, 4);
        setFeaturedProducts(list);
      } catch (err) {
        console.error('Failed to load featured products:', err);
      } finally {
        setFeaturedLoading(false);
      }
    };
    loadFeatured();
  }, []);

  return (
    <div style={{ paddingTop: 'var(--nav-height, 88px)' }}>

      {/* HERO */}
      <section className="hero-banner">
        <div className="hero-left">
          <div className="hero-badge-row">
            <span className="badge badge-orange">{uiSettings.heroBadge1}</span>
            <span className="badge badge-green">{uiSettings.heroBadge2}</span>
            <span className="badge badge-gold">{uiSettings.heroBadge3}</span>
          </div>
          <h1 className="hero-h1">
            {uiSettings.heroTitleLine1.includes('<em>') ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTitleLine1) }} />
            ) : (
              uiSettings.heroTitleLine1
            )}
            <br />
            {uiSettings.heroTitleLine2.includes('<em>') ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTitleLine2) }} />
            ) : (
              uiSettings.heroTitleLine2
            )}
            <br />
            {uiSettings.heroTitleLine3.includes('<em>') ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTitleLine3) }} />
            ) : (
              uiSettings.heroTitleLine3
            )}
          </h1>
          <p className="hero-sub">
            {uiSettings.heroSubtitle}
          </p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={() => navigate('/shop')}>🛒 Shop Mangoes</button>
            <button className="btn-outline" onClick={() => document.getElementById('why-section')?.scrollIntoView({ behavior: 'smooth' })}>✦ Our Promise</button>
          </div>
          <div className="hero-trust">
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTrust1) }} />
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTrust2) }} />
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.heroTrust3) }} />
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-img-wrap">
            <div className="hero-circle">🥭</div>
            <div className="hero-float-card c1">🌿 Tree-Bagged</div>
            <div className="hero-float-card c2">⚡ Ships Today</div>
            <div className="hero-float-card c3">🏅 A-Grade Only</div>
          </div>
        </div>
      </section>

      {/* CATEGORY PILLS */}
      <div className="cat-section">
        <div className="cat-scroll">
          <div className="cat-pill active" onClick={() => navigate('/shop')}>🥭 All Varieties</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Himsagar')}>✨ Himsagar</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Langra')}>💚 Langra</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Fazli')}>🟠 Fazli</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Gopalbhog')}>⭐ Gopalbhog</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Amrapali')}>🌸 Amrapali</div>
          <div className="cat-pill" onClick={() => navigate('/shop?category=Gift')}>🎁 Gift Boxes</div>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[...uiSettings.marqueeItems, ...uiSettings.marqueeItems].map((text, i) => (
            <div key={i} className="marquee-item">{text} <span className="dot"></span></div>
          ))}
        </div>
      </div>

      {/* FEATURED PRODUCTS — Live from Firestore */}
      <div className="home-section">
        <div className="sec-head">
          <div className="sec-title">🔥 Featured <span>Mangoes</span></div>
          <span className="sec-link" onClick={() => navigate('/shop')}>View All →</span>
        </div>
        <div className="products-row">
          {featuredLoading ? (
            /* Skeleton placeholders */
            [1,2,3,4].map(i => (
              <div key={i} className="product-card" style={{ pointerEvents: 'none' }}>
                <div className="pc-img" style={{ background: 'var(--gray2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                <div className="pc-body">
                  <div style={{ height: 14, width: '60%', background: 'var(--gray2)', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '40%', background: 'var(--gray2)', borderRadius: 8, animation: 'pulse 1.4s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : featuredProducts.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--gray4)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🥭</div>
              <p style={{ fontWeight: 600 }}>No featured products yet — visit Admin → Products to set some!</p>
            </div>
          ) : (
            featuredProducts.map(p => (
              <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
                <div className="pc-img">
                  {p.discountPrice && (
                    <div className="pc-discount-badge">Sale</div>
                  )}
                  {(p.images?.[0] || p.image)
                    ? <img src={p.images?.[0] || p.image} alt={p.name} />
                    : <span style={{ fontSize: '3.5rem' }}>🥭</span>
                  }
                </div>
                <div className="pc-body">
                  <div className="pc-name">{p.name}</div>
                  <div className="pc-sub" style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.75rem', color: '#888888', marginBottom: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <span>📦 {p.fixedWeight || 1}kg Box</span>
                    <span> · 🌱 {p.season || 'Peak'} Season</span>
                  </div>
                  <div className="pc-rating">
                    <span className="stars">★★★★★</span> 5.0 <span>(—)</span>
                  </div>
                  <div className="pc-price-row">
                    <div className="pc-price">
                      ৳{Number(p.discountPrice || p.price || 0).toLocaleString()} <span className="unit">/ {p.fixedWeight || 1}kg box</span>
                      {p.discountPrice && (
                        <>
                          <span className="old">৳{p.price}</span>
                          {Number(p.price) > Number(p.discountPrice) && (
                            <span className="pc-savings-pill">Save ৳{Number(p.price) - Number(p.discountPrice)}</span>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      style={{ 
                        background: 'var(--gray1)', border: 'none', cursor: 'pointer',
                        fontSize: '1.2rem', color: isInWishlist(p.id) ? 'var(--primary)' : 'var(--gray4)',
                        width: '32px', height: '32px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', marginTop: '-4px'
                      }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(p); }}
                      title={isInWishlist(p.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = isInWishlist(p.id) ? 'var(--primary)' : 'var(--gray4)'}
                    >
                      <Heart size={18} fill={isInWishlist(p.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PROMO BANNERS */}
      <div className="home-section bg-light">
        <div className="banner-grid">
          <div className="banner-card bc-orange">
            <div className="bc-label">Limited Stock</div>
            <div className="bc-title">Himsagar<br />Pre-Order Open</div>
            <button className="bc-btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }} onClick={() => navigate('/shop')}>Order Now →</button>
            <div className="bc-emoji">🥭</div>
          </div>
          <div className="banner-card bc-green">
            <div className="bc-label">Perfect for Gifting</div>
            <div className="bc-title">Eid Gift<br />Boxes 2026</div>
            <button className="bc-btn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => navigate('/shop')}>Explore →</button>
            <div className="bc-emoji">🎁</div>
          </div>
        </div>
      </div>

      {/* FEATURES / PROMISE */}
      <div className="home-section bg-light" id="why-section">
        <div className="sec-head">
          <div className="sec-title">
            {uiSettings.promiseTitle.includes('<span>') ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(uiSettings.promiseTitle) }} />
            ) : (
              uiSettings.promiseTitle
            )}
          </div>
        </div>
        <div className="features-row">
          <div className="feat-card">
            <div className="feat-icon">{uiSettings.promiseFeature1Icon}</div>
            <div className="feat-title">{uiSettings.promiseFeature1Title}</div>
            <div className="feat-text">{uiSettings.promiseFeature1Text}</div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">{uiSettings.promiseFeature2Icon}</div>
            <div className="feat-title">{uiSettings.promiseFeature2Title}</div>
            <div className="feat-text">{uiSettings.promiseFeature2Text}</div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">{uiSettings.promiseFeature3Icon}</div>
            <div className="feat-title">{uiSettings.promiseFeature3Title}</div>
            <div className="feat-text">{uiSettings.promiseFeature3Text}</div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">{uiSettings.promiseFeature4Icon}</div>
            <div className="feat-title">{uiSettings.promiseFeature4Title}</div>
            <div className="feat-text">{uiSettings.promiseFeature4Text}</div>
          </div>
        </div>
      </div>

      {/* REVIEWS */}
      <div className="home-section">
        <div className="sec-head"><div className="sec-title">💬 What Customers <span>Say</span></div></div>
        <div className="reviews-row">
          {reviewsLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="review-card" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                <div style={{ width: '40%', height: 16, background: 'var(--gray2)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s infinite' }}></div>
                <div style={{ width: '100%', height: 40, background: 'var(--gray2)', borderRadius: 4, marginBottom: 16, animation: 'pulse 1.5s infinite' }}></div>
                <div className="rv-author">
                  <div className="rv-avatar" style={{ background: 'var(--gray2)' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 12, background: 'var(--gray2)', borderRadius: 4, marginBottom: 4 }}></div>
                    <div style={{ width: '40%', height: 10, background: 'var(--gray2)', borderRadius: 4 }}></div>
                  </div>
                </div>
              </div>
            ))
          ) : reviews.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--gray4)', fontWeight: 600 }}>
              No reviews yet. Check back soon!
            </div>
          ) : (
            reviews.map(rv => (
              <div key={rv.id} className="review-card">
                <div className="rv-stars">{'★'.repeat(rv.rating || 5)}{'☆'.repeat(5 - (rv.rating || 5))}</div>
                <div className="rv-text">"{rv.text || rv.reviewText}"</div>
                <div className="rv-author">
                  <div className="rv-avatar">{rv.authorName ? rv.authorName.charAt(0).toUpperCase() : (rv.customerName ? rv.customerName.charAt(0).toUpperCase() : 'U')}</div>
                  <div>
                    <div className="rv-name">{rv.authorName || rv.customerName || 'Verified Customer'}</div>
                    <div className="rv-loc">📍 {rv.location || rv.city || 'Bangladesh'}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* NEWSLETTER */}
      <div className="newsletter">
        <div className="nl-title">🥭 Get Early Access</div>
        <div className="nl-sub">Be first to know when new season stock drops. No spam, ever.</div>
        <div className="nl-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 400 }}>
          <input
            type="email"
            className="nl-input"
            placeholder="Your email address (Optional)"
            value={emailVal}
            onChange={e => setEmailVal(e.target.value)}
            style={{ width: '100%' }}
          />
          <input
            type="tel"
            className="nl-input"
            placeholder="Your WhatsApp number"
            value={whatsappVal}
            onChange={e => setWhatsappVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNotify()}
            style={{ width: '100%' }}
          />
          <button
            className="nl-btn"
            style={{ ...(notifyBg ? { background: notifyBg } : {}), width: '100%', borderRadius: 100 }}
            onClick={handleNotify}
          >
            {notifyText}
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo">Vertex<span>Picks</span></div>
            <div className="footer-desc">{footerSettings.footerDesc}</div>
            <div className="footer-socials">
              <div className="fsoc"><Globe size={18} /></div>
              <div className="fsoc"><Camera size={18} /></div>
              <div className="fsoc"><Share2 size={18} /></div>
              <div className="fsoc"><MessageCircle size={18} /></div>
            </div>
          </div>
          <div className="footer-col">
            <h5>Shop</h5>
            <ul>
              <li><Link to="/shop?category=Himsagar">Himsagar</Link></li>
              <li><Link to="/shop?category=Langra">Langra</Link></li>
              <li><Link to="/shop?category=Fazli">Fazli</Link></li>
              <li><Link to="/shop?category=Gopalbhog">Gopalbhog</Link></li>
              <li><Link to="/shop?category=Gift Box">Gift Boxes</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <ul>
              <li><Link to="/shop">How It Works</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Contact</h5>
            <ul>
              <li>📞 {footerSettings.contactPhone}</li>
              <li>📧 {footerSettings.contactEmail}</li>
              <li>📍 {footerSettings.contactAddress}</li>
              <li><Link to="/shop" style={{ color: 'var(--primary)', fontWeight: '700' }}>Order Now →</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Vertex Picks. All rights reserved.</span>
          <span>Made with 🥭 in Rajshahi</span>
        </div>
      </footer>
    </div>
  );
}
