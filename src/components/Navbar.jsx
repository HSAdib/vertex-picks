import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { cart } = useCart(); // Read the cart data

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-black tracking-tighter text-brand-dark">
              VERTEX <span className="text-brand-gold">PICKS</span>
            </Link>
          </div>

          <div className="hidden sm:flex sm:space-x-8">
            <Link to="/" className="text-brand-dark hover:text-brand-gold px-3 py-2 text-sm font-semibold transition-colors uppercase tracking-wider">
              Home
            </Link>
            <Link to="/shop" className="text-brand-dark hover:text-brand-gold px-3 py-2 text-sm font-semibold transition-colors uppercase tracking-wider">
              Premium Mangoes
            </Link>
          </div>

          <div className="flex items-center">
            <Link to="/checkout" className="p-2 text-brand-dark hover:text-brand-gold transition-colors relative group">
              <ShoppingBag className="h-6 w-6 stroke-[1.5]" />
              {/* This circle only shows up if there is something in the cart */}
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-brand-green rounded-full">
                  {cart.length}
                </span>
              )}
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}