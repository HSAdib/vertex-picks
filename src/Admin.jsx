import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // This function talks to Firebase when you click Login
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
      setError('');
    } catch (err) {
      setError('Invalid master email or password. Access denied.');
    }
  };

  // This function logs you out
  const handleLogout = () => {
    signOut(auth);
    setIsLoggedIn(false);
  };

  // If you are successfully logged in, show the Dashboard
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20 px-4">
        <h1 className="text-3xl font-black text-gray-900 mb-4">MASTER DASHBOARD</h1>
        <p className="text-gray-600 mb-8">Welcome back, Boss. The database is ready.</p>
        {/* We will build the price-editing tools here in the next step! */}
        <button 
          onClick={handleLogout}
          className="bg-red-600 text-white px-6 py-2 rounded font-bold hover:bg-red-700 transition-colors"
        >
          Secure Logout
        </button>
      </div>
    );
  }

  // If you are NOT logged in, show the Login Gate
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 border-t-8 border-orange-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-gray-900">RESTRICTED ACCESS</h2>
          <p className="text-gray-500 mt-2 font-medium">Vertex Picks Admin Portal</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 font-bold text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Master Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Passcode</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 text-white font-black text-lg py-4 rounded hover:bg-orange-600 transition-colors uppercase tracking-widest"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}