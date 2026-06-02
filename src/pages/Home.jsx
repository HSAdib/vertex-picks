import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { toast } from 'react-hot-toast';

export default function Home() {
  const navigate = useNavigate();
  const [notifyText, setNotifyText] = useState('Notify Me');
  const [notifyBg, setNotifyBg] = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  
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
            heroBadge1: data.heroBadge1 || prev.heroBadge1,
            heroBadge2: data.heroBadge2 || prev.heroBadge2,
            heroBadge3: data.heroBadge3 || prev.heroBadge3,
            heroTitleLine1: data.heroTitleLine1 || prev.heroTitleLine1,
            heroTitleLine2: data.heroTitleLine2 || prev.heroTitleLine2,
            heroTitleLine3: data.heroTitleLine3 || prev.heroTitleLine3,
            heroSubtitle: data.heroSubtitle || prev.heroSubtitle,
            heroTrust1: data.heroTrust1 || prev.heroTrust1,
            heroTrust2: data.heroTrust2 || prev.heroTrust2,
            heroTrust3: data.heroTrust3 || prev.heroTrust3,
            promiseTitle: data.promiseTitle || prev.promiseTitle,
            promiseFeature1Title: data.promiseFeature1Title || prev.promiseFeature1Title,
            promiseFeature1Text: data.promiseFeature1Text || prev.promiseFeature1Text,
            promiseFeature1Icon: data.promiseFeature1Icon || prev.promiseFeature1Icon,
            promiseFeature2Title: data.promiseFeature2Title || prev.promiseFeature2Title,
            promiseFeature2Text: data.promiseFeature2Text || prev.promiseFeature2Text,
            promiseFeature2Icon: data.promiseFeature2Icon || prev.promiseFeature2Icon,
            promiseFeature3Title: data.promiseFeature3Title || prev.promiseFeature3Title,
            promiseFeature3Text: data.promiseFeature3Text || prev.promiseFeature3Text,
            promiseFeature3Icon: data.promiseFeature3Icon || prev.promiseFeature3Icon,
            promiseFeature4Title: data.promiseFeature4Title || prev.promiseFeature4Title,
            promiseFeature4Text: data.promiseFeature4Text || prev.promiseFeature4Text,
            promiseFeature4Icon: data.promiseFeature4Icon || prev.promiseFeature4Icon,
          }));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    loadSettings();
  }, []);

  const handleNotify = async () => {
    const clean = emailVal.trim();
    if (!clean) {
      toast.error('Please enter a valid phone number or email address.');
      return;
    }

    try {
      setNotifyText('Sending...');
      await addDoc(collection(db, 'leads'), {
        emailOrPhone: clean,
        createdAt: new Date().toISOString()
      });
      toast.success('🎉 Welcome to early access list!');
      setNotifyText('✓ Subscribed!');
      setNotifyBg('var(--green)');
      setEmailVal('');
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

  const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  // Fetch featured products from Firestore
  useEffect(() => {
    const loadFeatured = async () => {
      try {
        const snap = await getDocs(collection(db, 'mangoes'));
        const list = snap.docs
          .filter(d => !['STORE_SECTIONS', 'STORE_SETTINGS', 'NAVBAR_TABS'].includes(d.id))
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
              <span dangerouslySetInnerHTML={{ __html: uiSettings.heroTitleLine1 }} />
            ) : (
              uiSettings.heroTitleLine1
            )}
            <br />
            {uiSettings.heroTitleLine2.includes('<em>') ? (
              <span dangerouslySetInnerHTML={{ __html: uiSettings.heroTitleLine2 }} />
            ) : (
              uiSettings.heroTitleLine2
            )}
            <br />
            {uiSettings.heroTitleLine3.includes('<em>') ? (
              <span dangerouslySetInnerHTML={{ __html: uiSettings.heroTitleLine3 }} />
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
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: uiSettings.heroTrust1 }} />
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: uiSettings.heroTrust2 }} />
            <div className="trust-item" dangerouslySetInnerHTML={{ __html: uiSettings.heroTrust3 }} />
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
          <div className="cat-pill" onClick={() => navigate('/shop')}>✨ Himsagar</div>
          <div className="cat-pill" onClick={() => navigate('/shop')}>💚 Langra</div>
          <div className="cat-pill" onClick={() => navigate('/shop')}>🟠 Fazli</div>
          <div className="cat-pill" onClick={() => navigate('/shop')}>⭐ Gopalbhog</div>
          <div className="cat-pill" onClick={() => navigate('/shop')}>🌸 Amrapali</div>
          <div className="cat-pill" onClick={() => navigate('/shop')}>🎁 Gift Boxes</div>
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
              <div key={p.id} className="product-card" onClick={() => navigate('/shop')}>
                {p.discountPrice && (
                  <div className="tag-strip">
                    <span className="badge badge-orange">Sale</span>
                  </div>
                )}
                <button className="pc-wishlist" onClick={(e) => e.stopPropagation()}>♡</button>
                <div className="pc-img" style={{ background: 'linear-gradient(135deg,#FFF3C4,#FFE082)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(p.images?.[0] || p.image)
                    ? <img src={p.images?.[0] || p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '3rem' }}>🥭</span>
                  }
                </div>
                <div className="pc-body">
                  <div className="pc-name">{p.name}</div>
                  <div className="pc-sub">📍 Rajshahi · {p.season || 'Peak'} Season</div>
                  <div className="pc-rating">
                    <span className="stars">★★★★★</span> 5.0 <span>(—)</span>
                  </div>
                  <div className="pc-price-row">
                    <div className="pc-price">
                      ৳{(p.discountPrice || p.price).toLocaleString()} <span className="unit">/ {p.fixedWeight || 1}kg box</span>
                      {p.discountPrice && <span className="old">৳{p.price}</span>}
                    </div>
                    <button className="pc-add" onClick={(e) => { e.stopPropagation(); navigate('/shop'); }}>+</button>
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
              <span dangerouslySetInnerHTML={{ __html: uiSettings.promiseTitle }} />
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
          <div className="review-card">
            <div className="rv-stars">★★★★★</div>
            <div className="rv-text">"Honestly the best mangoes I've ever tasted. The Himsagar was divine — no strings, no chemicals, just pure sweetness."</div>
            <div className="rv-author">
              <div className="rv-avatar">R</div>
              <div><div className="rv-name">Rafiqul Islam</div><div className="rv-loc">📍 Dhaka</div></div>
            </div>
          </div>
          <div className="review-card">
            <div className="rv-stars">★★★★★</div>
            <div className="rv-text">"Ordered for Eid. The packaging was gorgeous and mangoes arrived in perfect condition. Will reorder every season."</div>
            <div className="rv-author">
              <div className="rv-avatar">N</div>
              <div><div className="rv-name">Nadia Chowdhury</div><div className="rv-loc">📍 Chattogram</div></div>
            </div>
          </div>
          <div className="review-card">
            <div className="rv-stars">★★★★★</div>
            <div className="rv-text">"Was skeptical about ordering mangoes online. Vertex changed that. Same-day dispatch was no joke at all."</div>
            <div className="rv-author">
              <div className="rv-avatar">S</div>
              <div><div className="rv-name">Sabbir Ahmed</div><div className="rv-loc">📍 Sylhet</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* NEWSLETTER */}
      <div className="newsletter">
        <div className="nl-title">🥭 Get Early Access</div>
        <div className="nl-sub">Be first to know when new season stock drops. No spam, ever.</div>
        <div className="nl-form">
          <input
            type="text"
            className="nl-input"
            placeholder="Your phone or email"
            value={emailVal}
            onChange={e => setEmailVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNotify()}
          />
          <button
            className="nl-btn"
            style={notifyBg ? { background: notifyBg } : {}}
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
              <div className="fsoc">📘</div>
              <div className="fsoc">📸</div>
              <div className="fsoc">🐦</div>
              <div className="fsoc">💬</div>
            </div>
          </div>
          <div className="footer-col">
            <h5>Shop</h5>
            <ul>
              <li><Link to="/shop">Himsagar</Link></li>
              <li><Link to="/shop">Langra</Link></li>
              <li><Link to="/shop">Fazli</Link></li>
              <li><Link to="/shop">Gopalbhog</Link></li>
              <li><Link to="/shop">Gift Boxes</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <ul>
              <li><Link to="/">About Us</Link></li>
              <li><Link to="/">How It Works</Link></li>
              <li><Link to="/">Blog</Link></li>
              <li><Link to="/">Reviews</Link></li>
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