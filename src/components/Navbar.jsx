import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useStore } from '../context/StoreContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchVal, setSearchVal] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [topBarText, setTopBarText] = useState('Season 2026 Open!');
  const [contactPhone, setContactPhone] = useState('+880 1581-221084');
  
  const { storeName } = useStore();
  const { cart } = useCart();
  const { user, isAdmin } = useAuth();
  const { isDark, setIsDark } = useTheme();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const currentCategory = queryParams.get('category');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 30) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'mangoes', 'CATEGORIES'));
        if (docSnap.exists() && docSnap.data().list) {
          setCategories(docSnap.data().list);
        } else {
          setCategories([]);
        }

        const settingsSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
          if (sData.topBarText !== undefined) {
            setTopBarText(sData.topBarText);
          }
          if (sData.contactPhone) {
            setContactPhone(sData.contactPhone);
          }
        }
      } catch (err) {
        console.error("Error loading navbar data", err);
      }
    };
    fetchData();
  }, []);

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  // Update document.title whenever storeName changes (real-time via StoreContext)
  useEffect(() => {
    document.title = `${storeName} | Premium Rajshahi Mangoes`;
  }, [storeName]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      navigate(`/shop?search=${encodeURIComponent(searchVal)}`);
    }
  };

  const firstWord = storeName.split(' ')[0] || '';
  const restWord = storeName.split(' ').slice(1).join(' ') || '';
  const shortLogo = storeName.split(' ').map(w => w.charAt(0)).join('').toUpperCase() || '';

  const cleanPhone = contactPhone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone;
  const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello! I need help with my ${storeName} order.`)}`;

  return (
    <div className="absolute top-0 left-0 w-full z-50 print:hidden">
      {/* TOPBAR */}
      <div className="topbar">
        <span>{topBarText}</span>
        <div className="topbar-links">
          <Link to="/profile">Track Order</Link>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">Help</a>
          <button 
            className="bg-transparent text-inherit p-0 font-medium hover:text-white border-none cursor-pointer outline-none" 
            onClick={() => alert("বাংলা সংস্করণ শীঘ্রই আসছে!")}
          >
            বাংলা
          </button>
        </div>
      </div>

      {/* NAVBAR */}
      <nav className={`navbar relative ${isScrolled ? 'scrolled' : ''}`}>
        <Link 
          to="/" 
          onClick={(e) => {
            // If already on '/', just prevent navigation — no full-page reload needed
            if (location.pathname === '/') {
              e.preventDefault();
            }
          }}
          className="nav-logo"
        >
          <span className="nav-logo-full">{firstWord}<span className="nav-logo-accent">{restWord}</span></span>
          <span className="nav-logo-short">{shortLogo.charAt(0)}<span>{shortLogo.slice(1)}</span></span>
        </Link>
        
        {/* Search input */}
        <div className="nav-search">
          <span className="nav-search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search mangoes, varieties, gift boxes..." 
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        {/* Desktop nav links */}
        <div className="nav-links">
          <Link 
            to="/" 
            className={location.pathname === '/' && !currentCategory ? 'active' : ''}
          >
            Home
          </Link>
          <Link 
            to="/shop" 
            className={location.pathname === '/shop' && !currentCategory ? 'active' : ''}
          >
            Shop
          </Link>
          {categories.map(cat => (
            <Link 
              key={cat} 
              to={`/shop?category=${encodeURIComponent(cat)}`} 
              className={currentCategory === cat ? 'active' : ''}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Nav actions */}
        <div className="nav-actions">
          {/* Mobile Shop Icon */}
          <Link to="/shop" className="nav-icon-btn mobile-shop-btn" title="Shop">
            🏪
          </Link>

          {/* Wishlist */}
          <Link to="/profile?tab=wishlist" className="nav-icon-btn" title="Wishlist">
            ❤️
          </Link>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDark(!isDark)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '100px',
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              transition: 'all 0.2s ease',
              outline: 'none',
              padding: 0
            }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Cart Icon Button */}
          <Link to="/checkout" className="nav-icon-btn" title="Cart">
            🛒
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>

          {/* Conditional User Profile Dropdown / Login Trigger */}
          {user ? (
            <div 
              className="relative nav-dropdown-wrapper z-[310] flex items-center h-full"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <div 
                className={`cursor-pointer transition-all duration-200 flex items-center justify-center`}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: isDropdownOpen ? '1.5px solid var(--primary)' : '1.5px solid var(--gray2)',
                  background: isDropdownOpen ? 'var(--primary-pale)' : 'var(--gray1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
              >
                <div className="nav-user-avatar" style={{ margin: 0, width: '28px', height: '28px', fontSize: '.8rem' }}>
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                </div>
              </div>
              
              {/* Invisible Padding Top Bridge within Dropdown Container */}
              {isDropdownOpen && (
                <div 
                  className="nav-user-dropdown text-left pt-2 z-[9999] animate-in fade-in duration-200"
                  style={{ display: 'block', position: 'absolute', top: '100%', right: 0, border: 'none', background: 'transparent', boxShadow: 'none', overflow: 'visible' }}
                >
                  <style>{`
                    .nav-custom-dropdown-item {
                      display: flex;
                      align-items: center;
                      gap: 0.75rem;
                      padding: 0.7rem 1rem;
                      border-radius: 8px;
                      font-family: 'Sora', sans-serif;
                      font-size: 0.85rem;
                      font-weight: 600;
                      color: var(--text-primary);
                      cursor: pointer;
                      transition: background 0.15s ease, color 0.15s ease;
                      text-decoration: none;
                      background: transparent;
                      border: none;
                      width: 100%;
                      text-align: left;
                      box-sizing: border-box;
                    }
                    .nav-custom-dropdown-item:hover {
                      background: var(--bg-primary);
                      color: #E8540A;
                    }
                    .nav-custom-dropdown-logout {
                      color: #E8540A;
                      font-weight: 700;
                    }
                    .nav-custom-dropdown-logout:hover {
                      background: #FFF0E8;
                      color: #E8540A;
                    }
                    .nav-custom-dropdown-icon {
                      font-size: 1rem;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                    }
                    .nav-custom-dropdown-divider {
                      border-top: 1px solid var(--border-color);
                      margin: 0.25rem 0.5rem;
                    }
                  `}</style>
                  <div 
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '14px',
                      border: '1.5px solid var(--border-color)',
                      boxShadow: '0 20px 60px var(--shadow-color)',
                      padding: '0.5rem',
                      minWidth: '200px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <Link to="/profile?tab=account" className="nav-custom-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <span className="nav-custom-dropdown-icon">👤</span> My Account
                    </Link>
                    <Link to="/profile?tab=orders" className="nav-custom-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <span className="nav-custom-dropdown-icon">📦</span> My Orders
                    </Link>
                    <Link to="/profile?tab=wishlist" className="nav-custom-dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      <span className="nav-custom-dropdown-icon">❤️</span> Wishlist
                    </Link>
                    <div className="nav-custom-dropdown-divider"></div>
                    <button 
                      onClick={() => { setIsDropdownOpen(false); signOut(auth); }} 
                      className="nav-custom-dropdown-item nav-custom-dropdown-logout"
                    >
                      <span className="nav-custom-dropdown-icon">🚪</span> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="nav-order-btn">
              Login / Sign Up
            </Link>
          )}

          {/* Admin Panel button shown when admin logged in */}
          {isAdmin && (
            <>
              <Link to="/admin" className="nav-order-btn nav-admin-full" style={{ background: 'var(--navbar-bg)' }}>
                ⚙️ Admin Panel
              </Link>
              <Link to="/admin" className="nav-icon-btn nav-admin-compact" title="Admin Panel" style={{ background: 'var(--navbar-bg)', color: '#fff', fontSize: '.85rem' }}>
                ⚙️
              </Link>
            </>
          )}

          {/* Hamburger Menu Toggle */}
          <div 
            className="nav-ham" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className={isMobileMenuOpen ? "rotate-45 translate-y-[6px]" : ""} style={{ transition: '0.3s' }}></span>
            <span className={isMobileMenuOpen ? "opacity-0" : ""} style={{ transition: '0.3s' }}></span>
            <span className={isMobileMenuOpen ? "-rotate-45 -translate-y-[6px]" : ""} style={{ transition: '0.3s' }}></span>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-[100%] left-0 w-full border-b border-gray2 shadow-md z-[190] py-5 px-6 animate-in fade-in slide-in-from-top-4 duration-200" style={{ background: 'var(--bg-card)' }}>
            <div className="flex flex-col gap-4">
              {/* Responsive Search Input */}
              <div style={{ position: 'relative', width: '100%', marginBottom: '.25rem' }}>
                <span style={{ position: 'absolute', left: '.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray4)', fontSize: '.9rem' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Search mangoes, varieties, gift boxes..." 
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsMobileMenuOpen(false);
                      handleSearchKeyDown(e);
                    }
                  }}
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1.5px solid transparent', borderRadius: '100px', padding: '.6rem 1rem .6rem 2.6rem', fontSize: '.85rem', outline: 'none', color: 'var(--text-primary)' }}
                />
              </div>

              <Link 
                to="/" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`font-semibold text-sm transition-colors ${location.pathname === '/' && !currentCategory ? 'text-primary' : 'text-gray4 hover:text-primary'}`}
              >
                Home
              </Link>
              <Link 
                to="/shop" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className={`font-semibold text-sm transition-colors ${location.pathname === '/shop' && !currentCategory ? 'text-primary' : 'text-gray4 hover:text-primary'}`}
              >
                Shop
              </Link>
              {categories.map(cat => (
                <Link 
                  key={cat} 
                  to={`/shop?category=${encodeURIComponent(cat)}`} 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className={`font-semibold text-sm transition-colors ${currentCategory === cat ? 'text-primary' : 'text-gray4 hover:text-primary'}`}
                >
                  {cat}
                </Link>
              ))}
              <div className="h-[1px] bg-gray2 my-1" />
              
              {/* Wishlist and Cart Links */}
              <Link 
                to="/profile?tab=wishlist" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="font-semibold text-sm text-gray4 hover:text-primary flex items-center gap-2"
              >
                ❤️ My Wishlist
              </Link>
              <Link 
                to="/checkout" 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="font-semibold text-sm text-gray4 hover:text-primary flex items-center gap-2"
              >
                🛒 View Cart & Checkout ({totalItems} items)
              </Link>

              <div className="h-[1px] bg-gray2 my-1" />

              {user ? (
                <>
                  <Link 
                    to="/profile" 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="font-semibold text-sm text-gray4 hover:text-primary"
                  >
                    👤 My Account
                  </Link>
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="font-semibold text-sm text-primary"
                    >
                      🔑 Admin Panel
                    </Link>
                  )}
                  <button 
                    onClick={() => { setIsMobileMenuOpen(false); signOut(auth); }} 
                    className="font-semibold text-sm text-red hover:text-red-700 text-left bg-transparent border-none outline-none cursor-pointer"
                  >
                    🚪 Log Out
                  </button>
                </>
              ) : (
                <Link 
                  to="/login" 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="nav-order-btn text-center w-full"
                >
                  Sign In / Create Account
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}