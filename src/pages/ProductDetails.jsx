import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useCart } from '../context/CartContext';
import { toast } from 'react-hot-toast'; // Optional: if you use it for alerts

export default function ProductDetails() {
  const { id } = useParams();
  const { addToCart } = useCart();
  
  const [mango, setMango] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [qty, setQty] = useState(1);

  // Real Customer Review State
  const [userReviewText, setUserReviewText] = useState('');
  const [userRating, setUserRating] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMango = async () => {
      try {
        const docRef = doc(db, 'mangoes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMango({ id: docSnap.id, ...data });
          // Set first image as main
          setMainImage(data.images && data.images.length > 0 ? data.images[0] : data.image);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mango:", error);
        setLoading(false);
      }
    };
    fetchMango();
  }, [id]);

  const handleAddToCart = () => {
    addToCart(mango.id, qty);
    alert(`Added ${qty} box(es) to cart!`); // Replace with toast if you prefer
  };

  const handleCustomerReviewSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Please log in to leave a review.");
    setIsSubmitting(true);

    const newReview = {
      id: Date.now().toString(),
      name: auth.currentUser.email.split('@')[0], // Uses first part of email as name
      rating: Number(userRating),
      text: userReviewText,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      isVerified: true
    };

    try {
      const docRef = doc(db, 'mangoes', mango.id);
      await updateDoc(docRef, {
        reviews: arrayUnion(newReview)
      });
      
      // Update UI locally
      setMango(prev => ({ ...prev, reviews: [newReview, ...(prev.reviews || [])] }));
      setUserReviewText('');
      alert("Review posted successfully!");
    } catch (error) {
      console.error("Failed to post review", error);
    }
    setIsSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl animate-pulse text-orange-500 uppercase tracking-widest">Fetching Harvest Data...</div>;
  if (!mango) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-gray-500">Mango not found.</div>;

  const imagesArray = mango.images || [mango.image];
  const reviewsList = mango.reviews || [];

  // --- DYNAMIC RATING CALCULATOR ---
  let displayRating = 0;
  let displayReviewCount = reviewsList.length;

  if (reviewsList.length > 0) {
    // 1. If reviews exist, calculate the exact mathematical average
    const totalStars = reviewsList.reduce((sum, rev) => sum + Number(rev.rating), 0);
    displayRating = (totalStars / reviewsList.length).toFixed(1);
  } else if (mango.stats && mango.stats.rating) {
    // 2. If no reviews exist, use the "Fake Stats" set in Admin
    displayRating = Number(mango.stats.rating).toFixed(1);
    displayReviewCount = mango.stats.reviewCount || 0;
  }

  const roundedRating = Math.round(displayRating) || 0;
  const displaySales = mango.stats?.sales || 0;

  return (
    <div className="bg-white min-h-screen pb-20">
      
      {/* BREADCRUMBS */}
      <div className="bg-gray-50 border-b border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-xs font-bold text-gray-500 uppercase tracking-widest">
          <Link to="/" className="hover:text-orange-500">Home</Link> <span className="mx-2">/</span> 
          <Link to="/shop" className="hover:text-orange-500">Shop</Link> <span className="mx-2">/</span> 
          <span className="text-gray-900">{mango.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* LEFT: IMAGE GALLERY */}
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 h-[500px]">
              <img src={mainImage} alt={mango.name} className="w-full h-full object-cover" />
            </div>
            {/* THUMBNAILS */}
            {imagesArray.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {imagesArray.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setMainImage(img)}
                    className={`w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${mainImage === img ? 'border-orange-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: PRODUCT INFO */}
          <div className="flex flex-col">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 uppercase tracking-tight mb-4">{mango.name}</h1>
            
            {/* DYNAMIC SOCIAL PROOF */}
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

            {/* PRICE & DISCOUNT */}
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

            <p className="text-gray-600 text-lg mb-8 leading-relaxed font-medium">
              {mango.description}
            </p>

            {/* ADD TO CART ACTION */}
            <div className="mt-auto bg-gray-50 p-6 rounded-xl border border-gray-200">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Quantity (Boxes)</label>
              <div className="flex gap-4">
                <div className="flex items-center bg-white border border-gray-300 rounded-md">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-5 py-3 text-gray-500 hover:text-black font-black text-lg">-</button>
                  <span className="px-5 py-3 font-black text-lg border-l border-r border-gray-200 w-16 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="px-5 py-3 text-gray-500 hover:text-black font-black text-lg">+</button>
                </div>
                <button onClick={handleAddToCart} className="flex-grow bg-black text-white font-black text-xl rounded-md hover:bg-orange-500 transition-colors uppercase tracking-widest shadow-lg hover:shadow-xl">
                  Add to Cart
                </button>
              </div>
              <p className="text-center text-xs font-bold text-green-600 mt-4 uppercase tracking-widest">✓ Guaranteed Fresh Delivery</p>
            </div>

          </div>
        </div>
      </div>

      {/* REVIEWS SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-16 border-t-4 border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* LIST OF REVIEWS */}
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
                    <div className="flex text-orange-400">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </div>
                  </div>
                  <p className="text-gray-700 font-medium">{review.text}</p>
                </div>
              ))
            )}
          </div>

          {/* WRITE A REVIEW FORM */}
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
                    <textarea 
                      value={userReviewText} 
                      onChange={(e) => setUserReviewText(e.target.value)}
                      placeholder="What did you think of these mangoes?" 
                      className="w-full p-3 bg-white border border-gray-300 rounded font-medium outline-none h-32"
                      required
                    ></textarea>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 text-white font-black py-4 rounded uppercase tracking-widest hover:bg-black transition-colors">
                    {isSubmitting ? 'Posting...' : 'Submit Review'}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}