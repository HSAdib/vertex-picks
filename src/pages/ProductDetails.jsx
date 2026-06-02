import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'react-hot-toast';

const ImageMagnifier = ({ src, alt }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showMagnifier, setShowMagnifier] = useState(false);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setPosition({ x, y });
  };

  return (
    <div 
      className="relative w-full h-full cursor-zoom-in overflow-hidden rounded-brand"
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
      onMouseMove={handleMouseMove}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover animate-fade-in duration-300" />
      
      {showMagnifier && (
        <div 
          className="absolute inset-0 pointer-events-none shadow-inner z-10 animate-in fade-in duration-200"
          style={{
            backgroundImage: `url(${src})`,
            backgroundPosition: `${position.x}% ${position.y}%`,
            backgroundSize: '220%',
            backgroundColor: '#f7f7f7'
          }}
        />
      )}
    </div>
  );
};

export default function ProductDetails() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [mango, setMango] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [qty, setQty] = useState(1);

  const [userReviewText, setUserReviewText] = useState('');
  const [userRating, setUserRating] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'mangoes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMango({ id: docSnap.id, ...data });
          setMainImage(data.images && data.images.length > 0 ? data.images[0] : data.image);

          const allSnap = await getDocs(collection(db, 'mangoes'));
          const allProducts = allSnap.docs
            .filter(d => d.id !== 'STORE_SECTIONS' && d.id !== id)
            .map(d => ({ id: d.id, ...d.data() }));
          
          const sameSection = allProducts.filter(p => p.section && p.section === data.section);
          const others = allProducts.filter(p => !p.section || p.section !== data.section);
          const related = [...sameSection, ...others].slice(0, 4);
          setRelatedProducts(related);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mango details:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAddToCart = () => {
    addToCart(mango.id, qty);
    toast.success(`Added ${qty} box(es) to cart!`); 
  };

  const handleGodModeEdit = () => {
    localStorage.setItem('teleportEditId', mango.id);
    navigate('/admin');
  };

  const handleCustomerReviewSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return toast.error("Please log in to leave a review.");
    setIsSubmitting(true);

    const newReview = {
      id: Date.now().toString(),
      name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0], 
      rating: Number(userRating),
      text: userReviewText,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      isVerified: true
    };

    try {
      const docRef = doc(db, 'mangoes', mango.id);
      await updateDoc(docRef, { reviews: arrayUnion(newReview) });
      setMango(prev => ({ ...prev, reviews: [newReview, ...(prev.reviews || [])] }));
      setUserReviewText('');
      toast.success("Review posted successfully!");
    } catch (error) { 
      console.error("Failed to post review", error); 
      toast.error("Failed to submit review");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--white)] flex items-center justify-center py-20 font-['Sora']" style={{ paddingTop: 'var(--nav-height)' }}>
        <div className="text-center">
          <span className="inline-block w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="font-bold text-[var(--gray4)] uppercase tracking-widest text-sm animate-pulse">Syncing Harvest Details...</h3>
        </div>
      </div>
    );
  }

  if (!mango) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--white)] text-center p-6 font-['Sora']" style={{ paddingTop: 'var(--nav-height)' }}>
        <div className="text-6xl mb-4">🥭</div>
        <h2 className="text-2xl font-['Fraunces'] font-black uppercase text-[var(--dark)] mb-4">Harvest selection Not Found</h2>
        <Link to="/shop" className="btn-primary rounded-full font-bold uppercase tracking-wider text-xs px-6 py-3 shadow-md">Return to Shop</Link>
      </div>
    );
  }

  const imagesArray = mango.images || [mango.image];
  const reviewsList = mango.reviews || [];

  let displayRating = 5;
  let displayReviewCount = reviewsList.length;

  if (reviewsList.length > 0) {
    const totalStars = reviewsList.reduce((sum, rev) => sum + Number(rev.rating), 0);
    displayRating = (totalStars / reviewsList.length).toFixed(1);
  } else if (mango.stats && mango.stats.rating) {
    displayRating = Number(mango.stats.rating).toFixed(1);
    displayReviewCount = mango.stats.reviewCount || 0;
  }

  const roundedRating = Math.round(displayRating) || 0;
  const displaySales = mango.stats?.sales || 0;

  return (
    <div className="bg-[var(--white)] min-h-screen pb-20 font-['Sora'] select-none" style={{ paddingTop: 'var(--nav-height)' }}>
      
      {/* DIRECTORY BREADCRUMBS TRAILS */}
      <div className="bg-[var(--gray1)] border-b border-[var(--gray2)] py-4 px-4 sm:px-6 lg:px-8 mb-8">
        <div className="max-w-[1200px] mx-auto text-xs font-bold text-[var(--gray4)] uppercase tracking-widest flex items-center gap-2">
          <Link to="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
          <span>/</span> 
          <Link to="/shop" className="hover:text-[var(--primary)] transition-colors">Shop</Link>
          <span>/</span> 
          <span className="text-[var(--dark)] truncate">{mango.name} ({mango.fixedWeight || 1}kg)</span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* IMAGE MAGNIFIER PANEL & CAROUSEL */}
          <div className="space-y-4">
            <div className="bg-[var(--gray1)] rounded-brand border border-[var(--gray2)] overflow-hidden shadow-sm h-[400px] sm:h-[500px]">
              <ImageMagnifier src={mainImage} alt={mango.name} />
            </div>
            {imagesArray.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {imagesArray.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setMainImage(img)} 
                    className={`w-20 h-20 flex-shrink-0 rounded-brand overflow-hidden border-2 transition-all cursor-pointer ${
                      mainImage === img ? 'border-[var(--primary)] opacity-100 scale-105 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MAIN HARVEST STATS OVERVIEW */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                {mango.section && (
                  <span className="text-[11px] font-black uppercase tracking-widest text-[var(--primary)] mb-1.5 block">
                    {mango.section}
                  </span>
                )}
                <h1 className="text-3xl sm:text-4xl font-['Fraunces'] font-black text-[var(--dark)] uppercase leading-none">
                  {mango.name}
                </h1>
                <div className="text-sm font-semibold text-[var(--gray4)] mt-2">
                  ⚖️ Box Net Weight: {mango.fixedWeight || 1}kg
                </div>
              </div>
              
              {/* ADMIN GOD MODE WARP TRIGGER */}
              {isAdmin && (
                <button 
                  onClick={handleGodModeEdit} 
                  className="btn-secondary text-xs uppercase px-4 py-2 border border-[var(--gray2)] shadow-sm flex-shrink-0 font-bold rounded-full hover:bg-[var(--dark)] hover:text-white transition-all duration-200"
                >
                  ⚡ Quick Edit
                </button>
              )}
            </div>
            
            {/* Reviews indicators rows */}
            <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-[var(--gray2)] text-xs font-bold text-[var(--gray4)]">
              <div className="flex text-[var(--gold)] text-sm">
                {'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}
              </div>
              <span className="text-[var(--dark)]">{displayRating} Rating</span>
              <span className="text-[var(--gray3)]">|</span>
              <span className="underline cursor-pointer hover:text-[var(--primary)] transition-colors">{displayReviewCount} Customer Reviews</span>
              <span className="text-[var(--gray3)]">|</span>
              <span className="text-[var(--green)] bg-[var(--green)]/10 px-2.5 py-1 rounded-full uppercase tracking-wider text-[10px]">
                🔥 {displaySales}+ Sold
              </span>
            </div>

            {/* Pricing metrics layouts */}
            <div className="mb-6">
              {mango.discountPrice ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-4xl font-['Fraunces'] font-black text-[var(--primary)] leading-none">
                    ৳{mango.discountPrice}
                  </span>
                  <span className="text-lg font-bold text-[var(--gray3)] line-through">
                    ৳{mango.price}
                  </span>
                  <span className="badge bg-[var(--primary-pale)] text-[var(--primary)] border border-[var(--primary)]/20 text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Save {mango.discountPercent}%
                  </span>
                </div>
              ) : (
                <span className="text-4xl font-['Fraunces'] font-black text-[var(--primary)] leading-none">
                  ৳{mango.price}
                </span>
              )}
            </div>

            <p className="text-[var(--gray4)] text-sm sm:text-base leading-relaxed mb-8 font-medium">
              {mango.description}
            </p>

            {/* ADD TO CART ACTION BAR */}
            <div className="bg-[var(--gray1)] p-6 rounded-brand border border-[var(--gray2)] shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[var(--primary-pale)] to-transparent rounded-full opacity-40 -mr-8 -mt-8 pointer-events-none" />
              
              <label className="block text-[10px] font-black text-[var(--gray4)] uppercase tracking-widest mb-2.5">
                Quantity (Boxes)
              </label>
              <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-center bg-white border border-[var(--gray2)] rounded-brand shadow-inner overflow-hidden">
                  <button 
                    onClick={() => setQty(Math.max(1, qty - 1))} 
                    className="px-4 py-2 text-[var(--gray4)] hover:text-[var(--primary)] hover:bg-[var(--gray1)] font-black text-lg cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 font-bold text-[var(--dark)] text-base min-w-[50px] text-center select-none">
                    {qty}
                  </span>
                  <button 
                    onClick={() => setQty(qty + 1)} 
                    className="px-4 py-2 text-[var(--gray4)] hover:text-[var(--primary)] hover:bg-[var(--gray1)] font-black text-lg cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
                
                <button 
                  onClick={handleAddToCart} 
                  className="flex-grow btn-primary text-center font-bold uppercase py-3.5 tracking-widest shadow-md text-xs flex items-center justify-center gap-2 rounded-full transition-all duration-300 hover:scale-[1.02]"
                >
                  Reserve Box 📦
                </button>
              </div>
              <p className="text-center text-[10px] font-bold text-[var(--green)] mt-3.5 uppercase tracking-wider">
                ✓ Season 2026 Handpicked Premium Orchard Freshness Guaranteed
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* REVIEWS AND WRITE FEEDBACK BLOCKS */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-16 border-t border-[var(--gray2)]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Reviews list left panel */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-2xl font-['Fraunces'] font-black text-[var(--dark)] uppercase tracking-tight mb-6">
              Customer <span className="text-[var(--primary)]">Feedback</span>
            </h3>
            {reviewsList.length === 0 ? (
              <p className="text-[var(--gray4)] font-bold text-sm">No reviews yet for this harvest. Be the first to leave verified feedback!</p>
            ) : (
              <div className="reviews-row grid grid-cols-1 gap-4">
                {reviewsList.map(review => (
                  <div key={review.id} className="review-card hover:shadow-md transition-all duration-300">
                    <div className="rv-stars text-[var(--gold)] text-sm font-black">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </div>
                    <p className="rv-text text-sm font-semibold text-[var(--gray4)] my-3.5 leading-relaxed font-['Sora']">
                      "{review.text}"
                    </p>
                    <div className="rv-author flex items-center gap-3 mt-4">
                      <div className="rv-avatar w-9 h-9 rounded-full bg-[var(--primary-pale)] text-[var(--primary)] font-bold flex items-center justify-center text-xs shrink-0 select-none">
                        {review.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="rv-name font-bold text-xs text-[var(--dark)]">
                          {review.name}
                        </div>
                        <div className="rv-loc text-[10px] text-[var(--gray4)] font-semibold mt-0.5">
                          {review.isVerified ? '✓ Verified Buyer' : 'Customer'} • {review.date}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Write a review right block */}
          <div>
            <div className="dash-card bg-white p-6 sticky top-32 shadow-sm border border-[var(--gray2)] rounded-brand">
              <h4 className="font-['Fraunces'] font-black text-sm uppercase tracking-wide text-[var(--dark)] mb-4">
                Write a Review
              </h4>
              {!auth.currentUser ? (
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--gray4)] font-bold mb-4">Please log in with your account to leave verified feedback.</p>
                  <Link to="/login" className="btn-secondary text-[10px] uppercase w-full text-center inline-block py-2.5 shadow-sm rounded-full font-bold">
                    Log In Here
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleCustomerReviewSubmit} className="space-y-4">
                  <div>
                    <label className="form-label block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5">Harvest Rating</label>
                    <select 
                      value={userRating} 
                      onChange={(e) => setUserRating(e.target.value)} 
                      className="form-input w-full p-3 bg-white border border-[var(--gray2)] rounded font-bold text-xs outline-none focus:border-[var(--primary)] shadow-sm cursor-pointer"
                    >
                      <option value="5">★★★★★ 5 Stars - Absolutely Perfect</option>
                      <option value="4">★★★★☆ 4 Stars - Sweet & Tasty</option>
                      <option value="3">★★★☆☆ 3 Stars - Average Quality</option>
                      <option value="2">★★☆☆☆ 2 Stars - Minor Spots</option>
                      <option value="1">★☆☆☆☆ 1 Star - Damaged Harvest</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5">Your Feedback</label>
                    <textarea 
                      value={userReviewText} 
                      onChange={(e) => setUserReviewText(e.target.value)} 
                      placeholder="Share your experience about this Rajshahi mango standard..." 
                      className="form-input w-full p-3 bg-white border border-[var(--gray2)] rounded font-medium text-xs outline-none focus:border-[var(--primary)] shadow-sm h-24 resize-none" 
                      required 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full btn-primary text-center text-xs font-black uppercase tracking-widest py-3.5 disabled:opacity-50 shadow-md rounded-full transition-all duration-300"
                  >
                    {isSubmitting ? 'Posting...' : 'Submit Verified Review'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* RELATED HARVEST RECOMMENDATIONS GRID */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 pt-16 border-t border-[var(--gray2)]">
            <h3 className="text-2xl font-['Fraunces'] font-black text-[var(--dark)] uppercase tracking-tight mb-8">
              You May Also <span className="text-[var(--primary)]">Like</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map(p => {
                const mainImage = p.images && p.images.length > 0 ? p.images[0] : p.image;
                const oldPrice = p.discountPrice ? p.price : null;
                const displayPrice = p.discountPrice || p.price;
                const ratingStars = Math.round(Number(p.stats?.rating) || 5);
                
                return (
                  <Link 
                    key={p.id} 
                    to={`/product/${p.id}`} 
                    className="product-card"
                  >
                    {p.discountPercent && (
                      <div className="tag-strip">
                        <span className="badge badge-orange">-{p.discountPercent}%</span>
                      </div>
                    )}
                    
                    <div className="pc-img bg-[var(--gray1)]">
                      {mainImage ? (
                        <img 
                          src={mainImage} 
                          alt={p.name} 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                        />
                      ) : (
                        <span className="text-4xl">🥭</span>
                      )}
                    </div>
                    
                    <div className="pc-body">
                      {p.section && (
                        <div className="text-[9px] font-black uppercase tracking-widest text-[var(--primary)] mb-1">
                          {p.section}
                        </div>
                      )}
                      
                      <h4 className="pc-name line-clamp-1 hover:text-[var(--primary)] transition-colors">
                        {p.name}
                      </h4>
                      
                      <div className="pc-sub">
                        <span>⚖️ {p.fixedWeight || 1}kg Box</span>
                        {p.grade && <span>• {p.grade}</span>}
                      </div>
                      
                      <div className="pc-rating">
                        <span className="stars text-[var(--gold)] text-xs">
                          {'★'.repeat(ratingStars)}
                          {'☆'.repeat(5 - ratingStars)}
                        </span>
                        <span>({p.stats?.reviewCount || 0})</span>
                      </div>
                      
                      <div className="pc-price-row">
                        <div className="pc-price font-['Fraunces'] text-sm sm:text-base font-bold text-[var(--primary)]">
                          ৳{displayPrice}
                          {oldPrice && <span className="old ml-1.5 text-xs text-[var(--gray3)] line-through">৳{oldPrice}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}