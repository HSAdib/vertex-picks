import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

import { useCart } from '../../context/CartContext';
import { toast } from 'react-hot-toast';

import './ProductDetail.css';
import ProductGallery from './ProductGallery';
import ProductInfo from './ProductInfo';
import ProductTabs from './ProductTabs';

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  
  

  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [productData, setProductData] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'mangoes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProductData({ id: docSnap.id, ...data });

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
        console.error("Error fetching product details:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleReviewSubmit = async (reviewData) => {
    if (!auth.currentUser) return toast.error("Please log in to leave a review.");
    setIsSubmitting(true);

    const newReview = {
      id: Date.now().toString(),
      name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0], 
      rating: Number(reviewData.rating),
      title: reviewData.title || '',
      body: reviewData.text || '',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      isVerified: true
    };

    try {
      const docRef = doc(db, 'mangoes', productData.id);
      await updateDoc(docRef, { reviews: arrayUnion(newReview) });
      setProductData(prev => ({ ...prev, reviews: [newReview, ...(prev.reviews || [])] }));
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

  if (!productData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--white)] text-center p-6 font-['Sora']" style={{ paddingTop: 'var(--nav-height)' }}>
        <div className="text-6xl mb-4">🥭</div>
        <h2 className="text-2xl font-['Fraunces'] font-black uppercase text-[var(--dark)] mb-4">Harvest selection Not Found</h2>
        <Link to="/shop" className="btn-primary rounded-full font-bold uppercase tracking-wider text-xs px-6 py-3 shadow-md">Return to Shop</Link>
      </div>
    );
  }

  const reviewsList = productData.reviews || [];
  let displayRating = 5;
  if (reviewsList.length > 0) {
    const totalStars = reviewsList.reduce((sum, rev) => sum + Number(rev.rating), 0);
    displayRating = Number((totalStars / reviewsList.length).toFixed(1));
  } else if (productData.stats && productData.stats.rating) {
    displayRating = Number(productData.stats.rating);
  }

  const mappedProduct = {
    id: productData.id,
    name: productData.name,
    variety: productData.variety || 'Premium',
    desc: productData.description || 'Fibreless, intensely sweet with heavenly fragrance.',
    bg: '#FFD580',
    emoji: productData.emoji || '🥭',
    badge: productData.badge || 'Peak Season',
    season: productData.season || 'Peak',
    inStock: productData.inStock !== false,
    price: productData.discountPrice || productData.price,
    oldPrice: productData.discountPrice ? productData.price : null,
    unit: productData.unit || 'box',
    weight: `${productData.fixedWeight || 1} Kg`,
    rating: Math.round(displayRating),
    reviews: reviewsList.length > 0 ? reviewsList.length : (productData.stats?.reviewCount || 0),
    farmerName: 'Abdul Karim',
    farmerSub: 'Rajshahi Orchards · 15+ years growing premium mangoes',
    reviewsList: reviewsList,
    images: productData.images || [],
    packs: [
      { name: '1 Box', price: productData.discountPrice || productData.price },
      { name: '2 Boxes', price: Math.round((productData.discountPrice || productData.price) * 1.9) }
    ],
    related: relatedProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: `৳${p.discountPrice || p.price}`,
      emoji: p.emoji || '🥭'
    }))
  };

  const handleAddToCart = () => {
    addToCart(mappedProduct.id, qty);
    toast.success(`Added ${qty} ${mappedProduct.name} to cart!`);
  };

  return (
    <div className="page active" id="page-product-detail" style={{ paddingTop: 'var(--nav-height)' }}>
      <div className="pdp-breadcrumb">
        <Link to="/">🏠 Home</Link>
        <span className="sep">›</span>
        <Link to="/shop">Shop</Link>
        <span className="sep">›</span>
        <span className="current" id="pdp-breadcrumb-name">{mappedProduct.name}</span>
      </div>

      <div className="pdp-layout">
        <ProductGallery product={mappedProduct} />
        <ProductInfo product={mappedProduct} qty={qty} setQty={setQty} />
      </div>

      <ProductTabs 
        product={mappedProduct} 
        onReviewSubmit={handleReviewSubmit} 
        isSubmitting={isSubmitting} 
      />

      {mappedProduct.related.length > 0 && (
        <div className="pdp-related">
          <div className="sec-head" style={{ padding: '0 0 1rem' }}>
            <div className="sec-title">You May Also <span>Like</span></div>
            <Link to="/shop" className="sec-link">View All →</Link>
          </div>
          <div className="pdp-related-grid" id="pdp-related-grid">
            {mappedProduct.related.map((item, index) => (
              <Link key={index} to={`/product/${item.id}`} className="product-card" style={{ padding: '1rem', background: '#fff', borderRadius: '14px', display: 'block', textDecoration: 'none' }}>
                <div style={{ fontSize: '3rem', textAlign: 'center' }}>{item.emoji}</div>
                <div style={{ fontWeight: 'bold', marginTop: '1rem', color: 'var(--dark)' }}>{item.name}</div>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.price}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="pdp-sticky-bar" style={{ display: 'flex' /* overridden by media query in real env */ }}>
        <div className="pdp-sticky-product">
          <div className="pdp-sticky-emoji" id="pdp-sticky-emoji">{mappedProduct.emoji}</div>
          <div>
            <div className="pdp-sticky-name" id="pdp-sticky-name">{mappedProduct.name}</div>
            <div className="pdp-sticky-price" id="pdp-sticky-price">৳{mappedProduct.price}</div>
          </div>
        </div>
        <button className="pdp-sticky-btn" onClick={handleAddToCart}>Add to Cart</button>
      </div>
    </div>
  );
}
