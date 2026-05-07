import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';

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
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
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
        
        // CHECK IF USER HAS SAVED THEIR PROFILE ADDRESS!
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

  // DYNAMIC WEIGHT MATH using Store Config
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
    } else {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
    }
  };

  const handleConfirmOrder = async () => {
    if (activeItems.length === 0) return toast.error("Select at least one item to checkout!");
    
    if (!customerName || !deliveryPhone || !deliveryAddress) {
      setShowDeliveryForm(true);
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
      
      // Save order to local storage for guests
      if (!auth.currentUser?.email) {
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        localStorage.setItem('vertex_guest_orders', JSON.stringify([{ id: docRef.id, ...orderData }, ...localOrders]));
      }

      // NEW: Save address if user entered a new one
      if (selectedAddressId === 'new') {
        const newAddrObj = {
          id: Date.now().toString(),
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
          const guestAddresses = JSON.parse(localStorage.getItem('vertex_guest_addresses') || '[]');
          localStorage.setItem('vertex_guest_addresses', JSON.stringify([newAddrObj, ...guestAddresses]));
        }
      }

      clearCart();
      
      // The popups requested by the user
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

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-orange-500 tracking-widest uppercase">Syncing Data...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 py-12">
      <h1 className="text-3xl font-black uppercase mb-8 tracking-tight">Checkout Summary</h1>
      
      {/* WE NO LONGER LOCK THE PROFILE, WE SHOW THE FORM BELOW */}

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

                <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 p-2 ml-2 transition-colors drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* CHECKOUT FORM & ORDER SUMMARY */}
        {/* CHECKOUT FORM & ORDER SUMMARY */}
        <div className="space-y-6 h-fit">
          <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-black">
            
            {/* DELIVERY DETAILS ACCORDION */}
            <div className={`mb-4 p-3 rounded-xl border-2 transition-all duration-300 ${highlightDelivery ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] bg-red-50' : (showDeliveryForm ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-gray-200 bg-gray-50 shadow-sm hover:border-orange-300')}`}>
              <button 
                onClick={() => setShowDeliveryForm(!showDeliveryForm)} 
                className="w-full flex justify-between items-center text-left focus:outline-none group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-colors ${showDeliveryForm ? 'bg-orange-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400 group-hover:border-orange-300 group-hover:text-orange-500'}`}>
                    🚚
                  </div>
                  <div>
                    <h2 className="font-black uppercase text-base tracking-widest text-gray-900 group-hover:text-orange-500 transition-colors">Delivery Details</h2>
                    {!showDeliveryForm && (
                      <p className="text-[10px] font-bold mt-0.5 text-gray-500">
                        {deliveryPhone && deliveryAddress ? 'Address is selected. Tap to change.' : 'Tap here to add delivery info'}
                      </p>
                    )}
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${showDeliveryForm ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-600 group-hover:bg-orange-100 group-hover:text-orange-500'}`}>
                  <span className="font-black text-lg leading-none">{showDeliveryForm ? '−' : '+'}</span>
                </div>
              </button>

              {showDeliveryForm && (
                <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Full Name</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Your Name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded font-bold outline-none focus:border-orange-500" />
                  </div>
                  
                  {savedAddresses.length > 0 && (
                    <div className="py-2">
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Select Address</label>
                      <div className="space-y-2">
                        {savedAddresses.map(addr => (
                          <label key={addr.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedAddressId === addr.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input type="radio" name="addressSelect" checked={selectedAddressId === addr.id} onChange={() => handleAddressSelect(addr.id)} className="mt-1 w-4 h-4 accent-orange-500" />
                            <div>
                              <p className="font-black text-sm uppercase tracking-widest">{addr.label} {addr.isDefault && <span className="text-orange-500 text-[10px] ml-2">(Default)</span>}</p>
                              <p className="text-xs font-bold text-gray-600 mt-1">{addr.phone}</p>
                              <p className="text-xs text-gray-500 line-clamp-1">{addr.address}</p>
                            </div>
                          </label>
                        ))}
                        <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedAddressId === 'new' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <input type="radio" name="addressSelect" checked={selectedAddressId === 'new'} onChange={() => handleAddressSelect('new')} className="w-4 h-4 accent-orange-500" />
                          <span className="font-black text-sm uppercase tracking-widest">Use a different address</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                    <>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Phone Number</label>
                        <input type="tel" value={deliveryPhone} onChange={e => setDeliveryPhone(e.target.value)} required placeholder="017..." className={`w-full p-3 border rounded font-bold outline-none transition-colors duration-300 ${phoneError ? 'bg-red-50 border-red-500 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-50 border-gray-200 focus:border-orange-500'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Full Address</label>
                        <div className="relative">
                          <textarea value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); setDeliveryCoords(null); }} required placeholder="House, Road, Area..." className="w-full p-3 pr-12 bg-gray-50 border border-gray-200 rounded font-bold outline-none focus:border-orange-500 h-24"></textarea>
                          <button
                            type="button"
                            onClick={() => fetchCurrentLocation(setDeliveryAddress, setLocating, setDeliveryCoords)}
                            disabled={locating}
                            className="absolute top-3 right-3 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-[0_0_10px_rgba(249,115,22,0.4)] hover:shadow-[0_0_15px_rgba(249,115,22,0.8)] disabled:opacity-50 disabled:animate-pulse disabled:hover:scale-100 disabled:hover:shadow-none"
                            title="Use current location"
                          >
                            {locating ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mb-5 pb-5 border-b border-gray-100">
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Gift Card or Promo Code</label>
              <div className="flex gap-2">
                <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter Code" className="w-full px-3 py-1.5 text-sm bg-gray-50 border rounded font-bold uppercase outline-none focus:border-orange-500" />
                <button onClick={handleApplyPromo} className="bg-gray-900 text-white px-5 py-1.5 font-black rounded hover:bg-orange-500 uppercase text-[11px]">Apply</button>
              </div>
              {promoMessage.text && <p className={`mt-3 text-sm font-bold ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{promoMessage.text}</p>}
            </div>

          <div className="space-y-2 font-medium text-gray-500 text-sm">
            <div className="flex justify-between"><span>Subtotal ({activeItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span><span className="font-bold text-gray-900">৳{subtotal}</span></div>
            <div className="flex justify-between text-blue-500"><span>Delivery ({totalWeight}kg)</span><span className="font-bold">৳{deliveryFee}</span></div>
            {appliedPromo && <div className="flex justify-between text-orange-500 font-black"><span>Discount ({appliedPromo.code})</span><span>- ৳{discountAmount}</span></div>}
          </div>

          <div className="flex justify-between text-2xl font-black border-t-2 border-gray-100 pt-4 mt-4 text-gray-900"><span>Total</span><span>৳{total}</span></div>
          
          <button 
            onClick={handleConfirmOrder} 
            disabled={activeItems.length === 0}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-md mt-6 uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            Confirm Order
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}