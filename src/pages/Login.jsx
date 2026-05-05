import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

export default function Login() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com'; 

  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Changed from "email" to "identifier" to handle both email and phone
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); 
  const [showPortal, setShowPortal] = useState(false);
  const navigate = useNavigate();

  // THE BOUNCER: Now recognizes Phone Logins and lets them bypass verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isPhoneAccount = user.email.endsWith('@phone.vertexpicks.com');
        
        // If verified, OR Admin, OR a Phone Account -> Let them through!
        if (user.emailVerified || isAdmin || isPhoneAccount) {
          if (isAdmin) {
            setShowPortal(true);
          } else {
            navigate('/profile');
          }
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedIdentifier = identifier.trim();
    const isEmailInput = trimmedIdentifier.includes('@');
    
    // The Hacker Workaround: Append a dummy domain if it's a phone number
    const finalLoginEmail = isEmailInput 
      ? trimmedIdentifier 
      : `${trimmedIdentifier.replace(/\s+/g, '')}@phone.vertexpicks.com`;

    try {
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, finalLoginEmail, password);
        
        const isAdmin = userCredential.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isPhoneAccount = userCredential.user.email.endsWith('@phone.vertexpicks.com');
        
        // Block unverified standard emails
        if (!userCredential.user.emailVerified && !isAdmin && !isPhoneAccount) {
          try { await sendEmailVerification(userCredential.user); } catch (resendError) { /* ignore spam limit */ }
          await signOut(auth);
          setError('Please verify your email before logging in. A fresh verification link has been sent to your inbox (check your spam folder)!');
        }
      } else {
        // Sign up process
        const userCredential = await createUserWithEmailAndPassword(auth, finalLoginEmail, password);
        
        if (isEmailInput) {
          // It's an email: Send verification and block them
          await sendEmailVerification(userCredential.user);
          await signOut(auth); 
          setIsLoginMode(true);
          setMessage('Account created! Please check your email (and spam folder) to verify your account before logging in.');
        } else {
          // It's a phone number: No verification needed! Firebase logs them in automatically,
          // and the useEffect above will instantly teleport them to their Profile.
        }
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('An account with this email/phone already exists.');
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else if (err.code === 'auth/invalid-credential') setError('Incorrect email/phone or password.');
      else if (err.code === 'auth/invalid-email') setError('Please enter a valid format.');
      else setError('Something went wrong. Please try again.');
    }
  };

  if (showPortal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-4 shadow-2xl sm:rounded-xl sm:px-10 border-t-8 border-orange-500 text-center animate-in fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto text-orange-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight mb-2">Access Granted</h2>
            <p className="text-gray-500 font-medium mb-8">Welcome back, Admin. Select your destination.</p>
            <div className="space-y-4">
              <button onClick={() => navigate('/admin')} className="w-full py-4 px-4 rounded-md shadow-sm text-lg font-black text-white bg-orange-500 hover:bg-black transition-colors uppercase tracking-wide">Enter Admin Portal</button>
              <button onClick={() => navigate('/profile')} className="w-full py-4 px-4 border-2 border-gray-200 rounded-md shadow-sm text-lg font-black text-gray-700 bg-white hover:bg-gray-50 transition-colors uppercase tracking-wide">Customer Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-4xl font-black text-gray-900 uppercase tracking-tight">{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="mt-2 text-center text-sm text-gray-600 font-medium">Use your email or mobile number</p>
        <div className="mt-8 flex justify-center space-x-12 border-b border-gray-300">
          <button onClick={() => { setIsLoginMode(true); setError(''); setMessage(''); }} className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-800'}`}>Log In</button>
          <button onClick={() => { setIsLoginMode(false); setError(''); setMessage(''); }} className={`pb-3 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${!isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-800'}`}>Sign Up</button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border-t-4 border-orange-500">
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-6 font-bold text-sm border border-red-200">{error}</div>}
          {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-6 font-bold text-sm border border-green-200">{message}</div>}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email or Phone Number</label>
              <input 
                type="text" 
                placeholder="e.g. adib@gmail.com or 017..."
                required 
                value={identifier} 
                onChange={(e) => setIdentifier(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50" 
              />
            </div>
            <button type="submit" className="w-full py-4 px-4 rounded-md shadow-sm text-lg font-black text-white bg-black hover:bg-orange-500 transition-colors uppercase tracking-wide">
              {isLoginMode ? 'Log In' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}