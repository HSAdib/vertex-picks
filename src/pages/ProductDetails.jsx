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
      className="relative w-full h-full cursor-zoom-in"
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
      onMouseMove={handleMouseMove}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      
      {showMagnifier && (
        <div 
          className="absolute inset-0 pointer-events-none shadow-inner z-10"
          style={{
            backgroundImage: `url(${src})`,
            backgroundPosition: `${position.x}% ${position.y}%`,
            backgroundSize: '200%',
            backgroundColor: '#f3f4f6'
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
        // Fetch the current product
        const docRef = doc(db, 'mangoes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMango({ id: docSnap.id, ...data });
          setMainImage(data.images && data.images.length > 0 ? data.images[0] : data.image);

          // Fetch all products for "You May Also Like"
          const allSnap = await getDocs(collection(db, 'mangoes'));
          const allProducts = allSnap.docs
            .filter(d => d.id !== 'STORE_SECTIONS' && d.id !== id)
            .map(d => ({ id: d.id, ...d.data() }));
          
          // Prefer same section, fill with random if needed
          const sameSection = allProducts.filter(p => p.section && p.section === data.section);
          const others = allProducts.filter(p => !p.section || p.section !== data.section);
          const related = [...sameSection, ...others].slice(0, 4);
          setRelatedProducts(related);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mango:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAddToCart = () => {
    addToCart(mango.id, qty);
    toast.success(`Added ${qty} box(es) to cart!`); 
  };

  // GOD MODE TELEPORT
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
      name: auth.currentUser.email.split('@')[0], 
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
    } catch (error) { console.error("Failed to post review", error); }
    setIsSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="h-96 bg-gray-200 rounded-2xl animate-pulse"></div>
          <div className="flex gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse"></div>)}
          </div>
        </div>
        <div className="space-y-4 pt-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
          <div className="h-12 bg-gray-200 rounded animate-pulse w-40 mt-6"></div>
          <div className="h-14 bg-gray-200 rounded animate-pulse w-full mt-4"></div>
        </div>
      </div>
    </div>
  );
  if (!mango) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-gray-500">Mango not found.</div>;

  const imagesArray = mango.images || [mango.image];
  const reviewsList = mango.reviews || [];

  let displayRating = 0;
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
    <div className="bg-white min-h-screen pb-20">
      
      <div className="bg-gray-50 border-b border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-xs font-bold text-gray-500 uppercase tracking-widest">
          <Link to="/" className="hover:text-orange-500">Home</Link> <span className="mx-2">/</span> 
          <Link to="/shop" className="hover:text-orange-500">Shop</Link> <span className="mx-2">/</span> 
          <span className="text-gray-900">{mango.name} ({mango.fixedWeight || 1}kg)</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 h-[500px]">
              <ImageMagnifier src={mainImage} alt={mango.name} />
            </div>
            {imagesArray.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {imagesArray.map((img, idx) => (
                  <button key={idx} onClick={() => setMainImage(img)} className={`w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${mainImage === img ? 'border-orange-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl sm:text-5xl font-black text-gray-900 uppercase tracking-tight">{mango.name} ({mango.fixedWeight || 1}kg)</h1>
              {/* GOD MODE BUTTON */}
              {isAdmin && (
                <button onClick={handleGodModeEdit} className="bg-black text-white px-4 py-2 rounded font-black text-sm uppercase tracking-widest hover:bg-orange-500 shadow-md">
                  ⚡ Edit Item
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
              <div className="flex text-orange-400 text-lg">
                {'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}
              </div>
              <span className="text-sm font-bold text-gray-600">{displayRating} Rating</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-bold text-gray-600 underline cursor-pointer">{displayReviewCount} Reviews</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm font-black text-green-600 bg-green-50 px-2 py-1 rounded">{displaySales} Sold</span>
            </div>

            <div className="mb-8">
              {mango.discountPrice ? (
                <div className="flex items-end gap-4">
                  <span className="text-5xl font-black text-orange-500">৳{mango.discountPrice}</span>
                  <span className="text-2xl font-bold text-gray-400 line-through mb-1">৳{mango.price}</span>
                  <span className="bg-black text-white text-sm font-black px-3 py-1.5 rounded-md uppercase tracking-wider mb-2">Save {mango.discountPercent}%</span>
                </div>
              ) : (
                <span className="text-5xl font-black text-orange-500">৳{mango.price}</span>
              )}
            </div>

            <p className="text-gray-600 text-lg mb-8 leading-relaxed font-medium">{mango.description}</p>

            <div className="mt-auto bg-gray-50 p-6 rounded-xl border border-gray-200">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Quantity (Boxes)</label>
              <div className="flex gap-4">
                <div className="flex items-center bg-white border border-gray-300 rounded-md">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-5 py-3 text-gray-500 hover:text-black font-black text-lg">-</button>
                  <span className="px-5 py-3 font-black text-lg border-l border-r border-gray-200 w-16 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="px-5 py-3 text-gray-500 hover:text-black font-black text-lg">+</button>
                </div>
                <button onClick={handleAddToCart} className="flex-grow bg-black text-white font-black text-xl rounded-md hover:bg-orange-500 transition-colors uppercase tracking-widest shadow-lg hover:shadow-xl">Add to Cart</button>
              </div>
              <p className="text-center text-xs font-bold text-green-600 mt-4 uppercase tracking-widest">✓ Guaranteed Fresh Delivery</p>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-16 border-t-4 border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-8">Customer Reviews</h2>
            {reviewsList.length === 0 ? (
              <p className="text-gray-500 font-bold">No reviews yet. Be the first to review this harvest!</p>
            ) : (
              reviewsList.map(review => (
                <div key={review.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-black text-gray-500 uppercase">{review.name.charAt(0)}</div>
                      <div>
                        <h4 className="font-black text-gray-900">{review.name} {review.isVerified && <span className="text-xs text-blue-500 font-bold ml-1">✓ Verified</span>}</h4>
                        <p className="text-xs text-gray-400 font-bold">{review.date}</p>
                      </div>
                    </div>
                    <div className="flex text-orange-400">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                  </div>
                  <p className="text-gray-700 font-medium">{review.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 sticky top-24">
              <h3 className="text-xl font-black uppercase mb-6">Write a Review</h3>
              {!auth.currentUser ? (
                <div className="text-center">
                  <p className="text-gray-500 font-bold mb-4">You must be logged in to leave a review.</p>
                  <Link to="/login" className="inline-block bg-black text-white px-6 py-3 rounded font-black uppercase tracking-widest text-sm hover:bg-orange-500 transition-colors">Log In Here</Link>
                </div>
              ) : (
                <form onSubmit={handleCustomerReviewSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Rating</label>
                    <select value={userRating} onChange={(e) => setUserRating(e.target.value)} className="w-full p-3 bg-white border border-gray-300 rounded font-bold outline-none">
                      <option value="5">5 Stars - Excellent</option>
                      <option value="4">4 Stars - Very Good</option>
                      <option value="3">3 Stars - Average</option>
                      <option value="2">2 Stars - Poor</option>
                      <option value="1">1 Star - Terrible</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Your Review</label>
                    <textarea value={userReviewText} onChange={(e) => setUserReviewText(e.target.value)} placeholder="What did you think of these mangoes?" className="w-full p-3 bg-white border border-gray-300 rounded font-medium outline-none h-32" required></textarea>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 text-white font-black py-4 rounded uppercase tracking-widest hover:bg-black transition-colors">
                    {isSubmitting ? 'Posting...' : 'Submit Review'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* YOU MAY ALSO LIKE */}
        {relatedProducts.length > 0 && (
          <div className="lg:col-span-3 mt-16">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-900 mb-8">You May Also <span className="text-orange-500">Like</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                  <div className="h-40 bg-gray-100 overflow-hidden">
                    <img src={p.images && p.images.length > 0 ? p.images[0] : p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4">
                    {p.section && <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">{p.section}</span>}
                    <h3 className="font-black text-sm text-gray-900 mt-1 line-clamp-1 group-hover:text-orange-500 transition-colors">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      {p.discountPrice ? (
                        <>
                          <span className="font-black text-orange-500">৳{p.discountPrice}</span>
                          <span className="text-xs text-gray-400 line-through">৳{p.price}</span>
                        </>
                      ) : (
                        <span className="font-black text-orange-500">৳{p.price}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}