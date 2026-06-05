import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../hooks/useWishlist';

export default function ProductCard({ product }) {
  const { addToCart, cart } = useCart();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const isAdded = cart.some(item => item.id === product.id);

  // God Mode Edit Teleport
  const handleGodModeEdit = (e) => {
    e.preventDefault();
    localStorage.setItem('teleportEditId', product.id);
    navigate('/admin');
  };

  const handleAdd = (e) => {
    e.preventDefault(); // Prevents clicking the outer detail link routing
    addToCart(product.id, 1);
  };

  const mainImage = product.images && product.images.length > 0 ? product.images[0] : product.image;
  const oldPrice = product.discountPrice ? product.price : null;
  const displayPrice = product.discountPrice || product.price;

  // Star Rating Calculation
  const ratingStars = Math.round(Number(product.stats?.rating) || 5);

  return (
    <div className="product-card">
      
      {/* GOD MODE BUTTON FOR ADMINS */}
      {isAdmin && (
        <button 
          onClick={handleGodModeEdit}
          className="absolute top-3 right-12 z-20 bg-black text-white px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-widest hover:bg-primary shadow-lg border border-gray-800"
        >
          ⚡ Quick Edit
        </button>
      )}

      {/* Discount Badge Alert */}
      {product.discountPercent && (
        <div className="tag-strip">
          <span className="badge badge-orange">-{product.discountPercent}%</span>
        </div>
      )}

      {/* Favorite Wishlist Icon Button */}
      <button 
        className="pc-wishlist" 
        onClick={(e) => { e.preventDefault(); toggleWishlist(product); }}
        style={{ color: isInWishlist(product.id) ? 'var(--primary)' : 'inherit' }}
      >
        {isInWishlist(product.id) ? '♥' : '♡'}
      </button>

      {/* Primary Detail Navigation Link */}
      <Link to={`/product/${product.id}`} className="block">
        <div className="pc-img bg-gray1">
          {mainImage ? (
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🥭</span>
          )}
        </div>

        <div className="pc-body">
          {product.section && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              {product.section}
            </div>
          )}
          <h4 className="pc-name line-clamp-1">{product.name}</h4>
          
          <div className="pc-sub">
            <span>⚖️ {product.fixedWeight || 1}kg Box</span>
            {product.grade && <span>• {product.grade}</span>}
          </div>

          <div className="pc-rating">
            <span className="stars">
              {'★'.repeat(ratingStars)}
              {'☆'.repeat(5 - ratingStars)}
            </span>
            <span>({product.stats?.reviewCount || 0})</span>
          </div>

          <div className="pc-price-row">
            <div className="pc-price font-display">
              ৳{displayPrice}
              {oldPrice && <span className="old">৳{oldPrice}</span>}
            </div>
            <button 
              onClick={handleAdd}
              className={`pc-add ${isAdded ? 'added' : ''}`}
            >
              {isAdded ? '✓' : '+'}
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}