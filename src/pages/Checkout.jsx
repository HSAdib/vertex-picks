import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { useCart } from '../context/CartContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';

function generateUniqueId() {
  return Date.now().toString();
}

export default function Checkout() {
  const { cart, removeFromCart, updateQuantity, toggleSelection, clearCart } = useCart();
  const [liveProducts, setLiveProducts] = useState([]);
  const [livePromos, setLivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState({ text: '', type: '' });
  
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [highlightDelivery, setHighlightDelivery] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21 });

  useEffect(() => {
    const fetchCheckoutData = async () => {
      try {
        const productSnap = await getDocs(collection(db, 'mangoes'));
        setLiveProducts(productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const promoSnap = await getDocs(collection(db, 'promos'));
        setLivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (configSnap.exists()) {
          setStoreConfig({
            baseDeliveryFee: configSnap.data().baseDeliveryFee ?? 110,
            perKgFee: configSnap.data().perKgFee ?? 21
          });
        }
        
        // Load User profile or local storage saved guest profiles
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCustomerName(data.name || auth.currentUser.displayName || '');
            
            if (data.addresses && data.addresses.length > 0) {
              setSavedAddresses(data.addresses);
              const defaultAddr = data.addresses.find(a => a.isDefault) || data.addresses[0];
              setSelectedAddressId(defaultAddr.id);
              setDeliveryAddress(defaultAddr.address);
              setDeliveryPhone(defaultAddr.phone);
              setDeliveryCoords(defaultAddr.coords || null);
            } else if (data.address) {
              setDeliveryAddress(data.address);
              setDeliveryPhone(data.phone || '');
              setDeliveryCoords(null);
            }
          } else {
            setCustomerName(auth.currentUser.displayName || '');
          }
        } else {
          const guestAddrs = JSON.parse(localStorage.getItem('vertex_guest_addresses') || '[]');
          if (guestAddrs.length > 0) {
            setSavedAddresses(guestAddrs);
            const defaultAddr = guestAddrs[0];
            setDeliveryAddress(defaultAddr.address);
            setDeliveryPhone(defaultAddr.phone);
            setDeliveryCoords(defaultAddr.coords);
            setSelectedAddressId(defaultAddr.id);
          }
        }
      } catch (err) {
        console.error("Error fetching checkout data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCheckoutData();
  }, []);

  const handleAddressSelect = (addrId) => {
    setSelectedAddressId(addrId);
    if (addrId === 'new') {
      setDeliveryAddress('');
      setDeliveryPhone('');
      setDeliveryCoords(null);
    } else {
      const addr = savedAddresses.find(a => a.id === addrId);
      if (addr) {
        setDeliveryAddress(addr.address);
        setDeliveryPhone(addr.phone);
        setDeliveryCoords(addr.coords || null);
      }
    }
  };

  const cartItemsWithPrice = cart.map(cartItem => {
    const product = liveProducts.find(p => p.id === cartItem.id);
    return product ? { 
      ...product, 
      quantity: cartItem.quantity, 
      weight: Number(product.fixedWeight) || 1, 
      selected: cartItem.selected !== false 
    } : null;
  }).filter(item => item !== null);

  const activeItems = cartItemsWithPrice.filter(item => item.selected);

  const subtotal = activeItems.reduce((sum, item) => {
    const activePrice = Number(item.discountPrice) || Number(item.price) || 0;
    return sum + (activePrice * item.quantity);
  }, 0);

  const totalWeight = activeItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const deliveryFee = totalWeight > 0 ? storeConfig.baseDeliveryFee + ((totalWeight - 1) * storeConfig.perKgFee) : 0;

  let discountAmount = 0;
  if (appliedPromo) discountAmount = Math.round(subtotal * (appliedPromo.discountPercent / 100));

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyPromo = () => {
    const codeEntered = promoCode.trim().toUpperCase();
    const foundPromo = livePromos.find(p => p.code === codeEntered);
    if (foundPromo) {
      setAppliedPromo(foundPromo);
      setPromoMessage({ text: `${foundPromo.discountPercent}% VIP Discount Applied!`, type: 'success' });
      toast.success("Promo code applied successfully!");
    } else {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
      toast.error("Invalid coupon code");
    }
  };

  const handleConfirmOrder = async () => {
    if (activeItems.length === 0) return toast.error("Select at least one item to checkout!");
    
    if (!customerName || !deliveryPhone || !deliveryAddress) {
      setHighlightDelivery(true);
      setTimeout(() => setHighlightDelivery(false), 3000);
      return toast.error("Please fill out all delivery details!");
    }
    if (!isValidBDPhoneNumber(deliveryPhone)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      return toast.error("Please enter a valid Bangladeshi phone number");
    }

    try {
      const orderData = {
        customerEmail: auth.currentUser?.email ? auth.currentUser.email : 'guest@vertexpicks.com',
        customerName: customerName,
        deliveryAddress: deliveryAddress,
        deliveryPhone: deliveryPhone,
        deliveryCoords: deliveryCoords,
        items: activeItems,
        subtotal: subtotal,
        totalWeight: totalWeight,
        deliveryFee: deliveryFee,
        discount: discountAmount,
        promoUsed: appliedPromo ? appliedPromo.code : 'None',
        total: total,
        status: 'Pending',
        isGuest: !auth.currentUser?.email,
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Local backup caching for guest purchases
      if (!auth.currentUser?.email) {
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        localStorage.setItem('vertex_guest_orders', JSON.stringify([{ id: docRef.id, ...orderData }, ...localOrders]));
      }

      // Automatically store address if users use custom profiles
      if (selectedAddressId === 'new') {
        const newAddrObj = {
          id: generateUniqueId(),
          label: 'Saved from Checkout',
          address: deliveryAddress,
          phone: deliveryPhone,
          coords: deliveryCoords || null,
          isDefault: savedAddresses.length === 0
        };

        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userRef, {
            addresses: arrayUnion(newAddrObj)
          }, { merge: true });
        } else {
          const guestAddresses = JSON.parse(localStorage.getItem('guest_addresses') || '[]');
          guestAddresses.push(newAddrObj);
          localStorage.setItem('vertex_guest_addresses', JSON.stringify(guestAddresses));
        }
      }

      clearCart();
      
      toast.success("Order Placed Successfully!");
      setTimeout(() => {
        toast("The Owner will contact you soon, please wait.", { icon: '📞', duration: 5000 });
      }, 1000);

      if (auth.currentUser?.email) {
        navigate('/profile');
      } else {
        navigate('/shop');
      }
    } catch (err) {
      console.error("Failed to place order:", err);
      toast.error("Error: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--white)] flex items-center justify-center py-20 font-['Sora']">
        <div className="text-center">
          <span className="inline-block w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="font-bold text-[var(--gray4)] uppercase tracking-widest text-sm animate-pulse">Syncing Harvest Details...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 sm:p-8 py-16 font-['Sora'] select-none text-left" style={{ paddingTop: '168px' }}>
      
      {/* PAGE HEADING */}
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--dark)] tracking-tight uppercase">
          Checkout Summary
        </h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* CHECKOUT CART ITEMS COLUMN (Left 2-columns) */}
        <div className="lg:col-span-2 space-y-5">
          {cartItemsWithPrice.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center h-80 flex items-center justify-center shadow-sm">
              <p className="text-gray-400 font-bold text-sm sm:text-base">Your cart is empty.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[var(--gray4)] flex items-center gap-2.5">
                  <span className="text-lg">🛍️</span> Selected Harvest Items
                </h3>
                <span className="text-[11px] sm:text-xs font-black text-[var(--primary)] bg-[var(--primary-pale)] px-3.5 py-2 rounded-full">
                  {activeItems.length} selected
                </span>
              </div>
              
              <div className="space-y-4">
                {cartItemsWithPrice.map(item => (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white transition-all duration-300"
                    style={{
                      boxShadow: 'var(--shadow-sm)',
                      opacity: item.selected ? 1 : 0.65
                    }}
                  >
                    <label className="flex items-center justify-center p-1 cursor-pointer flex-shrink-0">
                      <input 
                        type="checkbox" 
                        checked={item.selected} 
                        onChange={() => toggleSelection(item.id)} 
                        className="w-4 h-4 rounded text-[var(--primary)] border-[var(--gray3)] focus:ring-[var(--primary)] cursor-pointer flex-shrink-0 accent-[var(--primary)] scale-110" 
                      />
                    </label>

                    <div className="relative flex-shrink-0 group">
                      <img 
                        src={item.images ? item.images[0] : item.image} 
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-[16px] bg-[var(--gray1)] border border-[var(--gray2)] transition-transform duration-300 group-hover:scale-105" 
                        alt={item.name}
                      />
                    </div>
                    
                    <div className="flex-grow min-w-0" style={{ paddingLeft: '8px' }}>
                      <h4 className="font-black text-base sm:text-lg text-[var(--dark)] leading-snug break-words">
                        {item.name} {item.weight ? `(${item.weight}kg)` : ''}
                      </h4>
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary-pale)] px-2.5 py-0.5 rounded-full">
                          {item.section || 'Variety'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          🌿 Chemical-Free
                        </span>
                      </div>
                      <p className="text-[var(--primary)] font-black text-base sm:text-lg mt-3">
                        ৳{(item.discountPrice || item.price)} <span className="text-xs font-bold text-gray-500 font-sans">/ dozen</span>
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 flex-shrink-0">
                      <div className="flex items-center border border-[var(--gray2)] rounded-full bg-[var(--gray1)] overflow-hidden shadow-inner p-0.5">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-extrabold text-[var(--gray4)] hover:text-[var(--primary)] hover:bg-[var(--primary-pale)] transition-colors text-sm shadow-sm active:scale-90"
                        >
                          -
                        </button>
                        <span className="font-black text-[var(--dark)] w-7 text-center text-xs">
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-extrabold text-[var(--gray4)] hover:text-[var(--primary)] hover:bg-[var(--primary-pale)] transition-colors text-sm shadow-sm active:scale-90"
                        >
                          +
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="text-[var(--red)] hover:bg-[var(--red-pale)] border border-transparent hover:border-[var(--red)]/10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 text-sm hover:scale-110 active:scale-95"
                        title="Remove Item"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ACCORDION & PRICING CALCULATIONS COLUMN (Right 1-column) */}
        <div className="lg:col-span-1 w-full flex justify-center lg:block">
          <div 
            className="bg-white shadow-[0_30px_70px_rgba(0,0,0,0.05)] border border-slate-100 rounded-[28px] overflow-hidden max-w-[420px] w-full mx-auto relative transition-all duration-300 hover:shadow-[0_35px_80px_rgba(0,0,0,0.07)]"
            style={{ padding: '32px 24px' }}
          >
            
            {/* Header section */}
            <div className="mb-6 border-b border-slate-100 pb-5">
              <h3 className="font-black text-lg text-slate-800 tracking-tight flex items-center gap-2">
                <span className="text-xl">🚚</span> Delivery & Payment
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-medium font-sans">Enter shipping details to secure your harvest.</p>
            </div>
            
            {/* DELIVERY DETAILS FORM */}
            <div 
              className={`space-y-4 relative z-10 transition-all duration-300 ${
                highlightDelivery ? 'border border-[var(--red)] bg-[var(--red-pale)]/10 p-4 rounded-2xl animate-shake' : ''
              }`}
            >
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">Recipient Name</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  required 
                  placeholder="E.g. Adnan Rahman" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400/50 placeholder:font-normal focus:bg-white focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none transition-all duration-200 font-sans" 
                />
              </div>
              
              {savedAddresses.length > 0 && (
                <div className="pt-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 font-sans">Address Book</label>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {savedAddresses.map(addr => (
                      <label 
                        key={addr.id} 
                        className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                          selectedAddressId === addr.id 
                            ? 'border-[var(--primary)] bg-[var(--primary-pale)]/30 shadow-sm' 
                            : 'border-slate-200 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="addressSelect" 
                          checked={selectedAddressId === addr.id} 
                          onChange={() => handleAddressSelect(addr.id)} 
                          className="w-4 h-4 mt-0.5 accent-[var(--primary)] cursor-pointer flex-shrink-0" 
                        />
                        <div className="min-w-0 text-left">
                          <span className="inline-block uppercase tracking-wider text-[8px] text-slate-400 font-black bg-slate-100 px-2 py-0.5 rounded">
                            {addr.label} {addr.isDefault && '• Default'}
                          </span>
                          <p className="text-slate-800 font-bold text-xs mt-1.5 whitespace-normal break-words leading-relaxed">{addr.address}</p>
                          <p className="text-slate-500 text-[10px] font-semibold mt-1">{addr.phone}</p>
                        </div>
                      </label>
                    ))}
                    <label 
                      className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                        selectedAddressId === 'new' 
                          ? 'border-[var(--primary)] bg-[var(--primary-pale)]/30 shadow-sm' 
                          : 'border-slate-200 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="addressSelect" 
                        checked={selectedAddressId === 'new'} 
                        onChange={() => handleAddressSelect('new')} 
                        className="w-4 h-4 accent-[var(--primary)] cursor-pointer flex-shrink-0" 
                      />
                      <span className="font-bold text-slate-700 text-xs text-left">Deliver to a New Address</span>
                    </label>
                  </div>
                </div>
              )}

              {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">BD Phone Number</label>
                    <input 
                      type="tel" 
                      value={deliveryPhone} 
                      onChange={e => setDeliveryPhone(e.target.value)} 
                      required 
                      placeholder="E.g. 01712345678" 
                      className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400/50 placeholder:font-normal focus:bg-white focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none transition-all duration-200 font-sans ${
                        phoneError ? 'border-[var(--red)] bg-[var(--red-pale)] animate-shake' : 'border-slate-200'
                      }`} 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Full Shipping Address</label>
                      <button
                        type="button"
                        onClick={() => fetchCurrentLocation(setDeliveryAddress, setLocating, setDeliveryCoords)}
                        disabled={locating}
                        className="text-[10px] font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] flex items-center gap-1 transition-colors outline-none disabled:opacity-50"
                        title="Fetch Current Location Coordinates"
                      >
                        {locating ? '⏳ Locating...' : '📍 Auto-detect'}
                      </button>
                    </div>
                    <textarea 
                      value={deliveryAddress} 
                      onChange={e => { setDeliveryAddress(e.target.value); setDeliveryCoords(null); }} 
                      required 
                      placeholder="House, Road, Apartment, Area, City..." 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400/50 placeholder:font-normal focus:bg-white focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 outline-none h-20 resize-none transition-all font-sans leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GIFT CARD OR PROMO CODE SECTION */}
            <div className="mt-5 pt-5 border-t border-slate-100 text-left relative z-10">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 font-sans">
                Promo Code
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden focus-within:bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10 transition-all duration-200">
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value)} 
                  placeholder="Enter code" 
                  className="flex-1 min-w-0 bg-transparent px-4 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400/50 placeholder:font-normal placeholder:normal-case uppercase outline-none font-sans tracking-wide" 
                />
                <button 
                  onClick={handleApplyPromo} 
                  className="mr-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase rounded-lg tracking-wider transition-colors flex-shrink-0"
                >
                  Apply
                </button>
              </div>
              {promoMessage.text && (
                <p 
                  className={`text-xs font-bold mt-2 ${
                    promoMessage.type === 'success' ? 'text-[var(--green)]' : 'text-[var(--red)]'
                  }`}
                >
                  {promoMessage.text}
                </p>
              )}
            </div>

            {/* Calculations Fields */}
            <div className="space-y-3.5 text-sm font-semibold text-slate-500 mt-6 border-b border-slate-100 pb-5 mb-5 relative z-10">
              <div className="flex justify-between items-center">
                <span>Subtotal ({activeItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                <span className="text-slate-800 font-bold">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Delivery Fee ({totalWeight}kg)</span>
                <span className="text-slate-800 font-bold">৳{deliveryFee.toLocaleString()}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between items-center text-[var(--green)]">
                  <span>Discount ({appliedPromo.code})</span>
                  <span className="font-bold">- ৳{discountAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Invoicing Values */}
            <div className="flex justify-between items-center mb-6 relative z-10">
              <span className="font-bold text-slate-800 text-sm sm:text-base uppercase tracking-wider">Total</span>
              <span className="font-black text-2xl text-slate-900">৳{total.toLocaleString()}</span>
            </div>
            
            <button 
              onClick={handleConfirmOrder} 
              disabled={activeItems.length === 0}
              className={`w-full py-5 text-center tracking-wider uppercase rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-300 relative z-10 shadow-lg ${
                activeItems.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#e8540a] to-[#ff7a35] hover:from-[#d84a00] hover:to-[#ff6c20] text-white hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-orange-500/10'
              }`}
            >
              <span>Confirm Order</span>
              <span className="text-lg font-bold">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}