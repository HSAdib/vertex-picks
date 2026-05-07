import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navTabs, setNavTabs] = useState([]);
  const { cart } = useCart();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const currentTabId = queryParams.get('tabId');

  useEffect(() => {
    const fetchTabs = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'mangoes', 'NAVBAR_TABS'));
        if (docSnap.exists() && docSnap.data().list) {
          setNavTabs(docSnap.data().list);
        } else {
          setNavTabs([{ id: 'default', name: 'Premium Mangoes', sections: [] }]);
        }
      } catch (err) {
        console.error("Error loading tabs", err);
      }
    };
    fetchTabs();
  }, []);

  const handleProfileClick = (e) => {
    e.preventDefault();
    if (isAdmin) {
      navigate('/admin');
    } else if (user) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl z-50 rounded-full bg-white/70 backdrop-blur-lg border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] print:hidden">
      <div className="w-full mx-auto px-6 py-2">
        <div className="flex justify-between items-center h-14">

          {/* Logo Section */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-1">
            <span className="font-black text-xl tracking-tight text-black">VERTEX</span>
            <span className="font-black text-xl tracking-tight text-orange-500">PICKS</span>
          </Link>

          {/* Desktop Menu (Hidden on Mobile) */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className={`text-sm uppercase tracking-wider transition-colors ${location.pathname === '/' && !currentTabId ? 'font-black text-orange-500' : 'font-bold text-gray-800 hover:text-orange-500'}`}>
              Home
            </Link>
            {navTabs.map(tab => (
              <Link key={tab.id} to={`/shop?tabId=${tab.id}`} className={`text-sm uppercase tracking-wider transition-colors ${currentTabId === tab.id ? 'font-black text-orange-500' : 'font-bold text-gray-800 hover:text-orange-500'}`}>
                {tab.name}
              </Link>
            ))}
          </div>

          {/* Icons Section (Home + Profile + Cart + Mobile Menu Toggle) */}
          <div className="flex items-center space-x-5">

            {/* Home Icon */}
            <Link to="/" className="text-black hover:text-orange-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </Link>

            {/* NEW: Profile Icon (Dynamic Routing) */}
            <button onClick={handleProfileClick} className="text-black hover:text-orange-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </button>

            {/* Cart Icon (Always visible) */}
            <Link to="/checkout" className="text-black hover:text-orange-500 transition-colors relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button (Hamburger) - Only visible on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-black hover:text-orange-500 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 pt-2 pb-4 space-y-1 shadow-lg">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-3 text-base rounded-md uppercase tracking-wider transition-colors ${location.pathname === '/' && !currentTabId ? 'font-black text-orange-500 bg-orange-50' : 'font-bold text-gray-800 hover:text-orange-500 hover:bg-gray-50'}`}
            >
              Home
            </Link>
            {navTabs.map(tab => (
              <Link
                key={tab.id}
                to={`/shop?tabId=${tab.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-3 text-base rounded-md uppercase tracking-wider transition-colors ${currentTabId === tab.id ? 'font-black text-orange-500 bg-orange-50' : 'font-bold text-gray-800 hover:text-orange-500 hover:bg-gray-50'}`}
              >
                {tab.name}
              </Link>
            ))}
            {/* NEW: Mobile Profile Link */}
            <button
              onClick={(e) => { setIsMobileMenuOpen(false); handleProfileClick(e); }}
              className="block w-full text-left px-3 py-3 text-base font-bold text-gray-800 hover:text-orange-500 hover:bg-gray-50 rounded-md uppercase tracking-wider"
            >
              {isAdmin ? 'Admin Dashboard' : (user ? 'My Account' : 'Login')}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}