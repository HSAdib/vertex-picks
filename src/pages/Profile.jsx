import { useState, useEffect } from 'react';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';

const ORDER_STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

function generateUniqueId() { return Date.now().toString(); }

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

export default function Profile() {
  const { user, isAdmin, authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
  const [phoneError, setPhoneError] = useState(false);
  const [locating, setLocating] = useState(false);

  const [myOrders, setMyOrders] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All Status');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const [wishlist, setWishlist] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);

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
      const saved = localStorage.getItem('vertex_wishlist');
      const ids = saved ? JSON.parse(saved) : [];
      setWishlist(ids);
      if (ids.length === 0) { setWishlistProducts([]); return; }
      try {
        const snap = await getDocs(collection(db, 'mangoes'));
        const all = snap.docs.filter(d => !['STORE_SECTIONS','STORE_SETTINGS','NAVBAR_TABS'].includes(d.id)).map(d => ({ id: d.id, ...d.data() }));
        setWishlistProducts(all.filter(m => ids.includes(m.id)));
      } catch (err) { console.error('Wishlist load error:', err); }
    };
    if (activeTab === 'wishlist' || activeTab === 'overview') fetchWishlist();
  }, [activeTab]);

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
      updated = addresses.map(a => a.id === editAddressId ? { ...a, label: newLabel, phone: newPhone, address: newAddress, coords: newCoords } : a);
    } else {
      updated = [...addresses, { id: generateUniqueId(), label: newLabel, phone: newPhone, address: newAddress, coords: newCoords, isDefault: addresses.length === 0 }];
    }
    await saveAddresses(updated);
    setShowAddressModal(false);
    setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null);
  };

  const handleEditAddress = (addr) => {
    setEditAddressId(addr.id); setNewLabel(addr.label); setNewPhone(addr.phone);
    setNewAddress(addr.address); setNewCoords(addr.coords || null); setShowAddressModal(true);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false); setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null);
  };

  const handleSetDefault = async (id) => saveAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));

  const triggerConfirm = (title, message, action) => setConfirmModal({ isOpen: true, title, message, action });

  const executeDeleteAddress = async (id) => {
    const updated = addresses.filter(a => a.id !== id);
    if (updated.length > 0 && !updated.some(a => a.isDefault)) updated[0].isDefault = true;
    await saveAddresses(updated);
  };

  const handleDeleteAddress = (id) => triggerConfirm('Delete Address', 'Are you sure you want to delete this address?', () => executeDeleteAddress(id));

  const handleCancelOrder = async () => {
    if (!cancelReason) return toast.error('Please select a reason.');
    try {
      await updateDoc(doc(db, 'orders', orderToCancel), { status: 'Cancelled', cancelReason, cancelledAt: new Date() });
      setMyOrders(myOrders.map(o => o.id === orderToCancel ? { ...o, status: 'Cancelled', cancelReason } : o));
      setCancelModalOpen(false); setOrderToCancel(null); setCancelReason('');
      toast.success('Order cancelled successfully');
    } catch (err) { console.error(err); toast.error('Failed to cancel order'); }
  };

  const executeHideOrder = async (id) => {
    try {
      await updateDoc(doc(db, 'orders', id), { hiddenByCustomer: true });
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
  const loyaltyPoints = Math.floor(ltvAmount * 0.1);
  const loyaltyValue = (ltvAmount * 0.01).toFixed(2);

  const NavItem = ({ tabId, icon, label, badge, danger }) => {
    const active = activeTab === tabId;
    return (
      <button
        onClick={() => { setActiveTab(tabId); setIsSidebarOpen(false); }}
        className={`dash-nav-item${active ? ' active' : ''}`}
        style={danger && !active ? { color: 'var(--red)' } : {}}
      >
        <span className="dni-icon">{icon}</span>
        {label}
        {badge > 0 && <span className="dni-badge">{badge}</span>}
      </button>
    );
  };

  return (
    <div style={{ paddingTop: 'var(--nav-height)', minHeight: '100vh', background: 'var(--gray1)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
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
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--dark)', marginBottom: '1.5rem' }}>{editAddressId ? 'Edit Address' : 'Add New Address'}</h3>
            <form onSubmit={handleSaveAddressModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label className="form-label">Label (e.g. Home, Office)</label><input type="text" className="form-input" value={newLabel} onChange={e => setNewLabel(e.target.value)} required /></div>
              <div><label className="form-label">Phone Number</label><input type="tel" className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="017..." style={phoneError ? { borderColor: 'var(--red)', background: 'var(--red-pale)' } : {}} /></div>
              <div>
                <label className="form-label">Full Shipping Address</label>
                <div style={{ position: 'relative' }}>
                  <textarea className="form-input" value={newAddress} onChange={e => { setNewAddress(e.target.value); setNewCoords(null); }} required placeholder="House, Road, Area, City" style={{ height: 80, resize: 'none', paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => fetchCurrentLocation(setNewAddress, setLocating, setNewCoords)} disabled={locating} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'var(--primary)', color: '#fff', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{locating ? '⏳' : '📍'}</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={closeAddressModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL */}
      {cancelModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
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
            <NavItem tabId="overview" icon="🏠" label="Overview" />
            <NavItem tabId="orders" icon="📦" label="My Orders" badge={myOrders.length} />
            <NavItem tabId="wishlist" icon="❤️" label="Wishlist" badge={wishlist.length} />
            <NavItem tabId="wallet" icon="💰" label="Wallet & Points" />
            <NavItem tabId="addresses" icon="📍" label="Addresses" />
            <NavItem tabId="reviews" icon="⭐" label="My Reviews" />
            <NavItem tabId="notifications" icon="🔔" label="Notifications" badge={2} />

            <div className="dash-nav-divider" />

            <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray4)', padding: '.25rem .75rem .6rem' }}>Account</div>
            <NavItem tabId="profile" icon="👤" label="Edit Profile" />
            <NavItem tabId="security" icon="🔒" label="Security" />

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
                <div className="stat-card"><div className="sc-label">🌟 Points</div><div className="sc-val">{loyaltyPoints.toLocaleString()}</div><div className="sc-sub">≈ ৳{loyaltyValue} value</div></div>
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
                    <table className="orders-table">
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', padding: '1.5rem' }}>
                  {[{ icon: '🛒', label: 'Shop Now', action: () => navigate('/shop') }, { icon: '📦', label: 'Track Order', action: () => setActiveTab('orders') }, { icon: '❤️', label: 'Wishlist', action: () => setActiveTab('wishlist') }, { icon: '💰', label: 'My Points', action: () => setActiveTab('wallet') }].map(a => (
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
                    <input type="text" placeholder="Search orders…" value={orderSearchQuery} onChange={e => setOrderSearchQuery(e.target.value)} style={{ background: '#fff', border: '1.5px solid var(--gray2)', borderRadius: 100, padding: '.4rem .9rem .4rem 2rem', fontSize: '.8rem', outline: 'none', width: 220 }} />
                  </div>
                  <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} style={{ background: '#fff', border: '1.5px solid var(--gray2)', borderRadius: 100, padding: '.4rem .9rem', fontSize: '.8rem', outline: 'none', cursor: 'pointer' }}>
                    <option>All Status</option><option>Processing</option><option>In Transit</option><option>Delivered</option><option>Cancelled</option>
                  </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {filteredOrders.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', fontSize: '.85rem', color: 'var(--gray4)' }}>No matching orders found.</div>
                  ) : (
                    <table className="orders-table">
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
                                    : <a href={`https://wa.me/8801581221084?text=Hello!%20Order%20%23${order.id.slice(-6).toUpperCase()}`} target="_blank" rel="noreferrer" className="order-action-btn" style={{ display: 'block', textAlign: 'center', background: '#DCFCE7', color: 'var(--green)' }}>Courier</a>
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
                          <button className="pc-wishlist" style={{ color: 'var(--primary)' }} onClick={() => {
                            const updated = wishlist.filter(id => id !== mango.id);
                            setWishlist(updated); setWishlistProducts(wishlistProducts.filter(p => p.id !== mango.id));
                            localStorage.setItem('vertex_wishlist', JSON.stringify(updated));
                            toast.success(`Removed from Wishlist!`, { icon: '💔' });
                          }}>♥</button>
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

          {/* ── WALLET ── */}
          {activeTab === 'wallet' && (
            <div className="dash-tab active">
              <div className="dash-header"><div className="dash-title">💰 Wallet & Points</div><div className="dash-subtitle">Your earnings and transaction history</div></div>
              <div className="wallet-row">
                <div className="wallet-card wc-orange"><div className="wc-label">Mango Points</div><div className="wc-val">{loyaltyPoints.toLocaleString()} pts</div><div className="wc-sub">≈ ৳{loyaltyValue} redeemable value</div><div className="wc-bg-emoji">🌟</div></div>
                <div className="wallet-card"><div className="wc-label">Store Credit</div><div className="wc-val">৳0.00</div><div className="wc-sub">Available for instant checkout</div><div className="wc-bg-emoji">💵</div></div>
              </div>
              <div className="dash-card">
                <div className="dash-card-head"><div className="dch-title">🎁 Transaction Ledger</div></div>
                <div className="txn-row"><div className="txn-left"><div className="txn-icon earn">🎁</div><div><div className="txn-desc">Points Earned – LTV Reward</div><div className="txn-date">Today</div></div></div><span className="txn-amt earn">+{loyaltyPoints} pts</span></div>
                <div className="txn-row"><div className="txn-left"><div className="txn-icon earn">🌿</div><div><div className="txn-desc">Sign-up Bonus</div><div className="txn-date">Welcome</div></div></div><span className="txn-amt earn">+100 pts</span></div>
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
                  <button className="btn-primary" style={{ borderRadius: 'var(--radius-sm)', fontSize: '.8rem', padding: '.5rem 1rem' }} onClick={() => setShowAddressModal(true)}>+ Add Address</button>
                </div>
                {addresses.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', fontSize: '.85rem', color: 'var(--gray4)' }}>No addresses saved yet.</div>
                ) : (
                  <div className="address-grid">
                    {addresses.map(addr => (
                      <div key={addr.id} className={`address-card${addr.isDefault ? ' default-addr' : ''}`}>
                        {addr.isDefault && <span className="addr-default-badge">Default</span>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
                          <h5 className="addr-name">{addr.label}</h5>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button onClick={() => handleEditAddress(addr)} style={{ fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                            <button onClick={() => handleDeleteAddress(addr.id)} style={{ fontSize: '.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </div>
                        <p className="addr-text">📞 {addr.phone}<br />📍 {addr.address}</p>
                        {!addr.isDefault && <div className="addr-actions"><button className="addr-btn" onClick={() => handleSetDefault(addr.id)}>Set as Default</button></div>}
                      </div>
                    ))}
                    <div className="addr-add" onClick={() => setShowAddressModal(true)}><span className="addr-add-icon">➕</span><span className="addr-add-text">Add Location</span></div>
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
              <div className="dash-header"><div className="dash-title">🔒 Security</div><div className="dash-subtitle">Update your password and security settings</div></div>
              <div className="dash-card">
                <form className="profile-form" onSubmit={e => { e.preventDefault(); toast.success('Password updated successfully!'); }}>
                  <div className="profile-grid">
                    <div><label className="form-label">Current Password</label><input type="password" className="form-input" placeholder="••••••••" required /></div>
                    <div><label className="form-label">New Password</label><input type="password" className="form-input" placeholder="Min. 8 characters" required /></div>
                    <div className="profile-full"><label className="form-label">Confirm New Password</label><input type="password" className="form-input" placeholder="••••••••" style={{ maxWidth: 380 }} required /></div>
                  </div>
                  <div className="form-save-row">
                    <button type="submit" className="btn-primary" style={{ borderRadius: 'var(--radius-sm)' }}>Update Password</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
