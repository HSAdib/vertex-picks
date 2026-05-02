import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="bg-white border border-gray-100 rounded-sm shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col group">
      
      {/* The Image Area */}
      <div className="h-72 relative overflow-hidden bg-gray-100">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-2xl font-black text-brand-dark mb-1">{product.name}</h3>
        <p className="text-xs text-brand-green font-bold mb-4 uppercase tracking-widest">{product.grade}</p>
        <p className="text-gray-600 mb-8 text-sm leading-relaxed">{product.description}</p>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-brand-dark">৳{product.price}</span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Per {product.unit}</span>
          </div>
          <button 
            onClick={() => addToCart(product)}
            className="bg-brand-dark text-brand-light p-4 rounded hover:bg-brand-gold hover:text-brand-dark transition-colors duration-200"
          >
            <ShoppingBag className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}