import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';

// Fix #12: use crypto.randomUUID() to eliminate Date.now() millisecond collision risk
function generateUniqueId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function Checkout() {
  const { cart, setCart, removeFromCart, updateQuantity, toggleSelection, clearCart } = useCart();
  const [liveProducts, setLiveProducts] = useState([]);
  const [livePromos, setLivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState({ text: '', type: '' });
  
  const [customerName, setCustomerName] = useState('');
  const [userProfileName, setUserProfileName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [highlightDelivery, setHighlightDelivery] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21 });

  const [deliveryHouseNumber, setDeliveryHouseNumber] = useState('');
  const [deliveryPostcode, setDeliveryPostcode] = useState('Postal Code: ');
  const [showMapModal, setShowMapModal] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState({ lat: 23.6850, lng: 90.3563 });
  const mapRef = useRef(null);

  useEffect(() => {
    if (showMapModal) {
      const linkId = 'leaflet-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      
      const scriptId = 'leaflet-js';
      let script = document.getElementById(scriptId);
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = false;
        document.head.appendChild(script);
      }

      const initMap = () => {
        if (!window.L || mapRef.current) return;
        const container = document.getElementById('leaflet-map-container');
        if (!container) return;

        const startLat = deliveryCoords ? deliveryCoords.lat : 23.6850;
        const startLng = deliveryCoords ? deliveryCoords.lng : 90.3563;
        setPinnedCoords({ lat: startLat, lng: startLng });

        mapRef.current = window.L.map(container).setView([startLat, startLng], deliveryCoords ? 15 : 7);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapRef.current);

        mapRef.current.on('move', function () {
          const center = mapRef.current.getCenter();
          setPinnedCoords({ lat: center.lat, lng: center.lng });
        });
      };

      if (window.L) {
        initMap();
      } else {
        script.addEventListener('load', initMap);
      }

      return () => {
        if (script) script.removeEventListener('load', initMap);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }
  }, [showMapModal, deliveryCoords]);

  const handleConfirmMapPin = async () => {
    setDeliveryCoords({ lat: pinnedCoords.lat, lng: pinnedCoords.lng });
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pinnedCoords.lat}&lon=${pinnedCoords.lng}&accept-language=en`,
        { headers: { 'User-Agent': 'VertexPicks/1.0' } }
      );
      if (!response.ok) throw new Error("Geocoding failed");
      const data = await response.json();
      
      let formattedAddress = "";
      if (data.address) {
        const { road, neighbourhood, town, city, state_district, state, postcode, country } = data.address;
        console.log('Nominatim postcode raw value:', postcode, '| Full address object:', JSON.stringify(data.address));
        const parts = [road, neighbourhood, city || town, state_district, state, postcode, country];
        formattedAddress = Array.from(new Set(parts)).filter(Boolean).join(', ');
        if (postcode) {
          setDeliveryPostcode('Postal Code: ' + postcode);
        } else {
          setDeliveryPostcode('');
        }
      } else {
        formattedAddress = data.display_name || '';
      }
      
      setDeliveryAddress(formattedAddress.trim());
      setShowMapModal(false);
      toast.success('📍 Location pinned! Please add your house/flat number above.');
    } catch {
      toast.error('Failed to resolve address. Please try again or type manually.');
      setShowMapModal(false);
    }
  };

  useEffect(() => {
    const fetchCheckoutData = async (currentUser) => {
      try {
        const productSnap = await getDocs(collection(db, 'mangoes'));
        setLiveProducts(productSnap.docs
          .filter(d => !['STORE_SECTIONS', 'STORE_SETTINGS', 'NAVBAR_TABS', 'CATEGORIES', 'FILTERS', 'VARIETIES'].includes(d.id))
          .map(doc => ({ id: doc.id, ...doc.data() })));
        
        const promoSnap = await getDocs(collection(db, 'promos'));
        setLivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (configSnap.exists()) {
          const cData = configSnap.data();
          setStoreConfig({
            baseDeliveryFee: cData.baseDeliveryFee ?? 110,
            perKgFee: cData.perKgFee ?? 21,
          });
        }
        
        // B8 fix: use the resolved currentUser from onAuthStateChanged
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          let mainName = '';
          if (userDoc.exists()) {
            const data = userDoc.data();
            mainName = data.name || currentUser.displayName || '';
            setUserProfileName(mainName);
            
            if (data.addresses && data.addresses.length > 0) {
              setSavedAddresses(data.addresses);
              const defaultAddr = data.addresses.find(a => a.isDefault) || data.addresses[0];
              setSelectedAddressId(defaultAddr.id);
              setDeliveryAddress(defaultAddr.address);
              setDeliveryPhone(defaultAddr.phone);
              setDeliveryCoords(defaultAddr.coords || null);
              setDeliveryPostcode(defaultAddr.postcode || '');
              setCustomerName(defaultAddr.recipientName || mainName);
            } else {
              setCustomerName(mainName);
              if (data.address) {
                setDeliveryAddress(data.address);
                setDeliveryPhone(data.phone || '');
                setDeliveryCoords(null);
                setDeliveryPostcode(data.postcode || '');
              }
            }
          } else {
            mainName = currentUser.displayName || '';
            setUserProfileName(mainName);
            setCustomerName(mainName);
          }
        } else {
          const guestAddrs = JSON.parse(localStorage.getItem('vertex_guest_addresses') || '[]');
          if (guestAddrs.length > 0) {
            setSavedAddresses(guestAddrs);
            const defaultAddr = guestAddrs[0];
            setDeliveryAddress(defaultAddr.address);
            setDeliveryPhone(defaultAddr.phone);
            setDeliveryCoords(defaultAddr.coords);
            setDeliveryPostcode(defaultAddr.postcode || '');
            setSelectedAddressId(defaultAddr.id);
          }
        }
      } catch (err) {
        console.error("Error fetching checkout data:", err);
      } finally {
        setLoading(false);
      }
    };
    // Fix #11: onAuthStateChanged can fire twice (null → user) on mount.
    // Use a `loaded` flag so we only call fetchCheckoutData once.
    let loaded = false;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!loaded) {
        loaded = true;
        fetchCheckoutData(currentUser);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Automatic cart deduplication / normalization sweep
  useEffect(() => {
    if (liveProducts.length > 0 && cart.length > 0 && setCart) {
      let cartChanged = false;
      const mergedCart = [];

      cart.forEach(cartItem => {
        const product = liveProducts.find(p => p.id === cartItem.id);
        if (!product) {
          mergedCart.push(cartItem);
          return;
        }

        const hasMultipleWeights = product.weightOptions && product.weightOptions.length > 1;
        const getNormW = (w) => {
          if (!w) return '';
          return w.toString().trim().toUpperCase().replace(/\s+/g, '').replace(/BOX|BAG|PACK|PCS/gi, '');
        };

        const targetNormW = getNormW(cartItem.selectedWeight);

        const existingIndex = mergedCart.findIndex(item => {
          if (item.id !== cartItem.id) return false;
          if (!hasMultipleWeights) return true; // Merge if product only has 1 or no weight option
          return getNormW(item.selectedWeight) === targetNormW;
        });

        if (existingIndex > -1) {
          mergedCart[existingIndex].quantity += cartItem.quantity;
          if (!mergedCart[existingIndex].selectedWeight && cartItem.selectedWeight) {
            mergedCart[existingIndex].selectedWeight = cartItem.selectedWeight;
          }
          cartChanged = true;
        } else {
          let resolvedWeight = cartItem.selectedWeight;
          if (!resolvedWeight) {
            if (product.weightOptions && product.weightOptions.length > 0) {
              resolvedWeight = product.weightOptions[0];
              cartChanged = true;
            } else if (product.fixedWeight) {
              resolvedWeight = `${product.fixedWeight}kg Box`;
              cartChanged = true;
            }
          }
          mergedCart.push({
            ...cartItem,
            selectedWeight: resolvedWeight,
            selected: cartItem.selected !== false
          });
        }
      });

      if (cartChanged) {
        setCart(mergedCart);
      }
    }
  }, [liveProducts, cart, setCart]);

  const handleAddressSelect = (addrId) => {
    setSelectedAddressId(addrId);
    if (addrId === 'new') {
      setDeliveryAddress('');
      setDeliveryPhone('');
      setDeliveryCoords(null);
      setDeliveryPostcode('');
      setDeliveryHouseNumber('');
      setCustomerName(userProfileName);
    } else {
      const addr = savedAddresses.find(a => a.id === addrId);
      if (addr) {
        const mergedAddress = addr.houseNumber ? `${addr.houseNumber}, ${addr.address}` : addr.address;
        setDeliveryAddress(mergedAddress);
        setDeliveryPhone(addr.phone);
        setDeliveryCoords(addr.coords || null);
        setDeliveryPostcode(addr.postcode || '');
        setDeliveryHouseNumber(addr.houseNumber || '');
        if (addr.recipientName) {
          setCustomerName(addr.recipientName);
        }
      }
    }
  };

  const parseWeight = (selectedWeightStr, fallbackWeight) => {
    if (!selectedWeightStr) return fallbackWeight;
    const kgMatch = selectedWeightStr.match(/(\d+(?:\.\d+)?)\s*k?g/i);
    if (kgMatch) return Number(kgMatch[1]);
    const gMatch = selectedWeightStr.match(/(\d+(?:\.\d+)?)\s*g/i);
    if (gMatch) return Number(gMatch[1]) / 1000;
    return fallbackWeight;
  };

  const cartItemsWithPrice = [];
  cart.forEach(cartItem => {
    const product = liveProducts.find(p => p.id === cartItem.id);
    if (!product) return;

    const hasMultipleWeights = product.weightOptions && product.weightOptions.length > 1;
    const getNormW = (w) => {
      if (!w) return '';
      return w.toString().trim().toUpperCase().replace(/\s+/g, '').replace(/BOX|BAG|PACK|PCS/gi, '');
    };

    let resolvedWeight = cartItem.selectedWeight;
    if (!resolvedWeight) {
      if (product.weightOptions && product.weightOptions.length > 0) {
        resolvedWeight = product.weightOptions[0];
      } else if (product.fixedWeight) {
        resolvedWeight = `${product.fixedWeight}kg Box`;
      }
    }

    const targetNormW = getNormW(resolvedWeight);

    const existing = cartItemsWithPrice.find(item => {
      if (item.id !== cartItem.id) return false;
      if (!hasMultipleWeights) return true;
      return getNormW(item.selectedWeight) === targetNormW;
    });

    if (existing) {
      existing.quantity += cartItem.quantity;
      if (!existing.selectedWeight && resolvedWeight) {
        existing.selectedWeight = resolvedWeight;
      }
    } else {
      cartItemsWithPrice.push({
        ...product,
        quantity: cartItem.quantity,
        weight: Number(product.fixedWeight) || 1,
        selected: cartItem.selected !== false,
        selectedWeight: resolvedWeight || null
      });
    }
  });

  const activeItems = cartItemsWithPrice.filter(item => item.selected);

  const subtotal = activeItems.reduce((sum, item) => {
    const activePrice = Number(item.discountPrice) || Number(item.price) || 0;
    return sum + (activePrice * item.quantity);
  }, 0);

  const totalWeight = activeItems.reduce((sum, item) => {
    const w = parseWeight(item.selectedWeight, Number(item.fixedWeight) || 1);
    return sum + (w * item.quantity);
  }, 0);
  const deliveryFee = totalWeight > 0 ? storeConfig.baseDeliveryFee + ((totalWeight - 1) * storeConfig.perKgFee) : 0;

  // B5 fix: support both flat and percentage discounts
  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === 'flat') {
      discountAmount = appliedPromo.value || 0;
    } else {
      discountAmount = Math.round(subtotal * ((appliedPromo.value || 0) / 100));
    }
  }

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyPromo = () => {
    const codeEntered = promoCode.trim().toUpperCase();
    const foundPromo = livePromos.find(p => p.code === codeEntered);
    if (!foundPromo) {
      setAppliedPromo(null);
      setPromoMessage({ text: 'Invalid or expired code.', type: 'error' });
      toast.error('Invalid promo code');
      return;
    }
    // B5 fix: check expiry
    if (foundPromo.expires) {
      const expiry = new Date(foundPromo.expires);
      // To be safe and treat expires as end of day
      expiry.setHours(23, 59, 59, 999);
      if (expiry < new Date()) {
        setAppliedPromo(null);
        setPromoMessage({ text: 'This promo code has expired.', type: 'error' });
        toast.error('Promo code has expired');
        return;
      }
    }
    // B5 fix: check usage limit
    if (foundPromo.limit && (foundPromo.usedCount || 0) >= foundPromo.limit) {
      setAppliedPromo(null);
      setPromoMessage({ text: 'This promo code has reached its usage limit.', type: 'error' });
      toast.error('Promo code usage limit reached');
      return;
    }
    // B5 fix: check minimum order amount
    if (foundPromo.minOrder && subtotal < foundPromo.minOrder) {
      setAppliedPromo(null);
      setPromoMessage({ text: `Min. order of ৳${foundPromo.minOrder} required.`, type: 'error' });
      toast.error(`Min. order ৳${foundPromo.minOrder} required`);
      return;
    }
    setAppliedPromo(foundPromo);
    const label = foundPromo.type === 'flat'
      ? `৳${foundPromo.value} OFF Applied!`
      : `${foundPromo.value}% Discount Applied!`;
    setPromoMessage({ text: label, type: 'success' });
    toast.success('Promo code applied!');
  };

  const handleConfirmOrder = async () => {
    if (activeItems.length === 0) return toast.error("Select at least one item to checkout!");
    
    const isNewAddress = selectedAddressId === 'new' || savedAddresses.length === 0;
    if (!customerName || !deliveryPhone || !deliveryAddress || (isNewAddress && !deliveryHouseNumber)) {
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
      const finalAddress = isNewAddress
        ? (deliveryHouseNumber.trim() ? `${deliveryHouseNumber.trim()}, ${deliveryAddress}` : deliveryAddress)
        : deliveryAddress;

      const orderData = {
        customerEmail: auth.currentUser?.email ? auth.currentUser.email : 'guest@vertexpicks.com',
        customerName: customerName,
        deliveryAddress: finalAddress,
        deliveryPhone: deliveryPhone,
        deliveryCoords: deliveryCoords,
        deliveryPostcode: deliveryPostcode,
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

      if (appliedPromo) {
        const promoRef = doc(db, 'promos', appliedPromo.id);
        await setDoc(promoRef, { usedCount: (appliedPromo.usedCount || 0) + 1 }, { merge: true });
      }
      
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
          address: finalAddress,
          phone: deliveryPhone,
          coords: deliveryCoords || null,
          postcode: deliveryPostcode,
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

      activeItems.forEach(item => {
        removeFromCart(item.id, item.selectedWeight);
      });
      
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
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', fontFamily: "'Sora', sans-serif" }}>
      <div className="checkout-container px-4 py-8" style={{ boxSizing: 'border-box', paddingTop: '168px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.5rem', textTransform: 'uppercase' }}>
            Checkout Summary
          </h1>
        </div>
        <div className="checkout-grid-container">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {cartItemsWithPrice.length === 0 ? (
              <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow-color)', padding: '1.4rem', textAlign: 'center', height: '20rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your cart is empty.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem' }}>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    🛒 Cart Items
                  </h3>
                  <span style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.7rem' }}>
                    {activeItems.length} selected
                  </span>
                </div>
              
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {cartItemsWithPrice.map(item => {
                    const displayPrice = item.discountPrice || item.price;
                    return (
                      <div 
                        key={`${item.id}-${item.selectedWeight || ''}`} 
                        className="checkout-cart-card"
                        style={{ opacity: item.selected ? 1 : 0.6 }}
                      >
                        <input 
                          type="checkbox"
                          checked={item.selected !== false}
                          onChange={() => toggleSelection(item.id, item.selectedWeight)}
                          style={{ accentColor: 'var(--primary)', width: '1.25rem', height: '1.25rem', cursor: 'pointer', margin: 0 }}
                        />
                        <div className="checkout-cart-img-wrap">
                          <img 
                            src={item.image || (item.images && item.images[0]) || 'placeholder.jpg'} 
                            alt={item.name} 
                            className="checkout-cart-img"
                          />
                        </div>
                        <div className="checkout-cart-info">
                          <h4 className="checkout-cart-title">
                            {item.name}
                          </h4>
                          {item.selectedWeight && (
                            <div style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-primary)', padding: '0.2rem 0.6rem', borderRadius: '100px', display: 'inline-block' }}>
                                {item.selectedWeight}
                              </span>
                            </div>
                          )}
                          <p className="checkout-cart-price">
                            ৳{displayPrice.toLocaleString()}
                          </p>
                        </div>
                        <div className="checkout-qty-selector">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedWeight)}
                            className="checkout-qty-btn"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => {
                              const val = e.target.value;
                              updateQuantity(item.id, val === '' ? '' : Math.max(1, parseInt(val) || 1), item.selectedWeight);
                            }}
                            onBlur={() => {
                              if (item.quantity === '' || item.quantity < 1) {
                                updateQuantity(item.id, 1, item.selectedWeight);
                              }
                            }}
                            className="checkout-qty-input"
                          />
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedWeight)} 
                            className="checkout-qty-btn"
                          >
                            +
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id, item.selectedWeight)} 
                          className="checkout-delete-btn"
                          title="Remove Item"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        <div className="w-full flex justify-center lg:block">
          <div 
            style={{background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow-color)', padding: '1.4rem', maxWidth: 420, width: '100%', margin: '0 auto'}}
          >
            
            <div style={{marginBottom:'1.5rem',borderBottom:'1px solid var(--border-color)',paddingBottom:'1.25rem'}}>
              <h3 style={{fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <span style={{fontSize:'1.25rem'}}>🚚</span> Delivery & Payment
              </h3>
            </div>
            
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem',
                border: highlightDelivery ? '2px solid var(--red)' : '2px solid transparent',
                borderRadius: '12px',
                padding: highlightDelivery ? '0.5rem' : '0',
                transition: 'border-color 0.3s ease, padding 0.3s ease'
              }}
            >
              {savedAddresses.length > 0 && (
                <div style={{ paddingTop: '0.25rem' }}>
                  <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Address Book</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {[...savedAddresses]
                      .sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1))
                      .map(addr => (
                      <label 
                        key={addr.id} 
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', background: selectedAddressId === addr.id ? 'var(--primary-pale)' : 'var(--bg-card)', border: selectedAddressId === addr.id ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)' }}
                      >
                        <input 
                          type="radio" 
                          name="addressSelect" 
                          checked={selectedAddressId === addr.id} 
                          onChange={() => handleAddressSelect(addr.id)} 
                          style={{ accentColor: 'var(--primary)', width: '1rem', height: '1rem', cursor: 'pointer', marginTop: '0.2rem' }} 
                        />
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                          <span style={{ display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-primary)', padding: '0.3rem 0.7rem', borderRadius: '100px' }}>
                            {addr.label} {addr.isDefault && '• Default'}
                          </span>
                          {addr.recipientName && (
                            <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', marginTop: '0.4rem', fontFamily: "'Sora', sans-serif" }}>
                              👤 {addr.recipientName}
                            </p>
                          )}
                          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', marginTop: addr.recipientName ? '0.2rem' : '0.4rem', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.5, fontFamily: "'Sora', sans-serif" }}>
                            {addr.houseNumber ? `${addr.houseNumber}, ` : ''}{addr.address}{addr.postcode ? `, ${addr.postcode}` : ''}
                          </p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.2rem', fontFamily: "'Sora', sans-serif" }}>{addr.phone}</p>
                        </div>
                      </label>
                    ))}
                    <label 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', background: selectedAddressId === 'new' ? 'var(--primary-pale)' : 'var(--bg-card)', border: selectedAddressId === 'new' ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)' }}
                    >
                      <input 
                        type="radio" 
                        name="addressSelect" 
                        checked={selectedAddressId === 'new'} 
                        onChange={() => handleAddressSelect('new')} 
                        style={{ accentColor: '#E8540A', width: '1rem', height: '1rem', cursor: 'pointer' }} 
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: "'Sora', sans-serif" }}>Deliver to a New Address</span>
                    </label>
                  </div>
                </div>
              )}

              {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.25rem' }}>
                  <div>
                    <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Recipient Name</label>
                    <input 
                      type="text" 
                      value={customerName} 
                      onChange={e => setCustomerName(e.target.value)} 
                      required 
                      placeholder="E.g. Adnan Rahman" 
                      style={{ background: 'var(--input-bg)', border: (highlightDelivery && !customerName) ? '1.5px solid var(--red)' : '1.5px solid var(--border-color)', boxShadow: (highlightDelivery && !customerName) ? '0 0 0 4px rgba(239, 68, 68, 0.15)' : 'none', borderRadius: '8px', padding: '0.65rem 1rem', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', outline: 'none', transition: 'all 0.3s ease' }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>BD Phone Number</label>
                    <input 
                      type="tel" 
                      value={deliveryPhone} 
                      onChange={e => setDeliveryPhone(e.target.value)} 
                      required 
                      placeholder="E.g. 01712345678" 
                      style={{ background: 'var(--input-bg)', border: (phoneError || (highlightDelivery && !deliveryPhone)) ? '1.5px solid var(--red)' : '1.5px solid var(--border-color)', boxShadow: (phoneError || (highlightDelivery && !deliveryPhone)) ? '0 0 0 4px rgba(239, 68, 68, 0.15)' : 'none', borderRadius: '8px', padding: '0.65rem 1rem', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', outline: 'none', transition: 'all 0.3s ease' }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0, display: 'block' }}>Full Shipping Address</label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setShowMapModal(true)}
                          style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, outline: 'none', padding: 0, fontFamily: "'Sora', sans-serif" }}
                        >
                          🗺️ Pin on Map
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchCurrentLocation(setDeliveryAddress, setLocating, setDeliveryCoords, setDeliveryPostcode)}
                          disabled={locating}
                          style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, outline: 'none', padding: 0, fontFamily: "'Sora', sans-serif" }}
                        >
                          {locating ? '⏳ Detecting area...' : '📍 Auto-fill Area'}
                        </button>
                      </div>
                    </div>
                    <textarea 
                      value={deliveryAddress} 
                      onChange={e => { setDeliveryAddress(e.target.value); setDeliveryCoords(null); }} 
                      required 
                      placeholder="House, Road, Apartment, Area, City..." 
                      style={{ background: 'var(--input-bg)', border: (highlightDelivery && !deliveryAddress) ? '1.5px solid var(--red)' : '1.5px solid var(--border-color)', boxShadow: (highlightDelivery && !deliveryAddress) ? '0 0 0 4px rgba(239, 68, 68, 0.15)' : 'none', borderRadius: '8px', padding: '0.65rem 1rem', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', outline: 'none', height: '80px', resize: 'none', transition: 'all 0.3s ease' }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>House / Flat / Road Number</label>
                    <input 
                      type="text" 
                      value={deliveryHouseNumber} 
                      onChange={e => setDeliveryHouseNumber(e.target.value)} 
                      placeholder="E.g. House 12, Road 4, Apt 3B" 
                      required
                      style={{ background: 'var(--input-bg)', border: (highlightDelivery && !deliveryHouseNumber) ? '1.5px solid var(--red)' : '1.5px solid var(--border-color)', boxShadow: (highlightDelivery && !deliveryHouseNumber) ? '0 0 0 4px rgba(239, 68, 68, 0.15)' : 'none', borderRadius: '8px', padding: '0.65rem 1rem', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', outline: 'none', transition: 'all 0.3s ease' }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Postal Code</label>
                    <input 
                      type="text" 
                      value={deliveryPostcode} 
                      onChange={e => setDeliveryPostcode(e.target.value)} 
                      placeholder="Auto-filled or enter manually" 
                      style={{ background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem 1rem', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', color: 'var(--text-primary)', width: '100%', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          <div className="w-full flex justify-center lg:block">
            <div 
              style={{background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow-color)', padding: '1.4rem', maxWidth: 420, width: '100%', margin: '0 auto'}}
            >
              <div style={{marginBottom:'1.5rem',borderBottom:'1px solid var(--border-color)',paddingBottom:'1.25rem'}}>
                <h3 style={{fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <span style={{fontSize:'1.25rem'}}>📝</span> Order Summary
                </h3>
              </div>

              {/* GIFT CARD OR PROMO CODE SECTION */}
              <div style={{ marginTop: '0', paddingTop: '0' }}>
              <label style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Promo Code</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', borderRadius: '8px', padding: '0.2rem', overflow: 'hidden' }}>
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value)} 
                  placeholder="Enter code" 
                  style={{ flex: 1, minWidth: 0, background: 'transparent', padding: '0.45rem 0.8rem', fontSize: '0.875rem', fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)', outline: 'none', border: 'none' }}
                />
                <button 
                  onClick={handleApplyPromo} 
                  style={{ background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', borderRadius: '100px', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', padding: '0.5rem 1.1rem', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                >
                  Apply
                </button>
              </div>
              {promoMessage.text && (
                <p style={{ 
                  fontFamily: "'Sora', sans-serif", 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: promoMessage.type === 'success' ? '#10B981' : '#EF4444', 
                  marginTop: '0.4rem', 
                  margin: 0 
                }}>
                  {promoMessage.text}
                </p>
              )}
            </div>

            {/* Calculations Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.85rem', color: 'var(--text-muted)' }}>Subtotal ({activeItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Sora', sans-serif", fontSize: '0.85rem' }}>৳{subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.85rem', color: 'var(--text-muted)' }}>Delivery Fee ({totalWeight}kg)</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Sora', sans-serif", fontSize: '0.85rem' }}>৳{deliveryFee.toLocaleString()}</span>
              </div>
              {appliedPromo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                  <span style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discount ({appliedPromo.code})</span>
                  <span style={{ fontWeight: 600, fontFamily: "'Sora', sans-serif", fontSize: '0.85rem' }}>- ৳{discountAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Invoicing Values */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Grand Total</span>
              <span style={{ color: '#E8540A', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.3rem' }}>৳{total.toLocaleString()}</span>
            </div>
            
            <button 
              onClick={handleConfirmOrder} 
              disabled={activeItems.length === 0}
              style={{
                background: '#E8540A',
                color: '#FFFFFF',
                borderRadius: '100px',
                fontWeight: 700,
                fontSize: '1rem',
                fontFamily: "'Sora', sans-serif",
                padding: '0.85rem 2rem',
                width: '100%',
                border: 'none',
                boxShadow: '0 6px 24px rgba(232,84,10,0.3)',
                cursor: activeItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: activeItems.length === 0 ? 0.5 : 1,
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={e => {
                if(activeItems.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 32px rgba(232,84,10,0.4)';
                }
              }}
              onMouseLeave={e => {
                if(activeItems.length > 0) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,84,10,0.3)';
                }
              }}
            >
              <span>Confirm Order</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    {/* MAP PIN MODAL */}
    {showMapModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', width: '90%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 20px 60px var(--shadow-color)' }}>
          <div style={{ background: 'var(--navbar-bg)', padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1rem', margin: 0 }}>Pin Your Location</h3>
            <button 
              onClick={() => setShowMapModal(false)}
              style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', padding: 0 }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ padding: '0', position: 'relative' }}>
            <div id="leaflet-map-container" style={{ width: '100%', height: '380px' }}></div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', fontSize: '2rem', content: "'📍'" }}>📍</div>
          </div>
          
          <div style={{ padding: '1.4rem' }}>
            <div style={{ margin: '0 0 1rem 0' }}>
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.3rem 0' }}>
                Drag the pin to your exact location. Then click Confirm.
              </p>
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', color: '#E8540A', fontWeight: 600, margin: 0 }}>
                📌 Current coordinates will be saved with your order for precise delivery.
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setShowMapModal(false)}
                style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '100px', color: 'var(--text-primary)', fontWeight: 700, padding: '0.6rem 1.4rem', fontFamily: "'Sora', sans-serif", cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button 
                onClick={handleConfirmMapPin}
                style={{ background: '#E8540A', color: '#FFFFFF', border: 'none', borderRadius: '100px', fontWeight: 700, padding: '0.6rem 1.4rem', fontFamily: "'Sora', sans-serif", boxShadow: '0 6px 24px rgba(232,84,10,0.3)', cursor: 'pointer' }}
              >
                CONFIRM LOCATION
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
