import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'; 
import { auth, db } from '../firebaseConfig';
import { Navigate, Link } from 'react-router-dom';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- ORDER HISTORY STATE ---
  const [myOrders, setMyOrders] = useState([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';

  const cancellationReasons = [
    "ডেলিভারি অনেক দেরি হচ্ছে (Delivery is taking too long)",
    "ভুল করে অর্ডার দিয়ে ফেলেছি (Ordered by mistake)",
    "অন্য জায়গা থেকে কিনে নিয়েছি (Bought elsewhere)",
    "টাকার সমস্যা (Financial issue)",
    "অন্যান্য (Other)"
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch Profile
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setAddress(docSnap.data().address || '');
            setPhone(docSnap.data().phone || '');
          }
          
          // Fetch User's Orders
          const q = query(collection(db, 'orders'), where("customerEmail", "==", currentUser.email));
          const orderSnap = await getDocs(q);
          // Sort by date descending locally
          const ordersData = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                         .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
          setMyOrders(ordersData);
        } catch (error) {
          console.error("Error fetching profile data:", error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email, address, phone, updatedAt: new Date()
      }, { merge: true });
      alert('Delivery details securely saved!');
    } catch (error) { console.error("Error saving profile", error); }
    setIsSaving(false);
  };

  const handleCancelOrder = async () => {
    if(!cancelReason) return alert("Please select a reason.");
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold">Loading Profile...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <div className={`min-h-screen py-16 px-4 ${isAdmin ? 'bg-gray-900' : 'bg-gray-50'}`}>
      
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
                <h1 className="text-3xl font-black text-gray-900 uppercase">My Account</h1>
                <p className="text-gray-600 font-medium mt-1">Logged in as: <span className="font-bold text-orange-500">{user.email}</span></p>
              </div>
              <button onClick={() => signOut(auth)} className="w-full md:w-auto bg-black text-white px-6 py-2.5 rounded-md font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm">Log Out</button>
            </div>
          </div>
        )}

        <div className={`p-8 rounded-xl shadow-lg mb-8 ${isAdmin ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-black uppercase mb-4 ${isAdmin ? 'text-white' : 'text-gray-800'}`}>Delivery Details</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g., 017..." className={`w-full p-3 border rounded font-bold outline-none ${isAdmin ? 'bg-gray-900 border-gray-700 text-white focus:border-orange-500' : 'bg-gray-50 focus:border-orange-500'}`} required />
            </div>
            <div>
              <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>Full Address</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="House, Road, Area, City" className={`w-full p-3 border rounded font-bold outline-none h-24 ${isAdmin ? 'bg-gray-900 border-gray-700 text-white focus:border-orange-500' : 'bg-gray-50 focus:border-orange-500'}`} required></textarea>
            </div>
            <button type="submit" disabled={isSaving} className="w-full bg-orange-500 text-white font-black py-4 rounded uppercase tracking-widest hover:bg-black transition-colors">{isSaving ? 'Saving...' : 'Save Profile Details'}</button>
          </form>
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
                     <div className="flex justify-between items-start mb-4">
                       <div>
                         <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Order #{order.id.slice(-6)}</p>
                         <p className="font-bold text-gray-800 mt-1">Total: ৳{order.total}</p>
                       </div>
                       <div className="text-right">
                         <span className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest ${
                           order.status === 'Pending' ? 'bg-orange-100 text-orange-600' : 
                           order.status === 'Done' ? 'bg-green-100 text-green-600' : 
                           'bg-red-100 text-red-600'
                         }`}>{order.status}</span>
                       </div>
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
                     
                     {/* Show cancel button ONLY if it's still pending */}
                     {order.status === 'Pending' && (
                       <div className="border-t pt-4 mt-2">
                         <button onClick={() => { setOrderToCancel(order.id); setCancelModalOpen(true); }} className="text-xs font-bold text-red-500 hover:text-red-700 underline">Cancel Order</button>
                       </div>
                     )}
                     {order.status === 'Cancelled' && (
                       <p className="text-xs font-bold text-red-500 mt-2">Reason: {order.cancelReason}</p>
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