import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
export default function Navbar() {
  // This state controls whether the mobile menu is open or closed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { cart } = useCart();
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Section */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-1">
            <span className="font-black text-xl tracking-tight text-black">VERTEX</span>
            <span className="font-black text-xl tracking-tight text-orange-500">PICKS</span>
          </Link>

          {/* Desktop Menu (Hidden on Mobile) */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-sm font-bold text-gray-800 hover:text-orange-500 transition-colors uppercase tracking-wider">
              Home
            </Link>
            <Link to="/shop" className="text-sm font-bold text-gray-800 hover:text-orange-500 transition-colors uppercase tracking-wider">
              Premium Mangoes
            </Link>
          </div>

          {/* Icons Section (Cart + Mobile Menu Toggle) */}
          <div className="flex items-center space-x-4">
            
            {/* Cart Icon (Always visible) */}
            <Link to="/checkout" className="text-black hover:text-orange-500 transition-colors relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> // X icon
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /> // Hamburger icon
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
              className="block px-3 py-3 text-base font-bold text-gray-800 hover:text-orange-500 hover:bg-gray-50 rounded-md uppercase tracking-wider"
            >
              Home
            </Link>
            <Link 
              to="/shop" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-3 text-base font-bold text-gray-800 hover:text-orange-500 hover:bg-gray-50 rounded-md uppercase tracking-wider"
            >
              Premium Mangoes
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
