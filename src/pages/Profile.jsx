import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../firebase';

export default function Profile() {
  // Authentication State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Listen for login changes automatically
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // Clear form on success
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email already in use.');
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else if (err.code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else setError('Failed to authenticate. Please try again.');
    }
  };

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
  // VIEW 1: LOGGED IN (CUSTOMER DASHBOARD)
  // ==========================================
  if (user) {
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
                <p className="text-gray-500 font-medium">You haven't placed any orders yet. Head to the shop to get your first box of mangoes!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: LOGGED OUT (LOGIN / SIGN UP FORM)
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">
          {isLoginMode ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="mt-2 text-sm text-gray-600 font-medium">
          {isLoginMode ? 'Sign in to track your mango orders' : 'Join Vertex Picks for exclusive access'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border-t-4 border-orange-500">
          
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 font-bold text-sm border border-red-200">{error}</div>}

          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all bg-gray-50 focus:bg-white" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all bg-gray-50 focus:bg-white" 
              />
            </div>

            <button 
              type="submit" 
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-black text-white bg-black hover:bg-orange-500 focus:outline-none transition-colors uppercase tracking-wide"
            >
              {isLoginMode ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
              className="text-sm font-bold text-orange-600 hover:text-orange-500 transition-colors"
            >
              {isLoginMode ? "Don't have an account? Sign up here." : "Already have an account? Sign in here."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}