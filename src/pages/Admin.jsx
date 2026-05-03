import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Admin() {
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Product Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState('himsagar.jpg'); 
  const [successMessage, setSuccessMessage] = useState('');

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

  const handleLogout = () => {
    signOut(auth);
    setIsLoggedIn(false);
  };

  // This function pushes your new mango to the live Firebase database
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'mangoes'), {
        name: name,
        price: Number(price),
        description: description,
        image: `/${imageFile}`, // Points to images in your public folder
        createdAt: new Date()
      });
      
      setSuccessMessage(`Success! ${name} is now live on the database.`);
      setName('');
      setPrice('');
      setDescription('');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError('Failed to add product to the database. Check console.');
      console.error(err);
    }
  };

  // --- LOGGED IN VIEW: THE DASHBOARD ---
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-10 px-4 pb-20">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 border-t-8 border-orange-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4 border-gray-100">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">MASTER DASHBOARD</h1>
              <p className="text-gray-500 font-medium mt-1">Database connection: Online</p>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-red-50 text-red-600 px-4 py-2 rounded-md font-bold hover:bg-red-600 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>

          <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-wider">Add New Product</h2>
          
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md mb-6 font-bold">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleAddProduct} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Mango Name</label>
              <input
                type="text"
                placeholder="e.g., Premium Himsagar Box"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Price (BDT)</label>
                <input
                  type="number"
                  placeholder="e.g., 2500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Image Filename</label>
                <input
                  type="text"
                  placeholder="e.g., himsagar.jpg"
                  value={imageFile}
                  onChange={(e) => setImageFile(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Must match a file in your public folder.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
              <textarea
                placeholder="Describe the quality, weight, and taste..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
                rows="3"
                required
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-black text-white font-black text-lg py-4 rounded-md hover:bg-orange-500 transition-colors uppercase tracking-widest mt-4"
            >
              Push to Live Storefront
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- LOGGED OUT VIEW: THE VAULT DOOR ---
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 border-t-8 border-orange-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">RESTRICTED ACCESS</h2>
          <p className="text-gray-500 mt-2 font-medium">Vertex Picks Admin Portal</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 font-bold text-sm">
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
              className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Passcode</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-gray-50 focus:bg-white"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 text-white font-black text-lg py-4 rounded-md hover:bg-orange-600 transition-colors uppercase tracking-widest"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}