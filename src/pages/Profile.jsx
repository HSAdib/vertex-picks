import { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Navigate, Link } from 'react-router-dom';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for login changes automatically
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold">Loading Profile...</div>;
  }

  // ==========================================
  // LOGGED OUT VIEW: Send them to the real Login page!
  // ==========================================
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ==========================================
  // LOGGED IN VIEW: CUSTOMER DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-8 border-orange-500">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h1 className="text-3xl font-black text-gray-900 uppercase">My Account</h1>
              <p className="text-gray-600 font-medium mt-1">Logged in as: <span className="font-bold text-orange-500">{user.email}</span></p>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-black text-white px-6 py-2.5 rounded-md font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm"
            >
              Log Out
            </button>
          </div>
          
          <div className="p-8">
            <h2 className="text-xl font-black text-gray-800 mb-4 uppercase">Order History</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 font-medium mb-6">You haven't placed any orders yet. Head to the shop to get your first box of mangoes!</p>
              
              {/* The Go To Shop Button! */}
              <Link to="/shop" className="inline-block bg-orange-500 text-white px-8 py-3 rounded font-black uppercase tracking-widest hover:bg-black transition-colors">
                Go to Shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}