import { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { toast } from 'react-hot-toast';

export default function Login() {
  const { ADMIN_EMAIL } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
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

        if (user.emailVerified || isAdmin || isPhoneAccount || isGoogleUser) {
          if (isAdmin) {
            setShowPortal(true);
          } else {
            navigate('/profile');
          }
        }
      }
    });
    return () => unsubscribe();
  }, [navigate, ADMIN_EMAIL]);

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Google Login Successful!");
    } catch (err) {
      console.error(err);
      setError(`Google login error: ${err.message}`);
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

    const { isEmail, emailToUse } = processIdentifier(identifier);
    if (!isEmail && !isValidBDPhoneNumber(identifier)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      return setError('Please enter a valid Bangladeshi phone number');
    }

    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (!isLoginMode && password !== confirmPassword) return setError('Passwords do not match!');

    try {
      if (isLoginMode) {
        const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
        const isAdmin = userCredential.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (isEmail && !userCredential.user.emailVerified && !isAdmin) {
          try { await sendEmailVerification(userCredential.user); } catch { /* ignore */ }
          await signOut(auth);
          setError('Please verify your email address. Check your inbox!');
        } else {
          toast.success("Logged in successfully!");
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password);
        if (isEmail) {
          await sendEmailVerification(userCredential.user);
          await signOut(auth);
          setIsLoginMode(true);
          setMessage('Account created! Verification link sent. Check your email inbox.');
          toast.success("Account created successfully!");
        } else {
          toast.success("Account created successfully!");
        }
      }
    } catch (err) {
      console.error("Firebase Credentials Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('You already have an account with this email/phone number.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid credentials. If you forgot your password, reset it below.');
      } else {
        setError('Connection error or invalid account credentials.');
      }
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const { isEmail, emailToUse } = processIdentifier(identifier);
    if (!identifier) return setError('Please enter a valid email address first.');
    if (!isEmail) return setError('Password reset is only available via email address.');
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      setMessage('Password reset link sent! Check your email inbox.');
      setIsForgotPasswordMode(false);
      toast.success("Password reset link sent!");
    } catch (err) {
      console.error(err);
      setError('Failed to send reset email.');
    }
  };

  if (showPortal) {
    return (
      <div className="min-h-screen bg-gray1 flex flex-col justify-center py-12 px-4 pt-28 animate-in fade-in duration-200 select-none">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-10 px-8 shadow-md rounded-brand border-t-4 border-primary text-center">
          <h2 className="text-3xl font-display font-black text-dark uppercase mb-4 tracking-tight">Access Granted</h2>
          <p className="text-xs text-gray4 font-semibold mb-8">Administrative session recognized. Route dynamically.</p>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-full btn-primary py-3.5 tracking-wider font-bold uppercase text-sm"
            >
              Enter Admin Portal ⚡
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full btn-secondary py-3.5 tracking-wider font-bold uppercase text-sm"
            >
              My Customer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f8fafc] flex flex-col items-center pb-20 px-4 select-none font-['Sora'] w-full animate-in fade-in duration-300"
      style={{ paddingTop: '180px' }}
    >
      {/* 1. THE HEADER GROUP - COMPLETELY OUTSIDE AND SEPARATE FROM THE CARD */}
      <div className="w-full max-w-md flex flex-col items-center mb-10">
        <h1 className="text-center font-black text-4xl sm:text-5xl text-[#0A192F] tracking-tight uppercase mb-6 leading-tight font-sans">
          {isForgotPasswordMode ? 'RESET PASSWORD' : 'WELCOME BACK'}
        </h1>

        {/* TAB SWITCHERS AT THE BOTTOM OF THE HEADER GROUP */}
        {!isForgotPasswordMode && (
          <div className="w-full border-b border-gray-200 flex justify-center text-sm font-black uppercase tracking-widest relative">
            <div className="flex gap-12 relative top-[1px]">
              <button
                type="button"
                onClick={() => { setIsLoginMode(true); setError(''); setMessage(''); }}
                className={`pb-4 outline-none transition-all duration-200 border-b-4 ${isLoginMode
                  ? 'text-[#ff6b00] border-[#ff6b00] font-black'
                  : 'text-gray-400 border-transparent hover:text-gray-600 font-bold'
                  }`}
              >
                LOG IN
              </button>
              <button
                type="button"
                onClick={() => { setIsLoginMode(false); setError(''); setMessage(''); }}
                className={`pb-4 outline-none transition-all duration-200 border-b-4 ${!isLoginMode
                  ? 'text-[#ff6b00] border-[#ff6b00] font-black'
                  : 'text-gray-400 border-transparent hover:text-gray-600 font-bold'
                  }`}
              >
                SIGN UP
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. THE WHITE FORM CARD - SEPARATE CONTAINER WITH PERFECT CORNERS & PADDING */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-t-4 border-[#ff6b00] p-8 sm:p-10 flex flex-col gap-5">

        {/* ALERTS */}
        {error && <div className="bg-red-50 text-red-600 p-3.5 rounded-xl font-semibold text-xs border border-red-200/60 animate-shake w-full">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3.5 rounded-xl font-semibold text-xs border border-green-200/60 animate-fadeIn w-full">{message}</div>}

        {/* GOOGLE SIGN IN BUTTON */}
        {!isForgotPasswordMode && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 min-h-[52px] border border-gray-200 hover:border-gray-300 rounded-xl font-bold text-sm text-[#0A192F] bg-white transition-all shadow-sm tracking-wide"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5 mr-1 flex-shrink-0"
            />
            CONTINUE WITH GOOGLE
          </button>
        )}

        {/* OR DIVIDER - THE FLEX DIVIDER FIX */}
        {!isForgotPasswordMode && (
          <div className="flex items-center gap-4 my-2 w-full select-none">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-gray-400 uppercase font-sans whitespace-nowrap">
              OR USE EMAIL / PHONE
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        )}

        {/* FORMS */}
        {isForgotPasswordMode ? (
          <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">Email Address</label>
              <input
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@email.com"
                className="w-full px-4 py-4 min-h-[52px] bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-gray-400 focus:bg-white focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/20 outline-none transition-all duration-200 font-sans shadow-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-2 w-full">
              <button
                type="button"
                onClick={() => setIsForgotPasswordMode(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wider font-sans py-2"
              >
                ← BACK TO LOGIN
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-4 min-h-[52px] bg-black hover:bg-gray-900 text-white text-sm font-black uppercase rounded-xl tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all font-sans flex items-center justify-center"
              >
                SEND RESET LINK
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            <div className="w-full">
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or Phone Number"
                className={`w-full px-4 py-4 min-h-[52px] bg-gray-50 border rounded-xl text-sm font-medium text-slate-800 placeholder:text-gray-400 focus:bg-white focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/20 outline-none transition-all duration-200 font-sans shadow-xs ${phoneError ? 'border-red-500 bg-red-50 animate-shake' : 'border-gray-200'
                  }`}
              />
            </div>

            <div className="w-full">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (Min 8 chars)"
                  className="w-full px-4 py-4 min-h-[52px] bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-gray-400 focus:bg-white focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/20 outline-none transition-all duration-200 font-sans pr-12 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!isLoginMode && (
              <div className="w-full">
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full px-4 py-4 min-h-[52px] bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-gray-400 focus:bg-white focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/20 outline-none transition-all duration-200 font-sans pr-12 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isLoginMode && (
              <div className="flex justify-end w-full">
                <button
                  type="button"
                  onClick={() => { setIsForgotPasswordMode(true); setError(''); setMessage(''); }}
                  className="text-xs font-bold text-[#ff6b00] hover:text-[#e05e00] hover:underline uppercase tracking-wider font-sans"
                >
                  FORGOT PASSWORD?
                </button>
              </div>
            )}

            <div className="pt-2 w-full">
              <button
                type="submit"
                className="w-full py-4 min-h-[52px] bg-black hover:bg-gray-900 text-white font-black uppercase text-sm tracking-wider rounded-xl shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 font-sans flex items-center justify-center"
              >
                {isLoginMode ? 'LOG IN' : 'CREATE ACCOUNT'}
              </button>
            </div>
          </form>
        )}

        {/* GUEST CONNECTOR */}
        {!isForgotPasswordMode && (
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="w-full py-4 min-h-[52px] bg-gray-100 hover:bg-gray-200 text-[#0A192F] font-black uppercase text-sm tracking-wider rounded-xl transition-all duration-200 font-sans flex items-center justify-center"
          >
            CONTINUE AS GUEST
          </button>
        )}
      </div>
    </div>
  );
}