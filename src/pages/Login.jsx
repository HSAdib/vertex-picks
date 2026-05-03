import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../Firebase';

export default function Login() {
  // Toggle between Login and Sign Up mode
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (isLoginMode) {
        // Log existing customer in
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess('Welcome back! Redirecting to shop...');
        // We will add the actual redirect code later!
      } else {
        // Create brand new customer account
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccess('Account created successfully! Welcome to Vertex Picks.');
      }
    } catch (err) {
      // Clean up the ugly Firebase error messages for the customer
      if (err.code === 'auth/email-already-in-use') setError('An account with this email already exists.');
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters.');
      else if (err.code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-4xl font-black text-gray-900 uppercase tracking-tight">
          {isLoginMode ? 'Sign In' : 'Create Account'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 font-medium">
          {isLoginMode ? 'Access your Vertex Picks account' : 'Join for exclusive mango harvests'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border-t-4 border-orange-500">
          
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 font-bold text-sm border border-red-200">{error}</div>}
          {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 font-bold text-sm border border-green-200">{success}</div>}

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
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-black text-white bg-black hover:bg-orange-500 focus:outline-none transition-colors uppercase tracking-wide"
            >
              {isLoginMode ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
                setSuccess('');
              }}
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