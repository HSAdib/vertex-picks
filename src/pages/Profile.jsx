import { useState, useEffect } from 'react';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'; 
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { fetchCurrentLocation } from '../utils/geolocation';


// VISUAL ORDER PIPELINE COMPONENT
const ORDER_STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
const OrderPipeline = ({ status }) => {
  if (status === 'Cancelled') {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black">✕</span>
        <span className="text-red-600 font-black text-xs uppercase tracking-widest">Cancelled</span>
      </div>
    );
  }
  const currentIndex = ORDER_STEPS.indexOf(status);
  return (
    <div className="flex items-center w-full gap-1 my-4">
      {ORDER_STEPS.map((step, idx) => (
        <div key={step} className="flex items-center flex-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all duration-500 ${
            idx < currentIndex ? 'bg-orange-500 text-white' :
            idx === currentIndex ? 'bg-orange-500 text-white ring-4 ring-orange-200 animate-pulse' :
            'bg-gray-200 text-gray-400'
          }`}>
            {idx < currentIndex ? '✓' : idx + 1}
          </div>
          {idx < ORDER_STEPS.length - 1 && (
            <div className={`flex-1 h-1 mx-1 rounded transition-all duration-500 ${idx < currentIndex ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
          )}
        </div>
      ))}
    </div>
  );
};

export default function Profile() {
  const { user, isAdmin, authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Profile Data
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [isSavingName, setIsSavingName] = useState(false);

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddressId, setEditAddressId] = useState(null);
  const [newLabel, setNewLabel] = useState('Home');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCoords, setNewCoords] = useState(null);
  const [phoneError, setPhoneError] = useState(false);
  const [locating, setLocating] = useState(false);

  // --- ORDER HISTORY STATE ---
  const [myOrders, setMyOrders] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // --- CONFIRM MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const cancellationReasons = [
    "ডেলিভারি অনেক দেরি হচ্ছে (Delivery is taking too long)",
    "ভুল করে অর্ডার দিয়ে ফেলেছি (Ordered by mistake)",
    "অন্য জায়গা থেকে কিনে নিয়েছি (Bought elsewhere)",
    "টাকার সমস্যা (Financial issue)",
    "অন্যান্য (Other)"
  ];

  useEffect(() => {
    const loadProfile = async () => {
      const currentUser = user;
      if (currentUser) {
        try {
          // Fetch Profile
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || currentUser.displayName || '');
            setDisplayName(data.name || currentUser.displayName || '');
            if (data.addresses) {
              setAddresses(data.addresses);
            } else if (data.address || data.phone) {
              setAddresses([{ id: Date.now().toString(), label: 'Default', address: data.address || '', phone: data.phone || '', isDefault: true }]);
            }
          } else {
            setName(currentUser.displayName || '');
            setDisplayName(currentUser.displayName || '');
          }
          
          
          // Fetch User's Orders
          let ordersData = [];
          if (currentUser.email) {
            const q = query(collection(db, 'orders'), where("customerEmail", "==", currentUser.email));
            const orderSnap = await getDocs(q);
            ordersData = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          
          // Merge with guest orders
          const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
          
          const combinedOrders = [...ordersData, ...localOrders]
            .filter((o, index, self) => index === self.findIndex((t) => t.id === o.id)) // Deduplicate
            .filter(o => !o.hiddenByCustomer)
            .sort((a, b) => {
              const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
              const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
              return timeB - timeA;
            });
            
          setMyOrders(combinedOrders);
        } catch (error) {
          console.error("Error fetching profile data:", error);
        }
      } else {
        // If not logged in, just load guest orders
        const localOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');
        setMyOrders(localOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setIsSavingName(true);
    try {
      if (user) await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), { name, email: user.email }, { merge: true });
      setDisplayName(name);
      toast.success('Name updated successfully!');
    } catch (err) { console.error(err); }
    setIsSavingName(false);
  };

  const saveAddressesToDB = async (updatedAddresses) => {
    try {
      await setDoc(doc(db, 'users', user.uid), { addresses: updatedAddresses, updatedAt: new Date() }, { merge: true });
      setAddresses(updatedAddresses);
    } catch (err) { console.error("Error saving addresses", err); }
  };

  const handleSaveAddressModal = async (e) => {
    e.preventDefault();
    if (!isValidBDPhoneNumber(newPhone)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      return toast.error("Please enter a valid Bangladeshi phone number");
    }
    let updated;
    if (editAddressId) {
      updated = addresses.map(addr => addr.id === editAddressId ? {
        ...addr,
        label: newLabel,
        phone: newPhone,
        address: newAddress,
        coords: newCoords
      } : addr);
    } else {
      const newAddrObj = {
        id: Date.now().toString(),
        label: newLabel,
        phone: newPhone,
        address: newAddress,
        coords: newCoords,
        isDefault: addresses.length === 0
      };
      updated = [...addresses, newAddrObj];
    }
    await saveAddressesToDB(updated);
    setShowAddressModal(false);
    setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null);
  };

  const handleEditAddress = (addr) => {
    setEditAddressId(addr.id);
    setNewLabel(addr.label);
    setNewPhone(addr.phone);
    setNewAddress(addr.address);
    setNewCoords(addr.coords || null);
    setShowAddressModal(true);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false);
    setEditAddressId(null);
    setNewLabel('Home'); setNewPhone(''); setNewAddress(''); setNewCoords(null);
  };

  const handleSetDefault = async (id) => {
    const updated = addresses.map(addr => ({ ...addr, isDefault: addr.id === id }));
    await saveAddressesToDB(updated);
  };

  const triggerConfirm = (title, message, action) => {
    setConfirmModal({ isOpen: true, title, message, action });
  };

  const executeDeleteAddress = async (id) => {
    const updated = addresses.filter(addr => addr.id !== id);
    if (updated.length > 0 && !updated.some(a => a.isDefault)) {
      updated[0].isDefault = true;
    }
    await saveAddressesToDB(updated);
  };

  const handleDeleteAddress = (id) => {
    triggerConfirm("Delete Address", "Are you sure you want to delete this address? This action cannot be undone.", () => executeDeleteAddress(id));
  };

  const handleCancelOrder = async () => {
    if(!cancelReason) return toast.error("Please select a reason.");
    try {
      await updateDoc(doc(db, 'orders', orderToCancel), {
        status: 'Cancelled',
        cancelReason: cancelReason,
        cancelledAt: new Date()
      });
      // Update local state
      setMyOrders(myOrders.map(o => o.id === orderToCancel ? { ...o, status: 'Cancelled', cancelReason } : o));
      setCancelModalOpen(false);
      setOrderToCancel(null);
      setCancelReason('');
    } catch (err) { console.error("Failed to cancel", err); }
  };

  const executeHideOrder = async (id) => {
    try {
      await updateDoc(doc(db, 'orders', id), { hiddenByCustomer: true });
      setMyOrders(myOrders.filter(o => o.id !== id));
    } catch (err) { console.error("Failed to hide order", err); }
  };

  const handleHideOrder = (id) => {
    triggerConfirm("Delete History", "Remove this order from your history? It will no longer be visible here.", () => executeHideOrder(id));
  };

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold">Loading Profile...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const isAdminUser = isAdmin;

  return (
    <div className={`min-h-screen py-16 px-4 ${isAdmin ? 'bg-gray-900' : 'bg-gray-50'}`}>
      
      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 bg-red-600 text-white font-black py-3 rounded uppercase text-sm hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ADDRESS MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-6">{editAddressId ? 'Edit Address' : 'Add New Address'}</h3>
            <form onSubmit={handleSaveAddressModal} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Label (e.g. Home, Office)</label>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} required className="w-full p-3 border rounded font-bold outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Phone Number</label>
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="017..." className={`w-full p-3 border rounded font-bold outline-none transition-colors duration-300 ${phoneError ? 'bg-red-50 border-red-500 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'focus:border-orange-500'}`} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Full Address</label>
                <div className="relative">
                  <textarea value={newAddress} onChange={e => { setNewAddress(e.target.value); setNewCoords(null); }} required placeholder="House, Road, Area, City" className="w-full p-3 pr-12 border rounded font-bold outline-none focus:border-orange-500 h-24"></textarea>
                  <button
                    type="button"
                    onClick={() => fetchCurrentLocation(setNewAddress, setLocating, setNewCoords)}
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
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={closeAddressModal} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 bg-orange-500 text-white font-black py-3 rounded uppercase text-sm hover:bg-black transition-colors">Save Address</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black uppercase text-red-600 mb-4">Cancel Order?</h3>
            <p className="text-sm font-bold text-gray-500 mb-4">Please let us know why you are canceling this order:</p>
            <div className="space-y-2 mb-6">
              {cancellationReasons.map((reason, idx) => (
                <label key={idx} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-red-50">
                  <input type="radio" name="reason" value={reason} onChange={(e) => setCancelReason(e.target.value)} className="w-4 h-4 accent-red-600" />
                  <span className="font-bold text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setCancelModalOpen(false)} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Keep Order</button>
              <button onClick={handleCancelOrder} className="flex-1 bg-red-600 text-white font-black py-3 rounded uppercase text-sm hover:bg-red-700">Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        
        {isAdmin ? (
          <div className="bg-black rounded-xl shadow-2xl border border-gray-800 overflow-hidden mb-8 animate-in fade-in">
            <div className="p-8 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center bg-gray-900 gap-4">
              <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-widest">Command Center</h1>
                <p className="text-gray-400 font-medium mt-1">Status: <span className="font-black text-orange-500 uppercase">Master Admin</span></p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <Link to="/admin" className="bg-orange-500 text-white px-6 py-2.5 rounded-md font-black hover:bg-white hover:text-black transition-colors uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(249,115,22,0.3)] text-center flex-grow">Enter Dashboard</Link>
                <button onClick={() => signOut(auth)} className="bg-gray-800 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-500 transition-colors uppercase tracking-wider text-sm">Exit</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-8 border-orange-500 mb-8 animate-in fade-in">
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50 gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900 uppercase">{displayName ? `${displayName}'s Account` : 'My Account'}</h1>
                <p className="text-gray-600 font-medium mt-1">Logged in as: <span className="font-bold text-orange-500">{user.email}</span></p>
              </div>
              <button onClick={() => signOut(auth)} className="w-full md:w-auto bg-black text-white px-6 py-2.5 rounded-md font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm">Log Out</button>
            </div>
          </div>
        )}

        {/* EDIT PROFILE NAME */}
        {!isAdmin && (
          <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
            <h2 className="text-xl font-black uppercase mb-4 text-gray-800">Personal Details</h2>
            <form onSubmit={handleSaveName} className="flex gap-4 items-end">
              <div className="flex-grow">
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full p-3 border border-gray-200 rounded font-bold outline-none bg-gray-50 focus:border-orange-500" required />
              </div>
              <button type="submit" disabled={isSavingName} className="bg-gray-900 text-white font-black px-6 py-3 rounded uppercase tracking-widest hover:bg-orange-500 transition-colors h-[50px]">{isSavingName ? '...' : 'Save'}</button>
            </form>
          </div>
        )}

        {/* ADDRESS BOOK */}
        <div className={`p-8 rounded-xl shadow-lg mb-8 ${isAdmin ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-xl font-black uppercase ${isAdmin ? 'text-white' : 'text-gray-800'}`}>Address Book</h2>
            <button onClick={() => setShowAddressModal(true)} className="bg-orange-500 text-white text-xs font-black px-4 py-2 rounded uppercase tracking-widest hover:bg-black transition-colors">+ Add New</button>
          </div>
          
          {addresses.length === 0 ? (
            <div className={`p-6 text-center border-2 border-dashed rounded-lg ${isAdmin ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
              <p className="font-bold">No addresses saved yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map(addr => (
                <div key={addr.id} className={`p-5 border-2 rounded-lg relative ${addr.isDefault ? 'border-orange-500 bg-orange-50' : (isAdmin ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-white')}`}>
                  {addr.isDefault && <span className="absolute -top-3 left-4 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">Default</span>}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-black uppercase tracking-widest text-sm">{addr.label}</h3>
                    <div className="flex gap-3">
                      <button onClick={() => handleEditAddress(addr)} className="text-blue-500 hover:text-blue-400 transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteAddress(addr.id)} className="text-red-500 hover:text-red-400 transition-colors drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className={`font-bold text-sm mb-1 ${isAdmin ? 'text-gray-300' : 'text-gray-700'}`}>{addr.phone}</p>
                  <p className={`font-medium text-sm mb-4 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>{addr.address}</p>
                  
                  {!addr.isDefault && (
                    <button onClick={() => handleSetDefault(addr.id)} className={`text-xs font-black uppercase tracking-widest hover:text-orange-500 ${isAdmin ? 'text-gray-500' : 'text-gray-400'}`}>Set as Default</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CUSTOMER ORDER HISTORY */}
        {!isAdmin && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-black text-gray-800 mb-6 uppercase">Order History</h2>
            {myOrders.length === 0 ? (
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                 <p className="text-gray-500 font-medium mb-6">You haven't placed any orders yet.</p>
                 <Link to="/shop" className="inline-block bg-orange-500 text-white px-8 py-3 rounded font-black uppercase tracking-widest hover:bg-black transition-colors">Go to Shop</Link>
               </div>
            ) : (
               <div className="space-y-4">
                 {myOrders.map(order => (
                   <div key={order.id} className={`border rounded-lg p-5 shadow-sm ${order.status === 'Cancelled' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                     <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Order #{order.id.slice(-6)}</p>
                          <p className="font-bold text-gray-800 mt-1">Total: ৳{order.total} <span className="text-xs text-gray-500 font-bold">(incl. ৳{order.deliveryFee || 0} delivery)</span></p>
                        </div>
                      </div>
                      
                      {/* VISUAL ORDER PIPELINE */}
                      <OrderPipeline status={order.status} />
                      <div className="flex justify-end">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {ORDER_STEPS[ORDER_STEPS.indexOf(order.status)] || order.status}
                        </span>
                      </div>
                     
                     {/* Show items bought */}
                     <div className="mt-4 border-t border-gray-100 pt-4">
                       <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Items Bought:</p>
                       <ul className="space-y-1">
                         {order.items?.map((item, idx) => (
                           <li key={idx} className="font-bold text-gray-800 text-sm">
                             {item.quantity}x {item.name} {item.weight ? `(${item.weight}kg)` : ''} - ৳{(item.discountPrice || item.price) * item.quantity}
                           </li>
                         ))}
                       </ul>
                     </div>
                     
                     {/* Actions section */}
                     <div className="border-t pt-4 mt-4 flex flex-wrap items-center justify-between gap-4">
                       {order.status === 'Pending' ? (
                         <button onClick={() => { setOrderToCancel(order.id); setCancelModalOpen(true); }} className="text-xs font-bold text-red-500 hover:text-red-700 underline">Cancel Order</button>
                       ) : (
                         <div />
                       )}
                       <button onClick={() => handleHideOrder(order.id)} className="text-xs font-bold text-gray-400 hover:text-gray-600 underline">
                         Delete History
                       </button>
                     </div>

                     {order.status === 'Cancelled' && (
                       <p className="text-xs font-bold text-red-500 mt-2">Reason: {order.cancelReason}</p>
                     )}

                     {order.status !== 'Cancelled' && (
                       order.trackingLink ? (
                         <div className="border-t pt-4 mt-4 text-center">
                           <a href={order.trackingLink?.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`} target="_blank" rel="noreferrer" className="inline-block w-full bg-blue-500 text-white px-4 py-3 rounded text-sm font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-sm">
                             Track Delivery
                           </a>
                         </div>
                       ) : (
                         <div className="border-t pt-4 mt-4 text-center">
                           <p className="text-xs font-bold text-gray-500 mb-3">No tracking link was provided, contact admin.</p>
                           <a href="https://wa.me/8801581221084" target="_blank" rel="noreferrer" className="inline-block w-full bg-[#25D366] text-white px-4 py-3 rounded text-sm font-black uppercase tracking-widest hover:bg-[#128C7E] transition-colors shadow-lg shadow-green-500/30 animate-pulse">
                             Contact Admin
                           </a>
                         </div>
                       )
                     )}
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}