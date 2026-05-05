import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Checkout() {
  const { cart, removeFromCart, updateQuantity, toggleSelection } = useCart();
  const [liveProducts, setLiveProducts] = useState([]);
  const [livePromos, setLivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasDeliveryDetails, setHasDeliveryDetails] = useState(false);
  const navigate = useNavigate();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState({ text: '', type: '' });
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');

  useEffect(() => {
    const fetchCheckoutData = async () => {
      const productSnap = await getDocs(collection(db, 'mangoes'));
      setLiveProducts(productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const promoSnap = await getDocs(collection(db, 'promos'));
      setLivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // CHECK IF USER HAS SAVED THEIR PROFILE ADDRESS!
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().address && userDoc.data().phone) {
          setHasDeliveryDetails(true);
          setDeliveryAddress(userDoc.data().address); // <-- ADD THIS
          setDeliveryPhone(userDoc.data().phone);     // <-- ADD THIS
        }
      }
      setLoading(false);
    };
    fetchCheckoutData();
  }, []);

  // Map cart items to live products and ensure selected/weight default values exist
  const cartItemsWithPrice = cart.map(cartItem => {
    const product = liveProducts.find(p => p.id === cartItem.id);
    return product ? { 
      ...product, 
      quantity: cartItem.quantity, 
      weight: Number(product.fixedWeight) || 1, 
      selected: cartItem.selected !== false // Defaults to true
    } : null;
  }).filter(item => item !== null);

  // ONLY CALCULATE MATH FOR SELECTED ITEMS
  const activeItems = cartItemsWithPrice.filter(item => item.selected);

  const subtotal = activeItems.reduce((sum, item) => {
    const activePrice = Number(item.discountPrice) || Number(item.price) || 0;
    return sum + (activePrice * item.quantity);
  }, 0);

  // NEW DYNAMIC WEIGHT MATH: 110 for 1st kg, + 21 for each additional kg
  const totalWeight = activeItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const deliveryFee = totalWeight > 0 ? 110 + ((totalWeight - 1) * 21) : 0;

  let discountAmount = 0;
  if (appliedPromo) discountAmount = Math.round(subtotal * (appliedPromo.discountPercent / 100));

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyPromo = () => {
    const codeEntered = promoCode.trim().toUpperCase();
    const foundPromo = livePromos.find(p => p.code === codeEntered);
    if (foundPromo) {
      setAppliedPromo(foundPromo);
      setPromoMessage({ text: `${foundPromo.discountPercent}% VIP Discount Applied!`, type: 'success' });
    } else {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
    }
  };

  const handleConfirmOrder = async () => {
    if (!auth.currentUser) return alert("Please login to place an order!");
    if (activeItems.length === 0) return alert("Select at least one item to checkout!");
    if (!hasDeliveryDetails) return alert("You must complete your delivery profile first!");

    try {
      const orderData = {
        customerEmail: auth.currentUser.email,
        deliveryAddress: deliveryAddress, // <-- ADD THIS
        deliveryPhone: deliveryPhone,     // <-- ADD THIS
        items: activeItems,
        subtotal: subtotal,
        totalWeight: totalWeight,
        deliveryFee: deliveryFee,
        discount: discountAmount,
        promoUsed: appliedPromo ? appliedPromo.code : 'None',
        total: total,
        status: 'Pending',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'orders'), orderData);
      alert("Order Placed Successfully!");
      navigate('/profile');
    } catch (err) {
      console.error("Failed to place order:", err);
    }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-orange-500 tracking-widest uppercase">Syncing Data...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 py-12">
      <h1 className="text-3xl font-black uppercase mb-8 tracking-tight">Checkout Summary</h1>
      
      {/* PROFILE WARNING LOCK */}
      {!hasDeliveryDetails && auth.currentUser && (
        <div className="bg-red-50 border-l-8 border-red-500 p-6 rounded-xl mb-8 flex justify-between items-center shadow-sm">
          <div>
            <h3 className="text-red-700 font-black text-lg uppercase tracking-widest mb-1">Action Required</h3>
            <p className="text-red-600 font-medium">You must add your phone number and address before checking out.</p>
          </div>
          <Link to="/profile" className="bg-red-600 text-white px-6 py-3 rounded font-black uppercase text-sm hover:bg-red-700">Go to Profile</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CART ITEMS WITH CHECKBOXES & WEIGHT CONTROLS */}
        <div className="lg:col-span-2 space-y-4">
          {cartItemsWithPrice.length === 0 ? (
            <div className="bg-white p-10 rounded-xl shadow-sm border text-center font-bold text-gray-400">Your cart is empty.</div>
          ) : (
            cartItemsWithPrice.map(item => (
              <div key={item.id} className={`flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl shadow-sm border transition-all ${item.selected ? 'bg-white border-orange-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                
                {/* SELECT CHECKBOX */}
                <input type="checkbox" checked={item.selected} onChange={() => toggleSelection(item.id)} className="w-6 h-6 accent-orange-500 cursor-pointer" />

                <img src={item.images ? item.images[0] : item.image} className="w-20 h-20 object-cover rounded shadow-inner bg-gray-50" />
                
                <div className="flex-grow text-center sm:text-left">
                  <h3 className="font-black text-gray-900 leading-tight">{item.name} {item.weight ? `(${item.weight}kg)` : ''}</h3>
                  <p className="text-orange-500 font-black">৳{item.discountPrice || item.price}</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {/* QUANTITY CONTROL */}
                  <div className="flex items-center text-xs bg-gray-50 border border-gray-200 rounded p-1">
                    <span className="font-black text-gray-500 px-2 uppercase tracking-widest">Qty:</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 font-black text-gray-400 hover:text-black">-</button>
                    <span className="font-black text-gray-900 w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 font-black text-gray-400 hover:text-black">+</button>
                  </div>
                </div>

                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 font-black p-2 ml-2">✕</button>
              </div>
            ))
          )}
        </div>

        {/* ORDER SUMMARY */}
        <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-black h-fit">
          <div className="mb-8 pb-8 border-b border-gray-100">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Gift Card or Promo Code</label>
            <div className="flex gap-2">
              <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter Code" className="w-full px-4 py-3 bg-gray-50 border rounded font-bold uppercase outline-none focus:border-orange-500" />
              <button onClick={handleApplyPromo} className="bg-gray-900 text-white px-6 font-black rounded hover:bg-orange-500 uppercase text-xs">Apply</button>
            </div>
            {promoMessage.text && <p className={`mt-3 text-sm font-bold ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{promoMessage.text}</p>}
          </div>

          <div className="space-y-3 font-medium text-gray-500">
            <div className="flex justify-between"><span>Subtotal ({activeItems.length} items)</span><span className="font-bold text-gray-900">৳{subtotal}</span></div>
            <div className="flex justify-between text-blue-500"><span>Delivery ({totalWeight}kg)</span><span className="font-bold">৳{deliveryFee}</span></div>
            {appliedPromo && <div className="flex justify-between text-orange-500 font-black"><span>Discount ({appliedPromo.code})</span><span>- ৳{discountAmount}</span></div>}
          </div>

          <div className="flex justify-between text-3xl font-black border-t-2 border-gray-100 pt-6 mt-6 text-gray-900"><span>Total</span><span>৳{total}</span></div>
          
          <button 
            onClick={handleConfirmOrder} 
            disabled={activeItems.length === 0 || !hasDeliveryDetails}
            className="w-full bg-orange-500 text-white font-black py-5 rounded-md mt-8 uppercase tracking-widest hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {!hasDeliveryDetails ? 'Profile Setup Required' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}