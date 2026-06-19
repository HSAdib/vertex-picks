import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, arrayUnion, runTransaction, increment } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; 
import { onAuthStateChanged } from 'firebase/auth';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';
import { ShoppingBag, Box, Truck, MapPin, Ticket, ShieldCheck, PhoneCall, Check, Trash2, Plus, Minus, ArrowRight, Edit } from 'lucide-react';

// Fix #12: use crypto.randomUUID() to eliminate Date.now() millisecond collision risk
function generateUniqueId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function Checkout() {
  const { cart, setCart, removeFromCart, updateQuantity, toggleSelection } = useCart();
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
  const [packagingOptions, setPackagingOptions] = useState([]);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [selectedPackaging, setSelectedPackaging] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const [deliveryHouseNumber, setDeliveryHouseNumber] = useState('');
  const [deliveryPostcode, setDeliveryPostcode] = useState('Postal Code: ');
  const [showMapModal, setShowMapModal] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState({ lat: 23.6850, lng: 90.3563 });
  const mapRef = useRef(null);

  const [showEditAddressModal, setShowEditAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHouseNumber, setEditHouseNumber] = useState('');
  const [editAddressText, setEditAddressText] = useState('');
  const [editPostcode, setEditPostcode] = useState('');
  const [editCoords, setEditCoords] = useState(null);
  const [editLocating, setEditLocating] = useState(false);

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
    let loadId = 0;
    const fetchCheckoutData = async (currentUser, requestId) => {
      try {
        const productSnap = await getDocs(collection(db, 'mangoes'));
        if (requestId !== loadId) return;
        setLiveProducts(productSnap.docs
          .filter(d => !['STORE_SECTIONS', 'STORE_SETTINGS', 'NAVBAR_TABS', 'CATEGORIES', 'FILTERS', 'VARIETIES', 'PACKAGING_OPTIONS', 'DELIVERY_OPTIONS'].includes(d.id))
          .map(doc => ({ id: doc.id, ...doc.data() })));
        
        const promoSnap = await getDocs(collection(db, 'promos'));
        if (requestId !== loadId) return;
        setLivePromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (requestId !== loadId) return;
        if (configSnap.exists()) {
          const cData = configSnap.data();
          setStoreConfig({
            baseDeliveryFee: cData.baseDeliveryFee ?? 110,
            perKgFee: cData.perKgFee ?? 21,
          });
        }

        // Fetch packaging options
        const pkgSnap = await getDoc(doc(db, 'mangoes', 'PACKAGING_OPTIONS'));
        if (requestId !== loadId) return;
        if (pkgSnap.exists() && Array.isArray(pkgSnap.data().options)) {
          const activePkgs = pkgSnap.data().options.filter(p => p.active !== false);
          setPackagingOptions(activePkgs);
        }

        // Fetch delivery options
        const dlvSnap = await getDoc(doc(db, 'mangoes', 'DELIVERY_OPTIONS'));
        if (requestId !== loadId) return;
        if (dlvSnap.exists() && Array.isArray(dlvSnap.data().options)) {
          const activeDlvs = dlvSnap.data().options.filter(d => d.active !== false);
          setDeliveryOptions(activeDlvs);
        }
        
        // B8 fix: use the resolved currentUser from onAuthStateChanged
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (requestId !== loadId) return;
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
        if (requestId === loadId) setLoading(false);
      }
    };
    // Auth can fire guest first, then the real user. Load once per resolved user key.
    let loadedUserKey;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      const userKey = currentUser?.uid || 'guest';
      if (loadedUserKey === userKey) return;
      loadedUserKey = userKey;
      fetchCheckoutData(currentUser, ++loadId);
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
    const kgMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*k?g/i);
    if (kgMatch) return Number(kgMatch[1]);
    const gMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*g/i);
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
  // --- Packaging cost calculation ---
  const calcPackagingCost = (pkg) => {
    if (!pkg || totalWeight <= 0) return { units: 0, cost: 0 };
    const capacity = Number(pkg.maxCapacity) || 1;
    const units = Math.ceil(totalWeight / capacity);
    const price = Number(pkg.price) || 0;
    return { units, cost: units * price };
  };

  // Auto-select first compatible packaging if none selected
  if (!selectedPackaging && packagingOptions.length > 0 && totalWeight > 0) {
    setSelectedPackaging(packagingOptions[0].id);
  }

  const currentPackaging = packagingOptions.find(p => p.id === selectedPackaging);
  const { units: packagingUnits, cost: packagingCost } = calcPackagingCost(currentPackaging);

  // --- Delivery fee calculation ---
  const calcDeliveryFee = (dlv) => {
    if (!dlv || totalWeight <= 0) return 0;
    const perKgRate = Number(dlv.perKgRate) || 0;
    const firstKgPrice = Number(dlv.firstKgPrice) || 0;
    const extraKgRate = Number(dlv.extraKgRate) || 0;
    if (dlv.pricingType === 'per_kg') {
      return perKgRate * totalWeight;
    } else {
      return firstKgPrice + (extraKgRate * Math.max(0, totalWeight - 1));
    }
  };

  // Auto-select cheapest delivery if none selected
  if (!selectedDelivery && deliveryOptions.length > 0 && totalWeight > 0) {
    const cheapest = [...deliveryOptions].sort((a, b) => calcDeliveryFee(a) - calcDeliveryFee(b))[0];
    setSelectedDelivery(cheapest.id);
  }

  const currentDelivery = deliveryOptions.find(d => d.id === selectedDelivery);
  const deliveryFee = deliveryOptions.length > 0 ? calcDeliveryFee(currentDelivery) : (totalWeight > 0 ? storeConfig.baseDeliveryFee + ((totalWeight - 1) * storeConfig.perKgFee) : 0);

  // B5 fix: support both flat and percentage discounts
  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === 'flat') {
      discountAmount = appliedPromo.value || 0;
    } else {
      discountAmount = Math.round(subtotal * ((appliedPromo.value || 0) / 100));
    }
  }

  const total = Math.max(0, subtotal + packagingCost + deliveryFee - discountAmount);

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
        packagingOption: currentPackaging ? { id: currentPackaging.id, label: currentPackaging.label, type: currentPackaging.type, unitsNeeded: packagingUnits, unitPrice: currentPackaging.price, totalCost: packagingCost } : null,
        packagingCost: packagingCost,
        deliveryMethod: currentDelivery ? { id: currentDelivery.id, label: currentDelivery.label, totalCost: deliveryFee } : null,
        deliveryFee: deliveryFee,
        discount: discountAmount,
        promoUsed: appliedPromo ? appliedPromo.code : 'None',
        total: total,
        status: 'Pending',
        isGuest: !auth.currentUser?.email,
        createdAt: new Date()
      };
      
      const orderRef = doc(collection(db, 'orders'));
      await runTransaction(db, async (transaction) => {
        if (appliedPromo) {
          const promoRef = doc(db, 'promos', appliedPromo.id);
          const promoSnap = await transaction.get(promoRef);
          if (!promoSnap.exists()) throw new Error('Promo code no longer exists');
          const promoData = promoSnap.data();
          if (promoData.limit && (promoData.usedCount || 0) >= promoData.limit) {
            throw new Error('Promo code usage limit reached');
          }
          transaction.update(promoRef, { usedCount: increment(1) });
        }
        transaction.set(orderRef, orderData);
      });
      
      // Local backup caching for guest purchases
      if (!auth.currentUser?.email) {
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        localStorage.setItem('vertex_guest_orders', JSON.stringify([{ id: orderRef.id, ...orderData }, ...localOrders]));
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

  const labelStyle = { fontFamily: "'Sora', sans-serif", fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' };

  const handleUpdateAddress = async (updatedAddr) => {
    const updatedList = savedAddresses.map(a => a.id === updatedAddr.id ? updatedAddr : a);
    setSavedAddresses(updatedList);
    
    if (selectedAddressId === updatedAddr.id) {
      const mergedAddress = updatedAddr.houseNumber ? `${updatedAddr.houseNumber}, ${updatedAddr.address}` : updatedAddr.address;
      setDeliveryAddress(mergedAddress);
      setDeliveryPhone(updatedAddr.phone);
      setDeliveryCoords(updatedAddr.coords || null);
      setDeliveryPostcode(updatedAddr.postcode || '');
      setDeliveryHouseNumber(updatedAddr.houseNumber || '');
      if (updatedAddr.recipientName) {
        setCustomerName(updatedAddr.recipientName);
      }
    }

    try {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, { addresses: updatedList }, { merge: true });
      } else {
        localStorage.setItem('vertex_guest_addresses', JSON.stringify(updatedList));
      }
      toast.success('Address updated successfully!');
    } catch (err) {
      console.error("Failed to update address:", err);
      toast.error("Error updating address: " + err.message);
    }
  };

  const handleOpenAddressEdit = (addr) => {
    setEditingAddress(addr);
    setEditLabel(addr.label || 'Home');
    setEditRecipientName(addr.recipientName || '');
    setEditPhone(addr.phone || '');
    setEditHouseNumber(addr.houseNumber || '');
    setEditAddressText(addr.address || '');
    setEditPostcode(addr.postcode || '');
    setEditCoords(addr.coords || null);
    setShowEditAddressModal(true);
  };

  const handleSaveEditedAddress = async (e) => {
    e.preventDefault();
    if (!editLabel.trim() || !editRecipientName.trim() || !editPhone.trim() || !editAddressText.trim()) {
      return toast.error("Please fill in all required fields!");
    }
    if (!isValidBDPhoneNumber(editPhone)) {
      return toast.error("Please enter a valid Bangladeshi phone number");
    }

    const updatedAddr = {
      ...editingAddress,
      label: editLabel.trim(),
      recipientName: editRecipientName.trim(),
      phone: editPhone.trim(),
      houseNumber: editHouseNumber.trim(),
      address: editAddressText.trim(),
      postcode: editPostcode.trim(),
      coords: editCoords
    };

    await handleUpdateAddress(updatedAddr);
    setShowEditAddressModal(false);
    setEditingAddress(null);
  };

  const getStepNumber = (stepName) => {
    if (stepName === 'cart') return 1;
    if (stepName === 'packaging') {
      return (packagingOptions.length > 0 && totalWeight > 0) ? 2 : null;
    }
    if (stepName === 'delivery') {
      let num = 1;
      if (packagingOptions.length > 0 && totalWeight > 0) num++;
      return (deliveryOptions.length > 0 && totalWeight > 0) ? num + 1 : null;
    }
    if (stepName === 'address') {
      let num = 1;
      if (packagingOptions.length > 0 && totalWeight > 0) num++;
      if (deliveryOptions.length > 0 && totalWeight > 0) num++;
      return num + 1;
    }
    return 1;
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', fontFamily: "'Sora', sans-serif", transition: 'background-color 0.3s' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.25rem', paddingTop: '168px', paddingBottom: '4rem' }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div className="checkout-step-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '16px', background: 'var(--primary-pale)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag style={{ width: '1.8rem', height: '1.8rem' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.8rem', margin: 0 }}>
              Checkout
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>Review your items, choose packaging & delivery, and complete your order.</p>
          </div>
        </div>

        {/* ===== 2-COLUMN LAYOUT ===== */}
        <div className="checkout-grid-container">

          {/* ===== LEFT COLUMN (Main Flow) ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>

            {/* STEP 1: CART ITEMS */}
            <div className="checkout-section-wrap">
              <div className="checkout-step-header">
                <div className="checkout-step-icon">
                  <ShoppingBag style={{ width: '1.1rem', height: '1.1rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                    Review Cart Items
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>Confirm the items you wish to order</p>
                </div>
                <span style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.75rem', border: '1px solid var(--border-color)' }}>
                  Step {getStepNumber('cart')} · {activeItems.length} Selected
                </span>
              </div>

              {cartItemsWithPrice.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your cart is empty.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {cartItemsWithPrice.map(item => {
                    const displayPrice = item.discountPrice || item.price;
                    return (
                      <div 
                        key={`${item.id}-${item.selectedWeight || ''}`} 
                        className="checkout-cart-card"
                        style={{ opacity: item.selected ? 1 : 0.55 }}
                      >
                        <input 
                          type="checkbox"
                          checked={item.selected !== false}
                          onChange={() => toggleSelection(item.id, item.selectedWeight)}
                          style={{ accentColor: 'var(--primary)', width: '1.25rem', height: '1.25rem', cursor: 'pointer', margin: 0, flexShrink: 0 }}
                        />
                        <div className="checkout-cart-img-wrap">
                          <img 
                            src={item.image || (item.images && item.images[0]) || 'placeholder.jpg'} 
                            alt={item.name} 
                            className="checkout-cart-img"
                          />
                        </div>
                        <div className="checkout-cart-info">
                          <h4 className="checkout-cart-title">{item.name}</h4>
                          {item.selectedWeight && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-primary)', padding: '0.15rem 0.5rem', borderRadius: '100px', display: 'inline-block', marginTop: '0.15rem', border: '1px solid var(--border-color)' }}>
                              {item.selectedWeight}
                            </span>
                          )}
                          <p className="checkout-cart-price">৳{displayPrice.toLocaleString()}</p>
                        </div>
                        <div className="checkout-qty-selector">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedWeight)} className="checkout-qty-btn">−</button>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => {
                              const val = e.target.value;
                              updateQuantity(item.id, val === '' ? '' : Math.max(1, parseInt(val) || 1), item.selectedWeight);
                            }}
                            onBlur={() => {
                              if (item.quantity === '' || item.quantity < 1) updateQuantity(item.id, 1, item.selectedWeight);
                            }}
                            className="checkout-qty-input"
                          />
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedWeight)} className="checkout-qty-btn">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id, item.selectedWeight)} className="checkout-delete-btn" title="Remove">🗑️</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 2: PACKAGING */}
            {packagingOptions.length > 0 && totalWeight > 0 && (
              <div className="checkout-section-wrap animate-fadeIn">
                <div className="checkout-step-header">
                  <div className="checkout-step-icon">
                    <Box style={{ width: '1.1rem', height: '1.1rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                      Choose Packaging
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>Select how your mangoes will be packed</p>
                  </div>
                  <span style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.75rem', border: '1px solid var(--border-color)' }}>
                    Step {getStepNumber('packaging')}
                  </span>
                </div>
                
                <div className="premium-radio-grid">
                  {packagingOptions.map(pkg => {
                    const units = Math.ceil(totalWeight / pkg.maxCapacity);
                    const cost = units * pkg.price;
                    const isSelected = selectedPackaging === pkg.id;
                    return (
                      <div 
                        key={pkg.id} 
                        onClick={() => setSelectedPackaging(pkg.id)}
                        className={`premium-radio-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="premium-radio-circle"></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '.35rem', marginBottom: '.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: pkg.type === 'crate' ? '#FEF3C7' : '#DBEAFE', color: pkg.type === 'crate' ? '#92400E' : '#1E40AF', padding: '.18rem .5rem', borderRadius: '100px' }}>
                              {pkg.type}
                            </span>
                            <span style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--bg-primary)', color: 'var(--text-muted)', padding: '.18rem .5rem', borderRadius: '100px', border: '1px solid var(--border-color)' }}>
                              {pkg.quality}
                            </span>
                          </div>
                          <p style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)', margin: '0 0 .25rem 0' }}>{pkg.label}</p>
                          <p style={{ fontSize: '.73rem', color: 'var(--text-muted)', margin: '0 0 .3rem 0' }}>Holds {pkg.minCapacity}–{pkg.maxCapacity} kg · ৳{pkg.price}/unit</p>
                          <p style={{ fontSize: '.73rem', color: '#E8540A', fontWeight: 800, margin: 0 }}>
                            {units} unit{units > 1 ? 's' : ''} Needed · ৳{cost}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: DELIVERY METHOD */}
            {deliveryOptions.length > 0 && totalWeight > 0 && (
              <div className="checkout-section-wrap animate-fadeIn">
                <div className="checkout-step-header">
                  <div className="checkout-step-icon">
                    <Truck style={{ width: '1.1rem', height: '1.1rem' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                      Choose Delivery Option
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>Select your preferred courier service</p>
                  </div>
                  <span style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.75rem', border: '1px solid var(--border-color)' }}>
                    Step {getStepNumber('delivery')}
                  </span>
                </div>

                <div className="premium-radio-grid">
                  {(() => {
                    const costs = deliveryOptions.map(d => ({ ...d, cost: calcDeliveryFee(d) }));
                    const minCost = Math.min(...costs.map(c => c.cost));
                    return costs.map(dlv => {
                      const isSelected = selectedDelivery === dlv.id;
                      const isCheapest = dlv.cost === minCost && costs.filter(c => c.cost === minCost).length < costs.length;
                      return (
                        <div 
                          key={dlv.id}
                          onClick={() => setSelectedDelivery(dlv.id)}
                          className={`premium-radio-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="premium-radio-circle"></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.35rem', flexWrap: 'wrap' }}>
                              <p style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)', margin: 0 }}>{dlv.label}</p>
                              {isCheapest && <span style={{ fontSize: '.55rem', fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '.18rem .5rem', borderRadius: '100px', letterSpacing: '.03em' }}>💡 BEST VALUE</span>}
                            </div>
                            {dlv.description && <p style={{ fontSize: '.73rem', color: 'var(--text-muted)', margin: '0 0 .25rem 0', lineHeight: 1.3 }}>{dlv.description}</p>}
                            <p style={{ fontSize: '.73rem', color: 'var(--text-muted)', margin: '0 0 .3rem 0' }}>
                              {dlv.pricingType === 'per_kg' ? `৳${dlv.perKgRate}/kg × ${totalWeight} kg` : `৳${dlv.firstKgPrice} (1st kg) + ৳${dlv.extraKgRate} × ${Math.max(0, totalWeight - 1)} extra kg`}
                            </p>
                            <p style={{ fontSize: '.78rem', color: '#E8540A', fontWeight: 800, margin: 0 }}>৳{dlv.cost.toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* STEP 4: DELIVERY ADDRESS */}
            <div 
              className="checkout-section-wrap" 
              style={{ 
                border: highlightDelivery ? '2px solid #EF4444' : '1px solid var(--border-color)', 
                boxShadow: highlightDelivery ? '0 0 0 4px rgba(239, 68, 68, 0.1)' : '0 4px 20px var(--shadow-color)',
                transition: 'all 0.3s'
              }}
            >
              <div className="checkout-step-header" style={{ marginBottom: '1.25rem' }}>
                <div className="checkout-step-icon">
                  <MapPin style={{ width: '1.1rem', height: '1.1rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                    Delivery Details
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>Provide shipping information for delivery</p>
                </div>
                <span style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.75rem', border: '1px solid var(--border-color)' }}>
                  Step {getStepNumber('address')}
                </span>
              </div>

              {/* SEGMENTED CONTROL FOR ADDRESS MODE */}
              {savedAddresses.length > 0 && (
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${selectedAddressId !== 'new' ? 'active' : ''}`}
                    onClick={() => {
                      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
                      handleAddressSelect(defaultAddr.id);
                    }}
                  >
                    🏠 Saved Address
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${selectedAddressId === 'new' ? 'active' : ''}`}
                    onClick={() => handleAddressSelect('new')}
                  >
                    ➕ New Address
                  </button>
                </div>
              )}

              {/* SAVED ADDRESS CARDS GRID */}
              {savedAddresses.length > 0 && selectedAddressId !== 'new' && (
                <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginBottom: '1rem' }}>
                  {[...savedAddresses]
                    .sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1))
                    .map(addr => {
                      const isSelected = selectedAddressId === addr.id;
                      const addrIcon = (addr.label || '').toLowerCase().includes('office') ? '🏢' : (addr.label || '').toLowerCase().includes('other') ? '📍' : '🏠';
                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleAddressSelect(addr.id)}
                          className={`premium-radio-card ${isSelected ? 'selected' : ''}`}
                          style={{ padding: '1rem' }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddressEdit(addr);
                            }}
                            style={{ 
                              position: 'absolute', 
                              top: '0.75rem', 
                              right: '0.75rem', 
                              background: 'transparent', 
                              border: 'none', 
                              cursor: 'pointer', 
                              color: 'var(--text-muted)',
                              transition: 'color 0.2s',
                              padding: '0.2rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              outline: 'none',
                              zIndex: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            title="Edit Address"
                          >
                            <Edit style={{ width: '0.9rem', height: '0.9rem' }} />
                          </button>
                          <div className="premium-radio-circle"></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.9rem' }}>{addrIcon}</span>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{addr.label || 'Home'}</span>
                              {addr.isDefault && <span style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: '#D1FAE5', color: '#065F46', padding: '.15rem .5rem', borderRadius: '100px' }}>Default</span>}
                            </div>
                            {addr.recipientName && (
                              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>{addr.recipientName}</p>
                            )}
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.2rem 0', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {addr.houseNumber ? `${addr.houseNumber}, ` : ''}{addr.address}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {addr.postcode && <span>📮 {addr.postcode}</span>}
                              <span>📞 {addr.phone}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* NEW ADDRESS FORM */}
              {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>Recipient Name</label>
                      <input 
                        type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="E.g. Adnan Rahman" 
                        className="checkout-input-field"
                        style={{ borderColor: (highlightDelivery && !customerName) ? '#EF4444' : 'var(--border-color)', boxShadow: (highlightDelivery && !customerName) ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none' }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>BD Phone Number</label>
                      <input 
                        type="tel" value={deliveryPhone} onChange={e => setDeliveryPhone(e.target.value)} required placeholder="E.g. 01712345678" 
                        className="checkout-input-field"
                        style={{ borderColor: (phoneError || (highlightDelivery && !deliveryPhone)) ? '#EF4444' : 'var(--border-color)', boxShadow: (phoneError || (highlightDelivery && !deliveryPhone)) ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none' }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Full Shipping Address</label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button type="button" onClick={() => setShowMapModal(true)} style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', outline: 'none', padding: 0 }}>🗺️ Pin on Map</button>
                        <button type="button" onClick={() => fetchCurrentLocation(setDeliveryAddress, setLocating, setDeliveryCoords, setDeliveryPostcode)} disabled={locating} style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', outline: 'none', padding: 0 }}>
                          {locating ? '⏳ Detecting...' : '📍 Auto-fill'}
                        </button>
                      </div>
                    </div>
                    <textarea 
                      value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); setDeliveryCoords(null); }} required placeholder="House, Road, Apartment, Area, City..." 
                      className="checkout-input-field"
                      style={{ height: '72px', resize: 'none', borderColor: (highlightDelivery && !deliveryAddress) ? '#EF4444' : 'var(--border-color)', boxShadow: (highlightDelivery && !deliveryAddress) ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>House / Flat / Road No.</label>
                      <input 
                        type="text" value={deliveryHouseNumber} onChange={e => setDeliveryHouseNumber(e.target.value)} placeholder="E.g. House 12, Road 4" required
                        className="checkout-input-field"
                        style={{ borderColor: (highlightDelivery && !deliveryHouseNumber) ? '#EF4444' : 'var(--border-color)', boxShadow: (highlightDelivery && !deliveryHouseNumber) ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none' }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Postal Code</label>
                      <input 
                        type="text" value={deliveryPostcode} onChange={e => setDeliveryPostcode(e.target.value)} placeholder="Auto-filled or enter" 
                        className="checkout-input-field"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>{/* END LEFT COLUMN */}

          {/* ===== RIGHT COLUMN (Sticky Order Summary) ===== */}
          <div style={{ position: 'sticky', top: '180px', alignSelf: 'flex-start', maxWidth: '100%' }}>
            <div className="glassmorphic-summary-card">
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ticket style={{ width: '1.1rem', height: '1.1rem', color: 'var(--primary)' }} />
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>
                  Order Summary
                </h3>
              </div>

              {/* PROMO CODE */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Promo Code</label>
                <div className="promo-widget-container">
                  <input 
                    type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter code" 
                    className="promo-widget-input"
                  />
                  <button onClick={handleApplyPromo} className="promo-widget-btn">Apply</button>
                </div>
                {promoMessage.text && (
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: promoMessage.type === 'success' ? '#10B981' : '#EF4444', marginTop: '0.4rem', margin: 0, paddingLeft: '0.5rem' }}>
                    {promoMessage.text}
                  </p>
                )}
              </div>

              {/* COST BREAKDOWN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal ({activeItems.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>৳{subtotal.toLocaleString()}</span>
                </div>
                {packagingCost > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Packaging ({currentPackaging?.label} ×{packagingUnits})</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>৳{packagingCost.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Delivery{currentDelivery ? ` (${currentDelivery.label})` : ''}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>৳{deliveryFee.toLocaleString()}</span>
                </div>
                {appliedPromo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>Discount ({appliedPromo.code})</span>
                    <span style={{ fontWeight: 700, color: '#10B981' }}>−৳{discountAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* GRAND TOTAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.05rem' }}>Grand Total</span>
                <span style={{ color: '#E8540A', fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.45rem' }}>৳{total.toLocaleString()}</span>
              </div>

              {/* CONFIRM BUTTON */}
              <button 
                onClick={handleConfirmOrder} 
                disabled={activeItems.length === 0}
                className="pulsing-confirm-btn"
              >
                <span>Confirm Order</span>
                <ArrowRight style={{ width: '1.1rem', height: '1.1rem' }} />
              </button>

              {/* TRUST STRIP */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ShieldCheck style={{ width: '0.85rem', height: '0.85rem', color: '#10B981' }} /> Secure
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <PhoneCall style={{ width: '0.85rem', height: '0.85rem', color: 'var(--primary)' }} /> Owner Call
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check style={{ width: '0.85rem', height: '0.85rem', color: '#10B981' }} /> Verified
                </span>
              </div>
            </div>
          </div>{/* END RIGHT COLUMN */}

        </div>{/* END 2-COLUMN LAYOUT */}
      </div>
      
      {/* MAP PIN MODAL */}
      {showMapModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-modal">
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', width: '90%', maxWidth: '600px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }} className="animate-fadeIn">
            <div style={{ background: '#121212', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📍 Pin Your Location
              </h3>
              <button onClick={() => setShowMapModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '1.1rem', padding: 0 }}>✕</button>
            </div>
            <div style={{ padding: '0', position: 'relative' }}>
              <div id="leaflet-map-container" style={{ width: '100%', height: '380px' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', fontSize: '2rem' }}>📍</div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ margin: '0 0 1.25rem 0' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>Drag the map to position the pin at your exact location. The address coordinates will automatically update.</p>
                <p style={{ fontSize: '0.75rem', color: '#E8540A', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  📌 Pinned details will be saved for delivery dispatch.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setShowMapModal(false)} className="checkout-input-field" style={{ width: 'auto', background: 'transparent', fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleConfirmMapPin} className="promo-widget-btn" style={{ fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem' }}>Confirm Location</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ADDRESS MODAL */}
      {showEditAddressModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-modal">
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', width: '95%', maxWidth: '500px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }} className="animate-fadeIn">
            <div style={{ background: '#121212', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ✏️ Edit Saved Address
              </h3>
              <button onClick={() => setShowEditAddressModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '1.1rem', padding: 0 }}>✕</button>
            </div>
            
            <form onSubmit={handleSaveEditedAddress} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Address Label</label>
                <input 
                  type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} required placeholder="E.g. Home, Office, Vacation" 
                  className="checkout-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Recipient Name</label>
                  <input 
                    type="text" value={editRecipientName} onChange={e => setEditRecipientName(e.target.value)} required placeholder="Recipient name" 
                    className="checkout-input-field"
                  />
                </div>
                <div>
                  <label style={labelStyle}>BD Phone Number</label>
                  <input 
                    type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} required placeholder="Phone number" 
                    className="checkout-input-field"
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Full Shipping Address</label>
                  <button type="button" onClick={() => fetchCurrentLocation(setEditAddressText, setEditLocating, setEditCoords, setEditPostcode)} disabled={editLocating} style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', outline: 'none', padding: 0 }}>
                    {editLocating ? '⏳ Detecting...' : '📍 Auto-fill'}
                  </button>
                </div>
                <textarea 
                  value={editAddressText} onChange={e => { setEditAddressText(e.target.value); setEditCoords(null); }} required placeholder="House, Road, Area, City..." 
                  className="checkout-input-field"
                  style={{ height: '72px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>House / Flat / Road No.</label>
                  <input 
                    type="text" value={editHouseNumber} onChange={e => setEditHouseNumber(e.target.value)} placeholder="E.g. House 12, Road 4" 
                    className="checkout-input-field"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Postal Code</label>
                  <input 
                    type="text" value={editPostcode} onChange={e => setEditPostcode(e.target.value)} placeholder="Postal code" 
                    className="checkout-input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditAddressModal(false)} className="checkout-input-field" style={{ width: 'auto', background: 'transparent', fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="promo-widget-btn" style={{ fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem' }}>Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
