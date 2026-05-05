import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Added Firestore imports
import { auth, db } from '../firebaseConfig';
import { Navigate, Link } from 'react-router-dom';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // NEW: Address Form State
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Automatically fetch their saved address when they log in
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAddress(docSnap.data().address || '');
          setPhone(docSnap.data().phone || '');
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
      // Save data directly to Firestore linked to their User ID
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        address: address,
        phone: phone,
        updatedAt: new Date()
      }, { merge: true });
      alert('Delivery details securely saved!');
    } catch (error) {
      console.error("Error saving profile", error);
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (err) { console.error("Error logging out:", err); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold">Loading Profile...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    // Dynamic background: Dark for Admin, Light for Customers
    <div className={`min-h-screen py-16 px-4 ${isAdmin ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-3xl mx-auto">
        
        {isAdmin ? (
          // ==============================
          // VIP ADMIN COMMAND CENTER VIEW
          // ==============================
          <div className="bg-black rounded-xl shadow-2xl border border-gray-800 overflow-hidden mb-8 animate-in fade-in">
            <div className="p-8 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center bg-gray-900 gap-4">
              <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-widest">Command Center</h1>
                <p className="text-gray-400 font-medium mt-1">Status: <span className="font-black text-orange-500 uppercase">Master Admin</span></p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <Link to="/admin" className="bg-orange-500 text-white px-6 py-2.5 rounded-md font-black hover:bg-white hover:text-black transition-colors uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(249,115,22,0.3)] text-center flex-grow">
                  Enter Dashboard
                </Link>
                <button onClick={handleLogout} className="bg-gray-800 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-500 transition-colors uppercase tracking-wider text-sm">Exit</button>
              </div>
            </div>
          </div>
        ) : (
          // ==============================
          // STANDARD CUSTOMER VIEW HEADER
          // ==============================
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-8 border-orange-500 mb-8 animate-in fade-in">
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50 gap-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900 uppercase">My Account</h1>
                <p className="text-gray-600 font-medium mt-1">Logged in as: <span className="font-bold text-orange-500">{user.email}</span></p>
              </div>
              <button onClick={handleLogout} className="w-full md:w-auto bg-black text-white px-6 py-2.5 rounded-md font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm">Log Out</button>
            </div>
          </div>
        )}

        {/* ==============================
            MANDATORY DELIVERY DETAILS FORM
            ============================== */}
        <div className={`p-8 rounded-xl shadow-lg mb-8 ${isAdmin ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-black uppercase mb-4 ${isAdmin ? 'text-white' : 'text-gray-800'}`}>Delivery Details</h2>
          <p className={`text-sm mb-6 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>You must provide your delivery address and phone number to place orders.</p>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>Phone Number</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="e.g., 017..." 
                className={`w-full p-3 border rounded font-bold outline-none ${isAdmin ? 'bg-gray-900 border-gray-700 text-white focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'}`} 
                required 
              />
            </div>
            <div>
              <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isAdmin ? 'text-gray-400' : 'text-gray-500'}`}>Full Address</label>
              <textarea 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="House, Road, Area, City" 
                className={`w-full p-3 border rounded font-bold outline-none h-24 ${isAdmin ? 'bg-gray-900 border-gray-700 text-white focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'}`} 
                required
              ></textarea>
            </div>
            <button type="submit" disabled={isSaving} className="w-full bg-orange-500 text-white font-black py-4 rounded uppercase tracking-widest hover:bg-black transition-colors">
              {isSaving ? 'Saving...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* ORDER HISTORY (Hidden for Admin to keep the UI clean) */}
        {!isAdmin && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-black text-gray-800 mb-4 uppercase">Order History</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 font-medium mb-6">You haven't placed any orders yet. Head to the shop to get your first box of mangoes!</p>
              <Link to="/shop" className="inline-block bg-orange-500 text-white px-8 py-3 rounded font-black uppercase tracking-widest hover:bg-black transition-colors">
                Go to Shop
              </Link>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}