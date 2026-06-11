import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchVal, setSearchVal] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [topBarText, setTopBarText] = useState('🚚 Free delivery on orders above ৳1,500 | Season 2025 Open!');
  
  const { cart } = useCart();
  const { user, isAdmin } = useAuth();
  
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
        if (settingsSnap.exists() && settingsSnap.data().topBarText !== undefined) {
          setTopBarText(settingsSnap.data().topBarText);
        }
      } catch (err) {
        console.error("Error loading navbar data", err);
      }
    };
    fetchData();
  }, []);

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      navigate(`/shop?search=${encodeURIComponent(searchVal)}`);
    }
  };

  return (
    <div className="absolute top-0 left-0 w-full z-50 print:hidden">
      {/* TOPBAR */}
      <div className="topbar">
        <span>{topBarText}</span>
        <div className="topbar-links">
          <Link to="/profile">Track Order</Link>
          <a href="https://wa.me/8801581221084?text=Hello!%20I%20need%20help%20with%20my%20Vertex%20Picks%20order." target="_blank" rel="noreferrer">Help</a>
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
          <span className="nav-logo-full">Vertex<span className="nav-logo-accent">Picks</span></span>
          <span className="nav-logo-short">V<span>P</span></span>
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
                  className="nav-user-dropdown text-left pt-2 z-50 animate-in fade-in duration-200"
                  style={{ display: 'block', position: 'absolute', top: '100%', right: 0, border: 'none', background: 'transparent', boxShadow: 'none', overflow: 'visible' }}
                >
                  <div className="bg-white border border-gray2 rounded-brand shadow-lg min-w-[180px] overflow-hidden">
                    <Link to="/profile?tab=account" className="nud-item" onClick={() => setIsDropdownOpen(false)}>👤 My Account</Link>
                    <Link to="/profile?tab=orders" className="nud-item" onClick={() => setIsDropdownOpen(false)}>📦 My Orders</Link>
                    <Link to="/profile?tab=wishlist" className="nud-item" onClick={() => setIsDropdownOpen(false)}>❤️ Wishlist</Link>
                    <div className="nud-divider"></div>
                    <button 
                      onClick={() => { setIsDropdownOpen(false); signOut(auth); }} 
                      className="nud-item danger w-full text-left font-semibold bg-transparent border-none outline-none cursor-pointer"
                    >
                      🚪 Logout
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
              <Link to="/admin" className="nav-order-btn nav-admin-full" style={{ background: 'var(--dark)' }}>
                ⚙️ Admin Panel
              </Link>
              <Link to="/admin" className="nav-icon-btn nav-admin-compact" title="Admin Panel" style={{ background: 'var(--dark)', color: '#fff', fontSize: '.85rem' }}>
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
          <div className="absolute top-[100%] left-0 w-full bg-white border-b border-gray2 shadow-md z-[190] py-5 px-6 animate-in fade-in slide-in-from-top-4 duration-200">
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
                  style={{ width: '100%', background: 'var(--gray1)', border: '1.5px solid transparent', borderRadius: '100px', padding: '.6rem 1rem .6rem 2.6rem', fontSize: '.85rem', outline: 'none' }}
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