import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../Firebase';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(''); // Text-based URL instead of a file
  
  // UI State
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [liveMangoes, setLiveMangoes] = useState([]);
  
  // Edit State
  const [editingId, setEditingId] = useState(null);

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'mangoes'));
      const productsArray = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveMangoes(productsArray);
    } catch (error) {
      console.error("Error fetching: ", error);
    }
  };

  useEffect(() => { if (isLoggedIn) fetchProducts(); }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
      setError('');
    } catch (err) { setError('Invalid credentials.'); }
  };

  const handleLogout = () => { signOut(auth); setIsLoggedIn(false); };

  // --- TRIGGER EDIT MODE ---
  const handleEditClick = (mango) => {
    setEditingId(mango.id);
    setName(mango.name);
    setPrice(mango.price);
    setDescription(mango.description);
    setImageUrl(mango.image); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName(''); setPrice(''); setDescription(''); setImageUrl('');
  };

  // --- SUBMIT: HANDLES BOTH ADD AND UPDATE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setError('');

    try {
      const productData = {
        name: name,
        price: Number(price),
        description: description,
        image: imageUrl, // Saves the text link to the database
        updatedAt: new Date()
      };

      if (editingId) {
        await updateDoc(doc(db, 'mangoes', editingId), productData);
        setSuccessMessage('Product updated successfully!');
      } else {
        productData.createdAt = new Date();
        await addDoc(collection(db, 'mangoes'), productData);
        setSuccessMessage('New product pushed to live store!');
      }

      cancelEdit();
      fetchProducts();
      setTimeout(() => setSuccessMessage(''), 4000);

    } catch (err) {
      setError(err.message || 'Failed to save product.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this listing permanently?')) {
      await deleteDoc(doc(db, 'mangoes', id));
      fetchProducts();
    }
  };

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-10 px-4 pb-20">
        <div className="max-w-5xl w-full">
          
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border-t-8 border-orange-500 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">MASTER DASHBOARD</h1>
              <p className="text-gray-500 font-medium mt-1">Status: Online | Storage: External (Links)</p>
            </div>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-4 py-2 rounded-md font-bold hover:bg-red-600 hover:text-white transition-colors">Logout</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* FORM COLUMN */}
            <div className={`bg-white rounded-xl shadow-lg p-8 border-2 transition-colors ${editingId ? 'border-orange-500' : 'border-transparent'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-wider">
                  {editingId ? 'Edit Product' : 'Add New Product'}
                </h2>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="text-sm font-bold text-gray-500 hover:text-gray-800 underline">Cancel Edit</button>
                )}
              </div>

              {successMessage && <div className="bg-green-50 text-green-700 p-4 rounded-md mb-6 font-bold">{successMessage}</div>}
              {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 font-bold">{error}</div>}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Mango Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 bg-gray-50 outline-none" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Price (BDT)</label>
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 bg-gray-50 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Image URL</label>
                    <input 
                      type="url" 
                      placeholder="https://i.ibb.co/..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)} 
                      className="w-full px-4 py-3 rounded-md border border-gray-300 bg-gray-50 outline-none" 
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 bg-gray-50 outline-none" rows="3" required></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className={`w-full text-white font-black text-lg py-4 rounded-md uppercase tracking-widest mt-4 transition-colors ${isUploading ? 'bg-gray-400' : 'bg-black hover:bg-orange-500'}`}
                >
                  {isUploading ? 'Saving...' : (editingId ? 'Save Changes' : 'Push to Live Storefront')}
                </button>
              </form>
            </div>

            {/* LIVE INVENTORY COLUMN */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-wider">Live Inventory</h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {liveMangoes.length === 0 ? (
                  <p className="text-gray-500 font-medium">No mangoes currently on the storefront.</p>
                ) : (
                  liveMangoes.map((mango) => (
                    <div key={mango.id} className="border border-gray-100 p-4 rounded-lg flex gap-4 items-center bg-gray-50">
                      <img src={mango.image} alt={mango.name} className="w-16 h-16 object-cover rounded shadow-sm bg-white" onError={(e) => e.target.src = 'https://via.placeholder.com/150'} />
                      <div className="flex-grow">
                        <h3 className="font-bold text-gray-900 leading-tight">{mango.name}</h3>
                        <p className="text-orange-500 font-black">৳{mango.price}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleEditClick(mango)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded font-bold text-xs hover:bg-gray-300 transition-colors uppercase">Edit</button>
                        <button onClick={() => handleDelete(mango.id)} className="bg-red-100 text-red-600 px-3 py-1 rounded font-bold text-xs hover:bg-red-600 hover:text-white transition-colors uppercase">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- LOGGED OUT VIEW ---
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 border-t-8 border-orange-500">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">RESTRICTED ACCESS</h2>
          <p className="text-gray-500 mt-2 font-medium">Vertex Picks Admin Portal</p>
        </div>
        {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 font-bold text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Master Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Passcode</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-md border border-gray-300 outline-none" required />
          </div>
          <button type="submit" className="w-full bg-orange-500 text-white font-black text-lg py-4 rounded-md hover:bg-orange-600 uppercase tracking-widest">
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}