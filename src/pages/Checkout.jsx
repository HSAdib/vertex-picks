import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; // Updated to your new secure config!
import { useCart } from '../context/CartContext';

export default function Checkout() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const [liveProducts, setLiveProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // PROMO CODE STATE
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchLivePrices = async () => {
      const querySnapshot = await getDocs(collection(db, 'mangoes'));
      const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveProducts(products);
      setLoading(false);
    };
    fetchLivePrices();
  }, []);

  // Match the ID in the cart to the Product Data
  const cartItemsWithPrice = cart.map(cartItem => {
    const product = liveProducts.find(p => p.id === cartItem.id);
    return product ? { ...product, quantity: cartItem.quantity } : null;
  }).filter(item => item !== null);

  // ==========================================
  // BULLETPROOF MATH (Fixes the NaN bug!)
  // ==========================================
  const subtotal = cartItemsWithPrice.reduce((sum, item) => {
    const activePrice = Number(item.discountPrice) || Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + (activePrice * qty);
  }, 0);

  const deliveryFee = 150;

  // ==========================================
  // PROMO CODE LOGIC
  // ==========================================
  let discountAmount = 0;
  if (appliedPromo === 'SWEET20') {
    discountAmount = Math.round(subtotal * 0.20); // 20% off subtotal
  } else if (appliedPromo === 'FREESHIP') {
    discountAmount = deliveryFee; // 100% off delivery
  }

  // Ensure total never goes below 0
  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'SWEET20') {
      setAppliedPromo(code);
      setPromoMessage({ text: '20% VIP Discount Applied!', type: 'success' });
    } else if (code === 'FREESHIP') {
      setAppliedPromo(code);
      setPromoMessage({ text: 'Free Shipping Applied!', type: 'success' });
    } else {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
    }
  };

  const handleConfirmOrder = async () => {
    if (!auth.currentUser) return alert("Please login to place an order!");
    if (cart.length === 0) return alert("Your cart is empty!");

    try {
      const orderData = {
        customerEmail: auth.currentUser.email,
        items: cartItemsWithPrice,
        subtotal: subtotal,
        discount: discountAmount,
        promoUsed: appliedPromo || 'None',
        total: total,
        status: 'Pending',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'orders'), orderData);
      alert("Order Placed Successfully! You can view it in the Admin Panel.");
      
      // Here you would typically call an emptyCart() function if you have one in CartContext
    } catch (err) {
      alert("Failed to place order. Please try again.");
      console.error(err);
    }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-orange-500">Syncing live prices...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 py-12">
      <h1 className="text-3xl font-black uppercase mb-8 tracking-tight">Checkout Summary</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CART ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          {cartItemsWithPrice.length === 0 ? (
            <div className="bg-white p-10 rounded-xl shadow-sm border text-center font-bold text-gray-400">
              Your cart is empty.
            </div>
          ) : (
            cartItemsWithPrice.map(item => (
              <div key={item.id} className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <img src={item.image} className="w-20 h-20 object-cover rounded shadow-inner bg-gray-50" alt={item.name} />
                <div className="flex-grow">
                  <h3 className="font-black text-gray-900 leading-tight">{item.name}</h3>
                  <p className="text-orange-500 font-black">৳{item.discountPrice || item.price}</p>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-md border">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 font-black text-gray-500 hover:text-black">-</button>
                  <span className="font-black text-gray-900 w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 font-black text-gray-500 hover:text-black">+</button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-400 hover:text-red-600 font-black p-2">✕</button>
              </div>
            ))
          )}
        </div>

        {/* ORDER SUMMARY & PROMOS */}
        <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-black h-fit">
          
          {/* Promo Code Section */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gift Card or Promo Code</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter Code" 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded font-bold uppercase outline-none focus:border-orange-500 transition-colors"
              />
              <button 
                onClick={handleApplyPromo}
                className="bg-gray-900 text-white px-6 font-black rounded hover:bg-orange-500 transition-colors uppercase tracking-widest text-xs"
              >
                Apply
              </button>
            </div>
            {promoMessage.text && (
              <p className={`mt-3 text-sm font-bold ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {promoMessage.text}
              </p>
            )}
          </div>

          <div className="space-y-3 font-medium text-gray-500">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-bold text-gray-900">৳{subtotal}</span></div>
            <div className="flex justify-between"><span>Delivery Fee</span><span className="font-bold text-gray-900">৳{deliveryFee}</span></div>
            
            {appliedPromo && (
              <div className="flex justify-between text-orange-500 font-black">
                <span>Discount ({appliedPromo})</span>
                <span>- ৳{discountAmount}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-3xl font-black border-t-2 border-gray-100 pt-6 mt-6 text-gray-900">
            <span>Total</span>
            <span>৳{total}</span>
          </div>
          
          <button 
            onClick={handleConfirmOrder} 
            disabled={cartItemsWithPrice.length === 0}
            className="w-full bg-orange-500 text-white font-black py-5 rounded-md mt-8 uppercase tracking-widest hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
}