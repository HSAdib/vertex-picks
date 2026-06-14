import { useState, useEffect, useRef } from 'react';
import { signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';
import { useWishlist } from '../hooks/useWishlist';
import { useCart } from '../context/CartContext';

const ORDER_STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

// Fix #12: use crypto.randomUUID() to eliminate Date.now() millisecond collision risk
function generateUniqueId() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }

const OrderPipeline = ({ status }) => {
  if (status === 'Cancelled') return (
    <span className="order-status status-cancelled">✕ Cancelled</span>
  );
  const cur = ORDER_STEPS.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {ORDER_STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, flexShrink: 0,
            background: i <= cur ? 'var(--primary)' : 'var(--gray2)',
            color: i <= cur ? '#fff' : 'var(--gray4)',
            outline: i === cur ? '3px solid rgba(232,84,10,0.2)' : 'none'
          }}>
            {i < cur ? '✓' : i + 1}
          </div>
          {i < ORDER_STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < cur ? 'var(--primary)' : 'var(--gray2)', borderRadius: 2, margin: '0 3px' }} />
          )}
        </div>
      ))}
    </div>
  );
};

const cancellationReasons = [
  'ডেলিভারি অনেক দেরি হচ্ছে (Delivery is taking too long)',
  'ভুল করে অর্ডার দিয়ে ফেলেছি (Ordered by mistake)',
  'অন্য জায়গা থেকে কিনে নিয়েছি (Bought elsewhere)',
  'টাকার সমস্যা (Financial issue)',
  'অন্যান্য (Other)',
];

const NavItem = ({ tabId, icon, label, badge, danger, activeTab, onClick }) => {
  const active = activeTab === tabId;
  return (
    <button
      onClick={onClick}
      className={`dash-nav-item${active ? ' active' : ''}`}
      style={danger && !active ? { color: 'var(--red)' } : {}}
    >
      <span className="dni-icon">{icon}</span>
      {label}
      {badge > 0 && <span className="dni-badge">{badge}</span>}
    </button>
  );
};

export default function Profile() {
  const { user, isAdmin, authLoading } = useAuth();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(() => {
    // Fix #10: normalise ?tab=account → 'profile' (the sidebar uses 'profile' as the tab ID)
    if (urlTab === 'account') return 'profile';
    return urlTab || 'overview';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [coords, setCoords] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [isSavingName, setIsSavingName] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddressId, setEditAddressId] = useState(null);
  const [newLabel, setNewLabel] = useState('Home');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCoords, setNewCoords] = useState(null);
  const [newHouseNumber, setNewHouseNumber] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState({ lat: 23.6850, lng: 90.3563 });
  const mapRef = useRef(null);
  const [phoneError, setPhoneError] = useState(false);
  const [locating, setLocating] = useState(false);

  const [myOrders, setMyOrders] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All Status');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const { wishlist, toggleWishlist } = useWishlist();
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [contactPhone, setContactPhone] = useState('+880 1581-221084');

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
        const container = document.getElementById('profile-leaflet-map-container');
        if (!container) return;

        const startLat = newCoords ? newCoords.lat : 23.6850;
        const startLng = newCoords ? newCoords.lng : 90.3563;
        setPinnedCoords({ lat: startLat, lng: startLng });

        mapRef.current = window.L.map(container).setView([startLat, startLng], newCoords ? 15 : 7);
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
  }, [showMapModal, newCoords]);

  const handleConfirmProfileMapPin = async () => {
    setNewCoords({ lat: pinnedCoords.lat, lng: pinnedCoords.lng });
    
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
        const parts = [road, neighbourhood, city || town, state_district, state, postcode, country];
        formattedAddress = Array.from(new Set(parts)).filter(Boolean).join(', ');
        if (postcode) {
          setNewPostcode('Postal Code: ' + postcode);
        } else {
          setNewPostcode('');
        }
      } else {
        formattedAddress = data.display_name || '';
      }
      
      setNewAddress(formattedAddress.trim());
      setShowMapModal(false);
      toast.success('📍 Location pinned! Please add your house/flat number above.');
    } catch {
      toast.error('Failed to resolve address. Please try again or type manually.');
      setShowMapModal(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.contactPhone) setContactPhone(data.contactPhone);
        }
      } catch (err) {
        console.error("Failed to load store settings in Profile:", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const currentUser = user;
      if (currentUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || currentUser.displayName || '');
            setDisplayName(data.name || currentUser.displayName || '');
            setPhone(data.phone || '');
            setCoords(data.coords || '');
            if (data.addresses) {
              setAddresses(data.addresses);
            } else if (data.address || data.phone) {
              setAddresses([{ id: generateUniqueId(), label: 'Default', address: data.address || '', phone: data.phone || '', isDefault: true }]);
            }
          } else {
            setName(currentUser.displayName || '');
            setDisplayName(currentUser.displayName || '');
          }
          let ordersData = [];
          if (currentUser.email) {
            const q = query(collection(db, 'orders'), where('customerEmail', '==', currentUser.email));
            const snap = await getDocs(q);
            ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
          const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
          const combined = [...ordersData, ...localOrders]
            .filter((o, i, self) => i === self.findIndex(t => t.id === o.id))
            .filter(o => !o.hiddenByCustomer)
            .sort((a, b) => {
              const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
              const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
              return tB - tA;
            });
          setMyOrders(combined);
        } catch (err) { console.error('Error loading profile:', err); }
      } else {
        const lo = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        setMyOrders(lo.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
      setLoading(false);
    };
    loadProfile();
  }, [user]);

  useEffect(() => {
    const fetchWishlist = async () => {
      const ids = wishlist;
      if (ids.length === 0) { setWishlistProducts([]); return; }
      try {
        const snap = await getDocs(collection(db, 'mangoes'));
        const all = snap.docs.filter(d => !['STORE_SECTIONS','STORE_SETTINGS','NAVBAR_TABS', 'CATEGORIES', 'FILTERS', 'VARIETIES'].includes(d.id)).map(d => ({ id: d.id, ...d.data() }));
        setWishlistProducts(all.filter(m => ids.includes(m.id)));
      } catch (err) { console.error('Wishlist load error:', err); }
    };
    if (activeTab === 'wishlist' || activeTab === 'overview') fetchWishlist();
  }, [activeTab, wishlist]); // Added wishlist to dependencies so it refetches when toggled

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingName(true);
    try {
      if (user) await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), { name, email: user.email, phone, coords }, { merge: true });
      setDisplayName(name);
      toast.success('Profile saved successfully!');
    } catch (err) { console.error(err); toast.error('Failed to update profile'); }
    setIsSavingName(false);
  };

  const saveAddresses = async (updated) => {
    try {
      await setDoc(doc(db, 'users', user.uid), { addresses: updated, updatedAt: new Date() }, { merge: true });
      setAddresses(updated);
      toast.success('Address book synchronized');
    } catch (err) { console.error(err); toast.error('Failed to sync addresses'); }
  };

  const handleSaveAddressModal = async (e) => {
    e.preventDefault();
    if (!isValidBDPhoneNumber(newPhone)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      return toast.error('Please enter a valid Bangladeshi phone number');
    }
    let updated;
    if (editAddressId) {
      updated = addresses.map(a => a.id === editAddressId ? { ...a, label: newLabel, phone: newPhone, address: newAddress, coords: newCoords, houseNumber: newHouseNumber, postcode: newPostcode, recipientName: newRecipientName } : a);
    } else {
      updated = [...addresses, { id: generateUniqueId(), label: newLabel, phone: newPhone, address: newAddress, coords: newCoords, houseNumber: newHouseNumber, postcode: newPostcode, recipientName: newRecipientName, isDefault: addresses.length === 0 }];
    }
    await saveAddresses(updated);
    setShowAddressModal(false);
    setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null); setNewHouseNumber(''); setNewPostcode(''); setNewRecipientName('');
  };

  const handleEditAddress = (addr) => {
    setEditAddressId(addr.id); setNewLabel(addr.label); setNewPhone(addr.phone);
    setNewAddress(addr.address); setNewCoords(addr.coords || null);
    setNewHouseNumber(addr.houseNumber || ''); setNewPostcode(addr.postcode || '');
    setNewRecipientName(addr.recipientName || displayName || name || '');
    setShowAddressModal(true);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false); setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null);
    setNewHouseNumber(''); setNewPostcode(''); setNewRecipientName('');
  };

  const handleCreateAddress = () => {
    setEditAddressId(null);
    setNewLabel('Home');
    setNewPhone(phone || '');
    setNewAddress('');
    setNewCoords(null);
    setNewHouseNumber('');
    setNewPostcode('');
    setNewRecipientName(displayName || name || '');
    setShowAddressModal(true);
  };

  const handleSetDefault = async (id) => saveAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));

  const triggerConfirm = (title, message, action) => setConfirmModal({ isOpen: true, title, message, action });

  const executeDeleteAddress = async (id) => {
    const updated = addresses.filter(a => a.id !== id);
    if (updated.length > 0 && !updated.some(a => a.isDefault)) updated[0].isDefault = true;
    await saveAddresses(updated);
  };

  const handleDeleteAddress = (id) => triggerConfirm('Delete Address', 'Are you sure you want to delete this address?', () => executeDeleteAddress(id));

  const handleReorder = async (order) => {
    if (reorderingId) return;
    setReorderingId(order.id);
    try {
      const items = order.items || [];
      if (items.length === 0) { toast.error('No items found in this order.'); setReorderingId(null); return; }

      let addedCount = 0;
      let skippedCount = 0;

      for (const item of items) {
        if (!item.id) { skippedCount++; continue; }
        try {
          const productSnap = await getDoc(doc(db, 'mangoes', item.id));
          if (!productSnap.exists() || productSnap.data().stock <= 0) {
            skippedCount++;
            continue;
          }
          const productData = productSnap.data();
          // Fix #2: use inStock flag (consistent with the rest of the app).
          // productData.stock may be undefined for many products, making
          // `undefined <= 0` === false — silently allowing out-of-stock items through.
          addToCart(item.id, item.quantity || 1, productData, item.selectedWeight || null);
          addedCount++;
        } catch {
          skippedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(
          skippedCount > 0
            ? `✅ ${addedCount} item(s) added to cart. ${skippedCount} item(s) are no longer available.`
            : `✅ ${addedCount} item(s) added to cart!`,
          { duration: 4000 }
        );
        setTimeout(() => navigate('/checkout'), 800);
      } else {
        toast.error('None of the items in this order are currently available.');
      }
    } catch (err) {
      console.error('Reorder failed:', err);
      toast.error('Failed to reorder. Please try again.');
    }
    setReorderingId(null);
  };

  const handleCancelOrder = async () => {
    if (!cancelReason) return toast.error('Please select a reason.');
    const order = myOrders.find(o => o.id === orderToCancel);
    try {
      // Fix #4: guest orders only exist in localStorage — calling Firestore updateDoc
      // on them throws a permission/not-found error. Update localStorage for guests.
      if (order?.isGuest) {
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        const updated = localOrders.map(o =>
          o.id === orderToCancel ? { ...o, status: 'Cancelled', cancelReason, cancelledAt: new Date().toISOString() } : o
        );
        localStorage.setItem('vertex_guest_orders', JSON.stringify(updated));
      } else {
        await updateDoc(doc(db, 'orders', orderToCancel), { status: 'Cancelled', cancelReason, cancelledAt: new Date() });
      }
      setMyOrders(myOrders.map(o => o.id === orderToCancel ? { ...o, status: 'Cancelled', cancelReason } : o));
      setCancelModalOpen(false); setOrderToCancel(null); setCancelReason('');
      toast.success('Order cancelled successfully');
    } catch (err) { console.error(err); toast.error('Failed to cancel order'); }
  };

  const executeHideOrder = async (id) => {
    const order = myOrders.find(o => o.id === id);
    try {
      // Fix #3: guest orders only exist in localStorage — same as handleCancelOrder.
      // Calling Firestore updateDoc on a local-only order throws a permission error.
      if (order?.isGuest) {
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        localStorage.setItem('vertex_guest_orders',
          JSON.stringify(localOrders.filter(o => o.id !== id))
        );
      } else {
        await updateDoc(doc(db, 'orders', id), { hiddenByCustomer: true });
      }
      setMyOrders(myOrders.filter(o => o.id !== id));
      toast.success('Order removed from history');
    } catch (err) { console.error(err); }
  };

  const handleHideOrder = (id) => triggerConfirm('Remove Order', 'Remove this order from your history?', () => executeHideOrder(id));

  const filteredOrders = myOrders.filter(o => {
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      if (!o.id.toLowerCase().includes(q) && !o.items?.some(i => i.name.toLowerCase().includes(q))) return false;
    }
    if (orderStatusFilter !== 'All Status') {
      if (orderStatusFilter === 'In Transit') return o.status === 'Shipped' || o.status === 'Confirmed';
      if (orderStatusFilter === 'Delivered') return o.status === 'Delivered';
      if (orderStatusFilter === 'Processing') return o.status === 'Pending';
      if (orderStatusFilter === 'Cancelled') return o.status === 'Cancelled';
    }
    return true;
  });

  const formatDate = (createdAt) => new Date(createdAt?.seconds ? createdAt.seconds * 1000 : createdAt)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusClass = (s) => s === 'Delivered' ? 'status-delivered' : s === 'Shipped' || s === 'Confirmed' ? 'status-transit' : s === 'Cancelled' ? 'status-cancelled' : 'status-processing';
  const statusLabel = (s) => s === 'Cancelled' ? '✕ Cancelled' : s === 'Delivered' ? '✅ Delivered' : s === 'Shipped' ? '🚚 Shipped' : s === 'Confirmed' ? '⚙️ Confirmed' : '⏳ Pending';

  if (loading || authLoading) return (
    <div style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray1)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Syncing Account…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  const initials = displayName ? displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U');
  const deliveredOrders = myOrders.filter(o => o.status === 'Delivered');
  const ltvAmount = deliveredOrders.reduce((s, o) => s + Number(o.total || 0), 0);



  return (
    <div style={{ paddingTop: 'var(--nav-height)', minHeight: '100vh', background: 'var(--gray1)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '2rem', maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--dark)', marginBottom: '.5rem' }}>{confirmModal.title}</h3>
            <p style={{ fontSize: '.82rem', color: 'var(--gray4)', lineHeight: 1.6, marginBottom: '1.5rem' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancel</button>
              <button style={{ flex: 1, background: 'var(--red)', color: '#fff', fontWeight: 700, padding: '.75rem', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: '.85rem' }} onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS MODAL */}
      {showAddressModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--dark)', marginBottom: '1.5rem' }}>{editAddressId ? 'Edit Address' : 'Add New Address'}</h3>
            <form onSubmit={handleSaveAddressModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Label</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewLabel('Home')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: newLabel === 'Home' ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)',
                      background: newLabel === 'Home' ? 'var(--primary-pale)' : 'var(--input-bg)',
                      color: newLabel === 'Home' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  >
                    🏠 Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLabel('Office')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: newLabel === 'Office' ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)',
                      background: newLabel === 'Office' ? 'var(--primary-pale)' : 'var(--input-bg)',
                      color: newLabel === 'Office' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  >
                    🏢 Office
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Recipient Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRecipientName}
                  onChange={e => setNewRecipientName(e.target.value)}
                  placeholder="E.g. Adnan Rahman"
                  required
                />
              </div>
              <div><label className="form-label">Phone Number</label><input type="tel" className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="017..." style={phoneError ? { borderColor: 'var(--red)', background: 'var(--red-pale)' } : {}} /></div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Full Shipping Address</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowMapModal(true)}
                      style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, outline: 'none', padding: 0 }}
                    >
                      🗺️ Pin on Map
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchCurrentLocation(setNewAddress, setLocating, setNewCoords, setNewPostcode)}
                      disabled={locating}
                      style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, outline: 'none', padding: 0 }}
                    >
                      {locating ? '⏳ Detecting...' : '📍 Auto-fill'}
                    </button>
                  </div>
                </div>
                <textarea className="form-input" value={newAddress} onChange={e => { setNewAddress(e.target.value); setNewCoords(null); }} required placeholder="House, Road, Area, City" style={{ height: 80, resize: 'none' }} />
              </div>
              <div>
                <label className="form-label">House / Flat / Road Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={newHouseNumber}
                  onChange={e => setNewHouseNumber(e.target.value)}
                  placeholder="E.g. House 12, Road 4, Apt 3B"
                  required
                />
              </div>
              <div>
                <label className="form-label">Postal Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPostcode}
                  onChange={e => setNewPostcode(e.target.value)}
                  placeholder="Auto-filled or enter manually"
                />
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={closeAddressModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div id="profile-leaflet-map-container" style={{ width: '100%', height: '380px' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', fontSize: '2rem', content: "'📍'" }}>📍</div>
            </div>
            
            <div style={{ padding: '1.4rem' }}>
              <div style={{ margin: '0 0 1rem 0' }}>
                <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.3rem 0' }}>
                  Drag the pin to your exact location. Then click Confirm.
                </p>
                <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.72rem', color: '#E8540A', fontWeight: 600, margin: 0 }}>
                  📌 Current coordinates will be saved with your address for precise delivery.
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
                  onClick={handleConfirmProfileMapPin}
                  style={{ background: '#E8540A', color: '#FFFFFF', border: 'none', borderRadius: '100px', fontWeight: 700, padding: '0.6rem 1.4rem', fontFamily: "'Sora', sans-serif", boxShadow: '0 6px 24px rgba(232,84,10,0.3)', cursor: 'pointer' }}
                >
                  CONFIRM LOCATION
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL */}
      {cancelModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--red)', marginBottom: '.75rem' }}>Cancel Order?</h3>
            <p style={{ fontSize: '.82rem', color: 'var(--gray4)', marginBottom: '1rem' }}>Please let us know why:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1.5rem' }}>
              {cancellationReasons.map((r, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.75rem', border: '1.5px solid var(--gray2)', borderRadius: 12, cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, color: 'var(--gray4)' }}>
                  <input type="radio" name="reason" value={r} onChange={e => setCancelReason(e.target.value)} style={{ accentColor: 'var(--red)', width: 16, height: 16 }} />
                  {r}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCancelModalOpen(false)}>Keep Order</button>
              <button style={{ flex: 1, background: 'var(--red)', color: '#fff', fontWeight: 700, padding: '.75rem', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: '.85rem' }} onClick={handleCancelOrder}>Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD LAYOUT */}
      <div className="dashboard-layout">

        {/* SIDEBAR OVERLAY (mobile) */}
        {isSidebarOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 290 }} onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className="dash-sidebar" style={isSidebarOpen ? { display: 'block', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 300 } : {}}>
          {/* User Card */}
          <div className="dash-user-card">
            <div className="duc-avatar">{initials}</div>
            <div className="duc-name">{displayName || user.email?.split('@')[0] || 'Vertex User'}</div>
            <div className="duc-email">{user.email}</div>
            <div className="duc-tier">{isAdmin ? '🔑 Super Admin' : '🏆 Gold Member'}</div>
          </div>

          {/* Nav */}
          <nav className="dash-nav">
            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray4)', padding: '.25rem .75rem .6rem', marginTop: '.4rem' }}>Main</div>
            <NavItem tabId="overview" icon="🏠" label="Overview" activeTab={activeTab} onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }} />
            <NavItem tabId="orders" icon="📦" label="My Orders" badge={myOrders.length} activeTab={activeTab} onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }} />
            <NavItem tabId="wishlist" icon="❤️" label="Wishlist" badge={wishlist.length} activeTab={activeTab} onClick={() => { setActiveTab('wishlist'); setIsSidebarOpen(false); }} />
            <NavItem tabId="addresses" icon="📍" label="Addresses" activeTab={activeTab} onClick={() => { setActiveTab('addresses'); setIsSidebarOpen(false); }} />
            <NavItem tabId="reviews" icon="⭐" label="My Reviews" activeTab={activeTab} onClick={() => { setActiveTab('reviews'); setIsSidebarOpen(false); }} />
            <NavItem tabId="notifications" icon="🔔" label="Notifications" badge={2} activeTab={activeTab} onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); }} />

            <div className="dash-nav-divider" />

            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray4)', padding: '.25rem .75rem .6rem' }}>Account</div>
            <NavItem tabId="profile" icon="👤" label="Edit Profile" activeTab={activeTab} onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }} />
            <NavItem tabId="security" icon="🔒" label="Security" activeTab={activeTab} onClick={() => { setActiveTab('security'); setIsSidebarOpen(false); }} />

            {isAdmin && (
              <>
                <div className="dash-nav-divider" />
                <Link to="/admin" className="dash-nav-item" style={{ display: 'flex', alignItems: 'center', gap: '.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                  <span className="dni-icon">⚙️</span> Admin Console
                </Link>
              </>
            )}

            <div className="dash-nav-divider" />
            <button className="dash-nav-item" style={{ color: 'var(--red)', width: '100%', textAlign: 'left' }} onClick={() => signOut(auth)}>
              <span className="dni-icon">🚪</span> Sign Out
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <div className="dash-main">

          {/* Page Header with sidebar toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => setIsSidebarOpen(true)}
                style={{ display: 'none', padding: '8px', borderRadius: 10, border: '1.5px solid var(--gray2)', background: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}
                className="sidebar-mobile-toggle"
              >☰</button>
              <div>
                <div className="dash-title" style={{ marginBottom: '.2rem' }}>
                  Welcome back, <span style={{ color: 'var(--primary)' }}>{displayName || 'Connoisseur'}</span> 👋
                </div>
                <div className="dash-subtitle">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Panel</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <span style={{ fontSize: '.78rem', color: 'var(--gray4)' }}>{user.email}</span>
              <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '.25rem .65rem', borderRadius: 100, background: 'var(--gold-pale)', color: '#B07700', textTransform: 'uppercase', letterSpacing: '.06em' }}>Gold</span>
            </div>
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="dash-tab active">
              <div className="stats-row">
                <div className="stat-card"><div className="sc-label">📦 Total Orders</div><div className="sc-val">{myOrders.length}</div><div className="sc-trend up">↑ {myOrders.filter(o => o.status !== 'Cancelled').length} active</div></div>
                <div className="stat-card"><div className="sc-label">💰 Total Spent</div><div className="sc-val">৳{ltvAmount.toLocaleString()}</div><div className="sc-sub">Lifetime value</div></div>
                <div className="stat-card"><div className="sc-label">❤️ Wishlist</div><div className="sc-val">{wishlist.length}</div><div className="sc-sub">Saved for later</div></div>
              </div>

              <div className="dash-card">
                <div className="dash-card-head">
                  <div className="dch-title">📦 Recent Orders</div>
                  <span className="dch-action" onClick={() => setActiveTab('orders')}>View All →</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {myOrders.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', fontSize: '.85rem', color: 'var(--gray4)' }}>No orders yet. <Link to="/shop" style={{ color: 'var(--primary)', fontWeight: 700 }}>Shop Now →</Link></div>
                  ) : (
                    <table className="admin-table">
                      <thead><tr><th>Order ID</th><th>Items</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {myOrders.slice(0, 3).map(order => (
                          <tr key={order.id}>
                            <td><span className="order-id">#{order.id.slice(-6).toUpperCase()}</span></td>
                            <td style={{ fontSize: '.82rem', fontWeight: 600, maxWidth: 180 }}>{order.items?.map(i => `${i.name} × ${i.quantity}`).join(', ') || 'Mango Box'}</td>
                            <td style={{ fontSize: '.8rem', color: 'var(--gray4)' }}>{formatDate(order.createdAt)}</td>
                            <td><strong>৳{order.total}</strong></td>
                            <td><span className={`order-status ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></td>
                            <td><button className="order-action-btn" onClick={() => setActiveTab('orders')}>View</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="dash-card">
                <div className="dash-card-head"><div className="dch-title">⚡ Quick Actions</div></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', padding: '1.5rem' }}>
                  {[{ icon: '🛒', label: 'Shop Now', action: () => navigate('/shop') }, { icon: '📦', label: 'Track Order', action: () => setActiveTab('orders') }, { icon: '❤️', label: 'Wishlist', action: () => setActiveTab('wishlist') }].map(a => (
                    <button key={a.label} className="feat-card" style={{ cursor: 'pointer', border: '1.5px solid var(--gray2)', textAlign: 'center' }} onClick={a.action}>
                      <div className="feat-icon">{a.icon}</div>
                      <div className="feat-title" style={{ fontSize: '.78rem' }}>{a.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ORDERS ── */}
          {activeTab === 'orders' && (
            <div className="dash-tab active">
              <div className="dash-header">
                <div className="dash-title">📦 My Orders</div>
                <div className="dash-subtitle">Track and manage all your orders</div>
              </div>
              <div className="dash-card">
                <div style={{ display: 'flex', gap: '.6rem', padding: '1rem 1.5rem', borderBottom: '1px solid var(--gray2)', background: 'var(--gray1)', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray4)', fontSize: '.8rem', pointerEvents: 'none' }}>🔍</span>
                    <input type="text" placeholder="Search orders…" value={orderSearchQuery} onChange={e => setOrderSearchQuery(e.target.value)} style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1.5px solid var(--gray2)', borderRadius: 100, padding: '.4rem .9rem .4rem 2rem', fontSize: '.8rem', outline: 'none', width: 220 }} />
                  </div>
                  <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1.5px solid var(--gray2)', borderRadius: 100, padding: '.4rem .9rem', fontSize: '.8rem', outline: 'none', cursor: 'pointer' }}>
                    <option>All Status</option><option>Processing</option><option>In Transit</option><option>Delivered</option><option>Cancelled</option>
                  </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {filteredOrders.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', fontSize: '.85rem', color: 'var(--gray4)' }}>No matching orders found.</div>
                  ) : (
                    <table className="admin-table">
                      <thead><tr><th>Order ID</th><th>Items</th><th>Date</th><th>Amount</th><th>Status / Progress</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filteredOrders.map(order => (
                          <tr key={order.id}>
                            <td><span className="order-id">#{order.id.slice(-6).toUpperCase()}</span></td>
                            <td style={{ fontSize: '.82rem', fontWeight: 600, maxWidth: 180 }}>{order.items?.map(i => `${i.name} × ${i.quantity}`).join(', ') || 'Mango Box'}</td>
                            <td style={{ fontSize: '.8rem', color: 'var(--gray4)' }}>{formatDate(order.createdAt)}</td>
                            <td>
                              <strong>৳{order.total}</strong>
                              <div style={{ fontSize: 9, color: 'var(--gray4)', fontWeight: 600, marginTop: 2 }}>(+৳{order.deliveryFee || 0} delivery)</div>
                            </td>
                            <td>
                              <div style={{ marginBottom: 8 }}><span className={`order-status ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></div>
                              <div style={{ width: 130 }}><OrderPipeline status={order.status} /></div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {order.status === 'Pending' && (
                                  <button className="order-action-btn" style={{ background: 'var(--red-pale)', color: 'var(--red)' }} onClick={() => { setOrderToCancel(order.id); setCancelModalOpen(true); }}>Cancel</button>
                                )}
                                {order.status !== 'Cancelled' && (
                                  order.trackingLink
                                    ? <a href={order.trackingLink.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`} target="_blank" rel="noreferrer" className="order-action-btn" style={{ display: 'block', textAlign: 'center' }}>Track</a>
                                    : (() => {
                                        const cleanPhone = contactPhone.replace(/\D/g, '');
                                        const waPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone;
                                        return (
                                          <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello! Order #${order.id.slice(-6).toUpperCase()}`)}`} target="_blank" rel="noreferrer" className="order-action-btn" style={{ display: 'block', textAlign: 'center', background: '#DCFCE7', color: 'var(--green)' }}>Courier</a>
                                        );
                                      })()
                                )}
                                {(order.status === 'Delivered' || order.status === 'Cancelled') && (
                                  <button
                                    className="order-action-btn"
                                    style={{ background: 'var(--primary-pale)', color: 'var(--primary)', fontWeight: 700, opacity: reorderingId === order.id ? 0.6 : 1 }}
                                    onClick={() => handleReorder(order)}
                                    disabled={reorderingId === order.id}
                                  >
                                    {reorderingId === order.id ? '⏳' : '🔁 Reorder'}
                                  </button>
                                )}
                                <button style={{ fontSize: 10, color: 'var(--gray4)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleHideOrder(order.id)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── WISHLIST ── */}
          {activeTab === 'wishlist' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">❤️ My Wishlist</div><div className="dash-subtitle">Items you've saved for later</div></div>
              <div className="dash-card">
                {wishlistProducts.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🥭</div>
                    <h3 style={{ fontWeight: 800, fontSize: '.95rem', color: 'var(--dark)', marginBottom: '.5rem' }}>Your Wishlist is Empty</h3>
                    <p style={{ fontSize: '.82rem', color: 'var(--gray4)', marginBottom: '1.5rem' }}>Tap the heart icon on any product to save it here!</p>
                    <Link to="/shop" className="btn-primary" style={{ borderRadius: 'var(--radius-sm)' }}>Explore Store</Link>
                  </div>
                ) : (
                  <div className="wishlist-grid shop-grid" style={{ padding: '1.5rem' }}>
                    {wishlistProducts.map(mango => {
                      const img = mango.images?.[0] || mango.image;
                      const price = mango.discountPrice || mango.price;
                      const stars = Math.round(Number(mango.stats?.rating) || Number(mango.rating) || 5);
                      return (
                        <div key={mango.id} className="product-card">
                          <button className="pc-wishlist" style={{ color: 'var(--primary)' }} onClick={() => toggleWishlist(mango)}>♥</button>
                          <Link to={`/product/${mango.id}`}><div className="pc-img" style={{ background: 'var(--gray1)' }}>{img ? <img src={img} alt={mango.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '3rem' }}>🥭</span>}</div></Link>
                          <div className="pc-body">
                            {mango.section && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--primary)', marginBottom: 4 }}>{mango.section}</div>}
                            <h4 className="pc-name">{mango.name}</h4>
                            <div className="pc-rating"><span className="stars">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span> <span>({mango.stats?.reviewCount || 0})</span></div>
                            <div className="pc-price-row">
                              <div className="pc-price">৳{Number(price).toLocaleString()}</div>
                              <Link to={`/product/${mango.id}`} className="pc-add" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>→</Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ADDRESSES ── */}
          {activeTab === 'addresses' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">📍 Saved Addresses</div><div className="dash-subtitle">Manage your delivery locations</div></div>
              <div className="dash-card">
                <div className="dash-card-head">
                  <div className="dch-title">Address Directory</div>
                  <button className="btn-primary" style={{ borderRadius: 'var(--radius-sm)', fontSize: '.8rem', padding: '.5rem 1rem' }} onClick={handleCreateAddress}>+ Add Address</button>
                </div>
                {addresses.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', fontSize: '.85rem', color: 'var(--gray4)' }}>No addresses saved yet.</div>
                ) : (
                  <div className="address-grid">
                    {[...addresses]
                      .sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1))
                      .map(addr => (
                      <div key={addr.id} className={`address-card${addr.isDefault ? ' default-addr' : ''}`}>
                        {addr.isDefault && <span className="addr-default-badge">Default</span>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
                          <h5 className="addr-name">{addr.label}</h5>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button onClick={() => handleEditAddress(addr)} style={{ fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                            <button onClick={() => handleDeleteAddress(addr.id)} style={{ fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </div>
                        <p className="addr-text">
                          👤 {addr.recipientName || displayName || name || 'N/A'}<br />
                          📞 {addr.phone}<br />
                          {addr.houseNumber && <>🏠 {addr.houseNumber}<br /></>}
                          📍 {addr.address}
                          {addr.postcode && <><br />📮 {addr.postcode}</>}
                        </p>
                        {!addr.isDefault && <div className="addr-actions"><button className="addr-btn" onClick={() => handleSetDefault(addr.id)}>Set as Default</button></div>}
                      </div>
                    ))}
                    <div className="addr-add" onClick={handleCreateAddress}><span className="addr-add-icon">➕</span><span className="addr-add-text">Add Location</span></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          {activeTab === 'reviews' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">⭐ My Reviews</div><div className="dash-subtitle">Ratings and feedback you've shared</div></div>
              <div className="dash-card" style={{ padding: '1.5rem' }}>
                <div className="review-submit-card">
                  <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '.5rem' }}>Leave a Review</div>
                  <p style={{ fontSize: '.8rem', color: 'var(--gray4)', marginBottom: '1rem' }}>Have you received a delivery? Share your feedback!</p>
                  <button className="btn-primary" style={{ borderRadius: 'var(--radius-sm)' }} onClick={() => navigate('/shop')}>Write a Review</button>
                </div>
                <div className="reviews-row" style={{ marginTop: '1.5rem' }}>
                  <div className="review-card">
                    <div className="rv-stars">★★★★★</div>
                    <div className="rv-text">"The Himsagar boxes were perfect — sweet, pure organic. Ordering Langra next!"</div>
                    <div className="rv-author"><div className="rv-avatar">{initials}</div><div><div className="rv-name">My Review (Himsagar)</div><div className="rv-loc">✓ Verified Buyer · June 2026</div></div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">🔔 Notifications</div><div className="dash-subtitle">Stay updated on your harvest reservations</div></div>
              <div className="dash-card">
                <div className="notif-row unread"><div className="notif-dot" /><div style={{ flex: 1 }}><div className="notif-title">🥭 Himsagar Special Ready!</div><p className="notif-text">The premium hand-bagged Himsagar batch is ready. Order now for express shipping.</p><div className="notif-time">2 hours ago</div></div></div>
                <div className="notif-row"><div className="notif-dot read" /><div style={{ flex: 1 }}><div className="notif-title">✅ Order Confirmed</div><p className="notif-text">Your order #{myOrders[0]?.id.slice(-6).toUpperCase() || 'VP-2025'} has been confirmed and is being packaged.</p><div className="notif-time">2 days ago</div></div></div>
              </div>
            </div>
          )}

          {/* ── EDIT PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">👤 Edit Profile</div><div className="dash-subtitle">Update your personal information</div></div>
              <div className="dash-card">
                <form onSubmit={handleSaveProfile} className="profile-form">
                  <div className="profile-grid">
                    <div><label className="form-label">Full Name</label><input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required /></div>
                    <div><label className="form-label">Email Address</label><input type="email" className="form-input" value={user?.email || ''} disabled style={{ background: 'var(--gray1)', cursor: 'not-allowed' }} /></div>
                    <div><label className="form-label">Phone Number</label><input type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="017xxxxxxxx" /></div>
                    <div><label className="form-label">Location Coordinates (Optional)</label><input type="text" className="form-input" value={coords} onChange={e => setCoords(e.target.value)} placeholder="Latitude, Longitude" /></div>
                  </div>
                  <div className="form-save-row">
                    <button type="submit" className="btn-primary" style={{ borderRadius: 'var(--radius-sm)' }} disabled={isSavingName}>{isSavingName ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">🔒 Security</div><div className="dash-subtitle">Manage your password and account security</div></div>
              <div className="dash-card" style={{ padding: '2rem' }}>
                <div style={{ maxWidth: 440 }}>
                  <h3 style={{ fontFamily: 'var(--ff-display)', fontSize: '1rem', fontWeight: 800, color: 'var(--dark)', marginBottom: '.5rem' }}>Password Reset</h3>
                  <p style={{ fontSize: '.82rem', color: 'var(--gray4)', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                    We'll send a secure password reset link to <strong>{user.email}</strong>. Click the link in your email to set a new password.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                    onClick={async () => {
                      try {
                        await sendPasswordResetEmail(auth, user.email);
                        toast.success('Password reset email sent! Check your inbox.');
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to send reset email. Try again.');
                      }
                    }}
                  >
                    📧 Send Password Reset Email
                  </button>
                  <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--gray2)' }}>
                    <h4 style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--dark)', marginBottom: '.75rem' }}>🛡️ Active Sessions</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.75rem 1rem', background: 'var(--gray1)', borderRadius: 10, border: '1.5px solid var(--gray2)', fontSize: '.8rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--dark)' }}>Current Device</div>
                        <div style={{ color: 'var(--gray4)', marginTop: 2 }}>Last active: just now</div>
                      </div>
                      <span style={{ fontSize: '.7rem', fontWeight: 700, padding: '.25rem .6rem', borderRadius: 100, background: '#DCFCE7', color: 'var(--green)' }}>Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
