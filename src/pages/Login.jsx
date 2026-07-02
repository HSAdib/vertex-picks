import { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/useStore';
import { isValidBDPhoneNumber } from '../utils/phoneValidation';
import { toast } from 'react-hot-toast';

const mergeGuestData = async (user) => {
  try {
    const guestProfile = JSON.parse(localStorage.getItem('vertex_guest_profile') || '{}');
    const guestAddresses = JSON.parse(localStorage.getItem('vertex_guest_addresses') || '[]');
    const guestOrders = JSON.parse(localStorage.getItem('vertex_guest_orders') || '[]');

    if (!guestProfile.name && !guestProfile.phone && !guestProfile.coords && guestAddresses.length === 0 && guestOrders.length === 0) {
      return; // Nothing to merge — skip silently, no toast
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    let userData = {};
    if (userSnap.exists()) {
      userData = userSnap.data();
    }

    const updates = {};

    if (guestProfile.name && !userData.name) {
      updates.name = guestProfile.name;
      try {
        await updateProfile(user, { displayName: guestProfile.name });
      } catch (err) {
        console.error("Failed to update user displayName:", err);
      }
    }

    if (guestProfile.phone && !userData.phone) {
      updates.phone = guestProfile.phone;
    }

    if (guestProfile.coords && !userData.coords) {
      updates.coords = guestProfile.coords;
    }

    const existingAddresses = userData.addresses || [];
    const mergedAddresses = [...existingAddresses];
    let addressMergedCount = 0;
    
    guestAddresses.forEach(gAddr => {
      const isDuplicate = existingAddresses.some(
        eAddr => eAddr.address?.toLowerCase().trim() === gAddr.address?.toLowerCase().trim() &&
                 eAddr.phone?.trim() === gAddr.phone?.trim()
      );
      if (!isDuplicate) {
        mergedAddresses.push(gAddr);
        addressMergedCount++;
      }
    });

    if (addressMergedCount > 0) {
      updates.addresses = mergedAddresses;
    }

    if (Object.keys(updates).length > 0) {
      await setDoc(userRef, updates, { merge: true });
    }

    if (guestOrders.length > 0) {
      for (const order of guestOrders) {
        if (order.id) {
          try {
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
              customerEmail: user.email,
              isGuest: false
            });
          } catch (err) {
            console.error(`Failed to merge order ${order.id}:`, err);
          }
        }
      }
    }

    localStorage.removeItem('vertex_guest_profile');
    localStorage.removeItem('vertex_guest_addresses');
    localStorage.removeItem('vertex_guest_orders');

    // Only show if there was real data to merge
    const hadData = Object.keys(updates).length > 0 || guestOrders.length > 0;
    if (hadData) {
      toast.success("Guest data synced to your account! 🎉", { id: 'guest-merge' });
    }
  } catch (err) {
    console.error("Error merging guest data:", err);
  }
};

export default function Login() {
  const { ADMIN_EMAIL } = useAuth();
  const { storeName } = useStore();

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isPhoneAccount = user.email?.includes('@phone.vertexpicks.com');
        const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');

        if (user.emailVerified || isAdmin || isPhoneAccount || isGoogleUser) {
          await mergeGuestData(user);
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
      // Use a fixed ID so if onAuthStateChanged also triggers, this toast is replaced not doubled
      toast.success("Logged in successfully!", { id: 'login-success' });
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
          toast.success("Logged in successfully!", { id: 'login-success' });
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: 'calc(var(--nav-height, 88px) + 2rem)', paddingBottom: '2rem', fontFamily: "'Sora', sans-serif", boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '420px', width: '90%', margin: 'auto', background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)', padding: '2rem 2rem', boxSizing: 'border-box', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.6rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Access Granted</h2>
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 2rem 0' }}>Administrative session recognized. Route dynamically.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => navigate('/admin')}
              style={{
                width: '100%',
                background: '#E8540A',
                color: '#FFFFFF',
                borderRadius: '100px',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 800,
                fontSize: '0.9rem',
                padding: '0.8rem',
                border: 'none',
                boxShadow: '0 6px 24px rgba(232,84,10,0.2)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 32px rgba(232,84,10,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,84,10,0.2)';
              }}
            >
              Enter Admin Portal ⚡
            </button>
            <button
              onClick={() => navigate('/profile')}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: '100px',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.8rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              My Customer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const labelStyle = {
    fontFamily: "'Sora', sans-serif",
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
    display: 'block',
    textAlign: 'left'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: 'calc(var(--nav-height, 88px) + 2rem)', paddingBottom: '2rem', fontFamily: "'Sora', sans-serif", boxSizing: 'border-box' }}>
      <style>{`
        .login-input {
          background: var(--bg-card);
          border: 1.5px solid var(--border-color);
          border-radius: 8px;
          padding: 0.65rem 1rem;
          font-family: 'Sora', sans-serif;
          font-size: 0.875rem;
          color: var(--text-primary);
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }
        .login-input:focus {
          border-color: #E8540A;
          outline: none;
        }
        .login-btn-primary {
          width: 100%;
          background: #E8540A;
          color: #FFFFFF;
          border-radius: 100px;
          font-family: 'Sora', sans-serif;
          font-weight: 800;
          font-size: 1rem;
          padding: 0.8rem;
          border: none;
          box-shadow: 0 6px 24px rgba(232,84,10,0.3);
          cursor: pointer;
          margin-top: 1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(232,84,10,0.4);
        }
        .google-btn {
          width: 100%;
          background: var(--bg-card);
          border: 1.5px solid var(--border-color);
          border-radius: 100px;
          font-family: 'Sora', sans-serif;
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--text-primary);
          padding: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: border-color 0.2s ease;
        }
        .google-btn:hover {
          border-color: #E8540A;
        }
        .footer-link-text {
          color: #E8540A;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }
        .footer-link-text:hover {
          text-decoration: underline;
        }
        .login-divider-line {
          flex: 1;
          border-top: 1px solid var(--border-color);
        }
        .login-divider-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-card);
          padding: 0 0.75rem;
        }
        .password-toggle-btn {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          text-align: center;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          padding: 0;
        }
      `}</style>

      {/* LOGIN CARD */}
      <div style={{ maxWidth: '420px', width: '90%', margin: 'auto', background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)', padding: '2rem 2rem', boxSizing: 'border-box' }}>
        
        {/* CARD HEADER */}
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.6rem', color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 0.5rem 0' }}>
            {storeName}
          </h1>
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 1.5rem 0' }}>
            {isForgotPasswordMode ? 'Reset your account password' : 'Premium Rajshahi Mangoes, direct to your door'}
          </p>
        </div>

        {/* TAB SWITCHER (Login / Sign Up) */}
        {!isForgotPasswordMode && (
          <div style={{ background: 'var(--bg-primary)', borderRadius: '100px', padding: '0.25rem', display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setIsLoginMode(true); setError(''); setMessage(''); }}
              style={{
                flex: 1,
                borderRadius: '100px',
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '0.55rem 1rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                background: isLoginMode ? 'var(--bg-card)' : 'transparent',
                color: isLoginMode ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isLoginMode ? '0 2px 8px var(--shadow-color)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginMode(false); setError(''); setMessage(''); }}
              style={{
                flex: 1,
                borderRadius: '100px',
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '0.55rem 1rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                background: !isLoginMode ? 'var(--bg-card)' : 'transparent',
                color: !isLoginMode ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: !isLoginMode ? '0 2px 8px var(--shadow-color)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* ERROR / SUCCESS MESSAGES */}
        {error && (
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.78rem',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            marginTop: '0.75rem',
            marginBottom: '1rem',
            background: '#FFF0F0',
            color: '#E8540A',
            border: '1.5px solid #FFD0C0',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.78rem',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            marginTop: '0.75rem',
            marginBottom: '1rem',
            background: '#F0FFF4',
            color: '#22863a',
            border: '1.5px solid #C0F0D0',
            textAlign: 'left'
          }}>
            {message}
          </div>
        )}

        {/* GOOGLE LOGIN BUTTON & GUEST LINK */}
        {!isForgotPasswordMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="google-btn"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }}
              />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="google-btn"
              style={{ marginTop: '0.25rem' }}
            >
              Continue as Guest
            </button>
          </div>
        )}

        {/* DIVIDER */}
        {!isForgotPasswordMode && (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '1.25rem 0', select: 'none' }}>
            <div className="login-divider-line"></div>
            <span className="login-divider-text">or</span>
            <div className="login-divider-line"></div>
          </div>
        )}

        {/* FORMS */}
        {isForgotPasswordMode ? (
          <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div style={{ width: '100%' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@email.com"
                className="login-input"
              />
            </div>

            <button
              type="submit"
              className="login-btn-primary"
            >
              Send Reset Link
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div style={{ width: '100%' }}>
              <label style={labelStyle}>Email or Phone Number</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or Phone Number"
                className="login-input"
                style={{
                  borderColor: phoneError ? '#E8540A' : 'var(--border-color)',
                  background: phoneError ? 'rgba(232, 84, 10, 0.12)' : 'var(--bg-card)'
                }}
              />
            </div>

            <div style={{ width: '100%' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (Min 8 chars)"
                  className="login-input"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                >
                  {showPassword ? (
                    <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!isLoginMode && (
              <div style={{ width: '100%' }}>
                <label style={labelStyle}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="login-input"
                    style={{ paddingRight: '3rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle-btn"
                  >
                    {showConfirmPassword ? (
                      <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isLoginMode && (
              <div style={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => { setIsForgotPasswordMode(true); setError(''); setMessage(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#E8540A',
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                  className="footer-link-text"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="login-btn-primary"
            >
              {isLoginMode ? 'Log In' : 'Create Account'}
            </button>
          </form>
        )}
      </div>

      {/* FOOTER LINK BELOW THE CARD */}
      {isForgotPasswordMode && (
        <div style={{ marginTop: '1.5rem', fontFamily: "'Sora', sans-serif", fontSize: '0.78rem', color: '#888888', textAlign: 'center' }}>
          Remember your password?{' '}
          <span onClick={() => setIsForgotPasswordMode(false)} className="footer-link-text">
            Back to Login
          </span>
        </div>
      )}
    </div>
  );
}
