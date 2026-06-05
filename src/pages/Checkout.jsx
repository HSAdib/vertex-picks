import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { onAuthStateChanged } from 'firebase/auth';
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
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21, freeDeliveryMin: 1500 });

  useEffect(() => {
    const fetchCheckoutData = async (currentUser) => {
      try {
        const productSnap = await getDocs(collection(db, 'mangoes'));
        setLiveProducts(productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const promoSnap = await getDocs(collection(db, 'promos'));
        setLivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (configSnap.exists()) {
          setStoreConfig({
            baseDeliveryFee: configSnap.data().baseDeliveryFee ?? 110,
            perKgFee: configSnap.data().perKgFee ?? 21,
            freeDeliveryMin: configSnap.data().freeDeliveryMin ?? 1500,
          });
        }
        
        // B8 fix: use the resolved currentUser from onAuthStateChanged
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCustomerName(data.name || currentUser.displayName || '');
            
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
            setCustomerName(currentUser.displayName || '');
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
    // B8 fix: use onAuthStateChanged so auth resolves before loading profile
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      fetchCheckoutData(currentUser);
    });
    return () => unsubscribeAuth();
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
  // B6 fix: apply free delivery threshold
  const rawDeliveryFee = totalWeight > 0 ? storeConfig.baseDeliveryFee + ((totalWeight - 1) * storeConfig.perKgFee) : 0;
  const deliveryFee = subtotal >= storeConfig.freeDeliveryMin ? 0 : rawDeliveryFee;

  // B5 fix: support both flat and percentage discounts
  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'flat') {
      discountAmount = appliedPromo.discountValue || 0;
    } else {
      discountAmount = Math.round(subtotal * ((appliedPromo.discountPercent || appliedPromo.discountValue || 0) / 100));
    }
  }

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyPromo = () => {
    const codeEntered = promoCode.trim().toUpperCase();
    const foundPromo = livePromos.find(p => p.code === codeEntered);
    if (!foundPromo) {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
      toast.error('Invalid coupon code');
      return;
    }
    // B5 fix: check expiry
    if (foundPromo.expiresAt) {
      const expiry = foundPromo.expiresAt.toDate ? foundPromo.expiresAt.toDate() : new Date(foundPromo.expiresAt);
      if (expiry < new Date()) {
        setAppliedPromo(null);
        setPromoMessage({ text: 'This coupon has expired.', type: 'error' });
        toast.error('Coupon has expired');
        return;
      }
    }
    // B5 fix: check usage limit
    if (foundPromo.usageLimit && (foundPromo.usedCount || 0) >= foundPromo.usageLimit) {
      setAppliedPromo(null);
      setPromoMessage({ text: 'This coupon has reached its usage limit.', type: 'error' });
      toast.error('Coupon usage limit reached');
      return;
    }
    // B5 fix: check minimum order amount
    if (foundPromo.minOrderAmount && subtotal < foundPromo.minOrderAmount) {
      setAppliedPromo(null);
      setPromoMessage({ text: `Min. order of ৳${foundPromo.minOrderAmount} required.`, type: 'error' });
      toast.error(`Min. order ৳${foundPromo.minOrderAmount} required`);
      return;
    }
    setAppliedPromo(foundPromo);
    const label = foundPromo.discountType === 'flat'
      ? `৳${foundPromo.discountValue} OFF Applied!`
      : `${foundPromo.discountPercent || foundPromo.discountValue}% Discount Applied!`;
    setPromoMessage({ text: label, type: 'success' });
    toast.success('Promo code applied!');
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
          // B3 fix: use consistent 'vertex_guest_addresses' key
          // B10 fix: deduplicate before saving
          const guestAddresses = JSON.parse(localStorage.getItem('vertex_guest_addresses') || '[]');
          const alreadyExists = guestAddresses.some(a => a.address === newAddrObj.address && a.phone === newAddrObj.phone);
          if (!alreadyExists) {
            guestAddresses.push(newAddrObj);
            localStorage.setItem('vertex_guest_addresses', JSON.stringify(guestAddresses));
          }
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
            <div className="bg-white border rounded-2xl p-12 text-center h-80 flex items-center justify-center" style={{border:'1.5px solid var(--gray2)',boxShadow:'var(--shadow-sm)',borderRadius:14}}>
              <p style={{color:'var(--gray4)',fontWeight:700,fontSize:'.9rem'}}>Your cart is empty.</p>
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
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300"
                    style={{
                      border:'1.5px solid var(--gray2)',
                      background:'#fff',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: item.selected ? 1 : 0.65,
                      borderRadius:14
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
                        <span className="text-[10px] font-bold bg-gray-100 px-2.5 py-0.5 rounded-full" style={{color:'var(--gray4)'}}>
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
            style={{background:'#fff',boxShadow:'0 20px 50px rgba(0,0,0,0.06)',border:'1.5px solid var(--gray2)',borderRadius:14,overflow:'hidden',maxWidth:420,width:'100%',margin:'0 auto',position:'relative',transition:'all .3s',padding:'2rem 1.5rem'}}
            className="hover:shadow-2xl"
          >
            
            {/* Header section */}
            <div style={{marginBottom:'1.5rem',borderBottom:'1.5px solid var(--gray2)',paddingBottom:'1.25rem'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontWeight:900,fontSize:'1.05rem',color:'var(--dark)',letterSpacing:'.02em',display:'flex',alignItems:'center',gap:'.5rem'}}>
                <span style={{fontSize:'1.25rem'}}>🚚</span> Delivery & Payment
              </h3>
              <p style={{fontSize:'.75rem',color:'var(--gray4)',marginTop:'.25rem',fontWeight:500}}>Enter shipping details to secure your harvest.</p>
            </div>
            
            {/* DELIVERY DETAILS FORM */}
            <div 
              className={`space-y-4 relative z-10 transition-all duration-300 ${
                highlightDelivery ? 'border border-[var(--red)] bg-[var(--red-pale)]/10 p-4 rounded-2xl animate-shake' : ''
              }`}
            >
              <div>
                <label className="form-label">Recipient Name</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  required 
                  placeholder="E.g. Adnan Rahman" 
                  className="form-input" 
                />
              </div>
              
              {savedAddresses.length > 0 && (
                <div className="pt-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 font-sans">Address Book</label>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {savedAddresses.map(addr => (
                      <label 
                        key={addr.id} 
                        className={`flex items-start gap-3 p-3.5 border rounded-[14px] cursor-pointer transition-all ${selectedAddressId === addr.id ? 'bg-[var(--primary-pale)]/30' : 'bg-white'}`}
                        style={{border: selectedAddressId === addr.id ? '1.5px solid var(--primary)' : '1.5px solid var(--gray2)'}}
                      >
                        <input 
                          type="radio" 
                          name="addressSelect" 
                          checked={selectedAddressId === addr.id} 
                          onChange={() => handleAddressSelect(addr.id)} 
                          className="w-4 h-4 mt-0.5 accent-[var(--primary)] cursor-pointer flex-shrink-0" 
                        />
                        <div className="min-w-0 text-left">
                          <span style={{display:'inline-block',textTransform:'uppercase',letterSpacing:'.08em',fontSize:'.7rem',color:'var(--gray4)',fontWeight:900,background:'var(--gray1)',padding:'.15rem .5rem',borderRadius:4}}>
                            {addr.label} {addr.isDefault && '• Default'}
                          </span>
                          <p style={{color:'var(--dark)',fontWeight:700,fontSize:'.78rem',marginTop:'.4rem',whiteSpace:'normal',wordBreak:'break-word',lineHeight:1.55}}>{addr.address}</p>
                          <p style={{color:'var(--gray4)',fontSize:'.7rem',fontWeight:600,marginTop:'.25rem'}}>{addr.phone}</p>
                        </div>
                      </label>
                    ))}
                    <label 
                      className={`flex items-center gap-3 p-3.5 border rounded-[14px] cursor-pointer transition-all ${selectedAddressId === 'new' ? 'bg-[var(--primary-pale)]/30' : 'bg-white'}`}
                      style={{border: selectedAddressId === 'new' ? '1.5px solid var(--primary)' : '1.5px solid var(--gray2)'}}
                    >
                      <input 
                        type="radio" 
                        name="addressSelect" 
                        checked={selectedAddressId === 'new'} 
                        onChange={() => handleAddressSelect('new')} 
                        className="w-4 h-4 accent-[var(--primary)] cursor-pointer flex-shrink-0" 
                      />
                      <span style={{fontWeight:700,color:'var(--dark)',fontSize:'.8rem'}}>Deliver to a New Address</span>
                    </label>
                  </div>
                </div>
              )}

              {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="form-label">BD Phone Number</label>
                    <input 
                      type="tel" 
                      value={deliveryPhone} 
                      onChange={e => setDeliveryPhone(e.target.value)} 
                      required 
                      placeholder="E.g. 01712345678" 
                      className="form-input"
                      style={phoneError ? {borderColor:'var(--red)',background:'var(--red-pale)'} : {}}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="form-label" style={{marginBottom:0}}>Full Shipping Address</label>
                      <button
                        type="button"
                        onClick={() => fetchCurrentLocation(setDeliveryAddress, setLocating, setDeliveryCoords)}
                        disabled={locating}
                        className="text-[10px] font-bold flex items-center gap-1 transition-colors outline-none disabled:opacity-50"
                        style={{color:'var(--primary)',border:'none',background:'none',cursor:'pointer'}}
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
                      className="form-input"
                      style={{height:80,resize:'none'}}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GIFT CARD OR PROMO CODE SECTION */}
            <div style={{marginTop:'1.25rem',paddingTop:'1.25rem',borderTop:'1.5px solid var(--gray2)',position:'relative',zIndex:10}}>
              <label className="form-label">Promo Code</label>
              <div style={{display:'flex',alignItems:'center',background:'var(--gray1)',border:'1.5px solid var(--gray2)',borderRadius:14,overflow:'hidden'}} className="focus-within:bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10 transition-all duration-200">
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value)} 
                  placeholder="Enter code" 
                  style={{flex:1,minWidth:0,background:'transparent',padding:'.6rem 1rem',fontSize:'.8rem',fontWeight:700,color:'var(--dark)',textTransform:'uppercase',outline:'none',letterSpacing:'.05em'}}
                  className="placeholder:text-[var(--gray3)] placeholder:font-normal placeholder:normal-case"
                />
                <button 
                  onClick={handleApplyPromo} 
                  style={{margin:'0 .5rem',padding:'.4rem .9rem',background:'var(--dark)',color:'#fff',fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',borderRadius:100,letterSpacing:'.08em',border:'none',cursor:'pointer',flexShrink:0}}
                  className="hover:bg-[var(--primary)] transition-colors"
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
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem',fontSize:'.875rem',fontWeight:600,color:'var(--gray4)',marginTop:'1.5rem',borderBottom:'1.5px solid var(--gray2)',paddingBottom:'1.25rem',marginBottom:'1.25rem',position:'relative',zIndex:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Subtotal ({activeItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                <span style={{color:'var(--dark)',fontWeight:700}}>৳{subtotal.toLocaleString()}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Delivery Fee ({totalWeight}kg)</span>
                <span style={{color:'var(--dark)',fontWeight:700}}>৳{deliveryFee.toLocaleString()}</span>
              </div>
              {appliedPromo && (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',color:'var(--green)'}}>
                  <span>Discount ({appliedPromo.code})</span>
                  <span style={{fontWeight:700}}>- ৳{discountAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Invoicing Values */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',position:'relative',zIndex:10}}>
              <span style={{fontWeight:700,color:'var(--dark)',fontSize:'.9rem',textTransform:'uppercase',letterSpacing:'.08em'}}>Total</span>
              <span style={{fontWeight:900,fontSize:'1.75rem',color:'var(--dark)'}}>৳{total.toLocaleString()}</span>
            </div>
            
            <button 
              onClick={handleConfirmOrder} 
              disabled={activeItems.length === 0}
              className={`btn-primary w-full relative z-10 ${
                activeItems.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              style={{
                justifyContent:'center',
                fontSize:'.95rem',
                padding:'1.1rem',
                background: activeItems.length === 0 ? 'var(--gray2)' : 'linear-gradient(135deg,#E8540A,#FF7A35)',
                color: activeItems.length === 0 ? 'var(--gray4)' : '#fff',
                boxShadow: activeItems.length > 0 ? '0 8px 24px rgba(232,84,10,0.25)' : 'none'
              }}
            >
              <span>Confirm Order</span>
              <span style={{fontSize:'1.25rem',fontWeight:700}}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}