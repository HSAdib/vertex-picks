import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider, // NEW
  FacebookAuthProvider, // NEW
  signInWithPopup // NEW
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

export default function Login() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com'; 

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); 
  const [showPortal, setShowPortal] = useState(false);
  const navigate = useNavigate();

  // THE BOUNCER: Handles redirects after login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isPhoneAccount = user.email?.includes('@phone.vertexpicks.com');
        const isSocialLogin = user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com');
        
        // Social logins are pre-verified by Google/FB, so they pass instantly
        if (user.emailVerified || isAdmin || isPhoneAccount || isSocialLogin) {
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

  // SOCIAL LOGIN HANDLERS
  const handleSocialLogin = async (providerName) => {
    setError('');
    const provider = providerName === 'google' 
      ? new GoogleAuthProvider() 
      : new FacebookAuthProvider();
    
    try {
      // This triggers the popup properly
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError(`Failed to sign in with ${providerName}. Ensure your popups aren't blocked.`);
    }
  };

  const processIdentifier = (input) => {
    const cleanInput = input.trim();
    const isEmail = cleanInput.includes('@');
    const emailToUse = isEmail ? cleanInput : `${cleanInput.replace(/\s+/g, '')}@phone.vertexpicks.com`;
    return { isEmail, emailToUse };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (!isLoginMode && password !== confirmPassword) return setError('Passwords do not match!');

    const { isEmail, emailToUse } = processIdentifier(identifier);

    try {
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
        const isAdmin = userCredential.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (isEmail && !userCredential.user.emailVerified && !isAdmin) {
          try { await sendEmailVerification(userCredential.user); } catch (e) {}
          await signOut(auth);
          setError('Please verify your email. Check your inbox!');
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password);
        if (isEmail) {
          await sendEmailVerification(userCredential.user);
          await signOut(auth); 
          setIsLoginMode(true);
          setMessage('Account created! Verify your email before logging in.');
        }
      }
    } catch (err) {
      setError('Invalid credentials or connection error.');
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setMessage('');
    const { isEmail, emailToUse } = processIdentifier(identifier);
    if (!identifier || !isEmail) return setError('Please enter a valid email address first.');
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      setMessage('Password reset link sent! Check your inbox.');
    } catch (err) { setError('Failed to send reset email.'); }
  };

  if (showPortal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-10 px-10 shadow-2xl rounded-xl border-t-8 border-orange-500 text-center">
            <h2 className="text-3xl font-black text-gray-900 uppercase mb-8 tracking-tight">Access Granted</h2>
            <div className="space-y-4">
              <button onClick={() => navigate('/admin')} className="w-full py-4 rounded-md font-black text-white bg-orange-500 hover:bg-black uppercase transition-colors">Enter Admin Portal</button>
              <button onClick={() => navigate('/profile')} className="w-full py-4 rounded-md font-black text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 uppercase transition-colors">Customer Dashboard</button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-4xl font-black text-gray-900 uppercase tracking-tight">{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
        <div className="mt-8 flex justify-center space-x-12 border-b border-gray-300">
          <button onClick={() => setIsLoginMode(true)} className={`pb-3 text-sm font-black uppercase border-b-4 ${isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>Log In</button>
          <button onClick={() => setIsLoginMode(false)} className={`pb-3 text-sm font-black uppercase border-b-4 ${!isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>Sign Up</button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-10 shadow-xl rounded-xl border-t-4 border-orange-500">
          
          {/* SOCIAL BUTTONS */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button type="button" onClick={() => handleSocialLogin('google')} className="flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-md font-bold text-xs uppercase hover:bg-gray-50 transition-colors">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" /> Gmail
            </button>
            <button type="button" onClick={() => handleSocialLogin('facebook')} className="flex items-center justify-center gap-2 py-2.5 bg-[#1877F2] text-white rounded-md font-bold text-xs uppercase hover:opacity-90 transition-opacity">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-3 text-gray-400">Or continue manually</span></div>
          </div>

          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-6 font-bold text-xs border border-red-200">{error}</div>}
          {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-6 font-bold text-xs border border-green-200">{message}</div>}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <input type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or Phone Number" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-orange-200 transition-all" />
            
            <div className="relative">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (Min 8 chars)" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none pr-12 transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 hover:text-black uppercase">{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>

            {!isLoginMode && (
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none pr-12 transition-all" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">{showConfirmPassword ? 'HIDE' : 'SHOW'}</button>
              </div>
            )}

            {isLoginMode && (
              <div className="flex justify-end">
                <button type="button" onClick={handleForgotPassword} className="text-[10px] font-black text-orange-500 hover:text-black uppercase tracking-widest transition-colors">Forgot Password?</button>
              </div>
            )}

            <button type="submit" className="w-full py-4 rounded-md font-black text-white bg-black hover:bg-orange-500 transition-all uppercase tracking-widest shadow-lg">
              {isLoginMode ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}