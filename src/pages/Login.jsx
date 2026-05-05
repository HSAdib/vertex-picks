import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider, // Keep Google
  signInWithPopup 
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

export default function Login() {
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com'; 

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); 
  const [showPortal, setShowPortal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isPhoneAccount = user.email?.includes('@phone.vertexpicks.com');
        const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
        
        // Redirect if: Verified Email, Admin, Phone Account, or Google Login
        if (user.emailVerified || isAdmin || isPhoneAccount || isGoogleUser) {
          if (isAdmin) setShowPortal(true);
          else navigate('/profile');
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // GOOGLE LOGIN HANDLER
  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err); // Logs the full error to your browser console
      setError(`Error: ${err.code} - ${err.message}`); // Displays the exact Firebase error on screen
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
      if (err.code === 'auth/email-already-in-use') {
        setError('You already have an account with this email.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid credentials. If you forgot your password, click the link below.');
      } else {
        setError('Invalid credentials or connection error.');
      }
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const { isEmail, emailToUse } = processIdentifier(identifier);
    if (!identifier || !isEmail) return setError('Please enter a valid email address first.');
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      setMessage('Password reset link sent! Check your inbox.');
      setIsForgotPasswordMode(false);
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
        <h2 className="text-center text-4xl font-black text-gray-900 uppercase tracking-tight">
          {isForgotPasswordMode ? 'Reset Password' : (isLoginMode ? 'Welcome Back' : 'Create Account')}
        </h2>
        {!isForgotPasswordMode && (
          <div className="mt-8 flex justify-center space-x-12 border-b border-gray-300">
            <button onClick={() => setIsLoginMode(true)} className={`pb-3 text-sm font-black uppercase border-b-4 ${isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>Log In</button>
            <button onClick={() => setIsLoginMode(false)} className={`pb-3 text-sm font-black uppercase border-b-4 ${!isLoginMode ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'}`}>Sign Up</button>
          </div>
        )}
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-10 shadow-xl rounded-xl border-t-4 border-orange-500">
          
          {/* GOOGLE BUTTON - FULL WIDTH */}
          <div className="mb-6">
            <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-100 rounded-md font-bold text-sm uppercase hover:bg-gray-50 transition-all shadow-sm">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-3 text-gray-400">Or use email / phone</span></div>
          </div>

          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-6 font-bold text-xs border border-red-200">{error}</div>}
          {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-6 font-bold text-xs border border-green-200">{message}</div>}

          {isForgotPasswordMode ? (
            <form className="space-y-5" onSubmit={handleForgotPasswordSubmit}>
              <input type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email address" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-orange-200 transition-all" />
              
              <div className="flex justify-between items-center mt-6">
                <button type="button" onClick={() => setIsForgotPasswordMode(false)} className="text-[10px] font-black text-gray-400 hover:text-black uppercase tracking-widest transition-colors">Back to Login</button>
                <button type="submit" className="py-4 px-6 rounded-md font-black text-white bg-black hover:bg-orange-500 transition-all uppercase tracking-widest shadow-lg">
                  Send Reset Link
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <input type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email or Phone Number" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-orange-200 transition-all" />
              
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (Min 8 chars)" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none pr-12 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>

              {!isLoginMode && (
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-bold outline-none pr-12 transition-all" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors">
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
              )}

              {isLoginMode && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setIsForgotPasswordMode(true); setError(''); setMessage(''); }} className="text-[10px] font-black text-orange-500 hover:text-black uppercase tracking-widest transition-colors">Forgot Password?</button>
                </div>
              )}

              <button type="submit" className="w-full py-4 rounded-md font-black text-white bg-black hover:bg-orange-500 transition-all uppercase tracking-widest shadow-lg">
                {isLoginMode ? 'Log In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}