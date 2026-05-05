import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

export default function Login() {
  // YOUR ADMIN EMAIL
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com'; 

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // NEW: State to trigger the portal selection screen
  const [showPortal, setShowPortal] = useState(false);
  
  const navigate = useNavigate();

  // The Bouncer: Checks who is logging in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If the user is the Admin, show the portal selection screen!
        if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setShowPortal(true);
        } else {
          // If it's a normal customer, send them straight to their profile.
          navigate('/profile');
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        // We don't need a success message here because the screen will instantly transform!
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('An account with this email already exists.');
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else if (err.code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else setError('Something went wrong. Please try again.');
    }
  };

  // ==========================================
  // VIEW 1: ADMIN PORTAL GATEWAY (Only shows AFTER successful admin login)
  // ==========================================
  if (showPortal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-4 shadow-2xl sm:rounded-xl sm:px-10 border-t-8 border-orange-500 text-center animate-[fadeIn_0.5s_ease-out]">
            
            {/* Success Shield Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto text-orange-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight mb-2">Access Granted</h2>
            <p className="text-gray-500 font-medium mb-8">Welcome back, Admin. Select your destination.</p>

            <div className="space-y-4">
              <button 
                onClick={() => navigate('/admin')}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-md shadow-sm text-lg font-black text-white bg-orange-500 hover:bg-black focus:outline-none transition-colors uppercase tracking-wide"
              >
                Enter Admin Portal
              </button>
              <button 
                onClick={() => navigate('/profile')}
                className="w-full flex justify-center py-4 px-4 border-2 border-gray-200 rounded-md shadow-sm text-lg font-black text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors uppercase tracking-wide"
              >
                Customer Dashboard
              </button>
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: STANDARD LOGIN FORM
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* HEADER SECTION */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-4xl font-black text-gray-900 uppercase tracking-tight">
          {isLoginMode ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 font-medium">
          {isLoginMode ? 'Log in to track your mango orders' : 'Join for exclusive mango harvests'}
        </p>

        {/* EXTERNAL FLOATING TABS */}
        <div className="mt-8 flex justify-center space-x-12 border-b border-gray-300">
          <button 
            onClick={() => { setIsLoginMode(true); setError(''); }}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${
              isLoginMode 
                ? 'border-orange-500 text-orange-500' 
                : 'border-transparent text-gray-400 hover:text-gray-800'
            }`}
          >
            Log In
          </button>
          <button 
            onClick={() => { setIsLoginMode(false); setError(''); }}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${
              !isLoginMode 
                ? 'border-orange-500 text-orange-500' 
                : 'border-transparent text-gray-400 hover:text-gray-800'
            }`}
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* MAIN FORM CARD */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border-t-4 border-orange-500">
          
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-6 font-bold text-sm border border-red-200">{error}</div>}

          <form className="space-y-6" onSubmit={handleSubmit}>
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
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-md shadow-sm text-lg font-black text-white bg-black hover:bg-orange-500 focus:outline-none transition-colors uppercase tracking-wide"
            >
              {isLoginMode ? 'Log In' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}