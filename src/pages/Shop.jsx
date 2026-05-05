import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; // Added auth
import { onAuthStateChanged } from 'firebase/auth'; // Added to check who is viewing
import { useCart } from '../context/CartContext'; 
import { Link, useNavigate } from 'react-router-dom';

export default function Shop() {
  const [mangoes, setMangoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const [quantities, setQuantities] = useState({});
  const navigate = useNavigate();

  // GOD MODE STATE
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_EMAIL = 'hasanshahriaradib@gmail.com';

  useEffect(() => {
    // Check if God Mode should be active
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    });

    const fetchMangoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'mangoes'));
        const productsArray = querySnapshot.docs.map(doc => ({
          id: doc.id, ...doc.data()
        }));
        setMangoes(productsArray);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mangoes: ", error);
        setLoading(false);
      }
    };
    fetchMangoes();
    
    return () => unsubscribe();
  }, []);

  const updateQty = (id, amount) => {
    setQuantities(prev => {
      const currentQty = prev[id] || 1;
      const newQty = Math.max(1, currentQty + amount);
      return { ...prev, [id]: newQty };
    });
  };

  const handleAddToCart = (mango) => {
    const qtyToAdd = quantities[mango.id] || 1;
    addToCart(mango.id, qtyToAdd); 
    setQuantities(prev => ({ ...prev, [mango.id]: 1 }));
  };

  // GOD MODE TELEPORT
  const handleGodModeEdit = (e, id) => {
    e.preventDefault(); // Stops the Link from clicking
    localStorage.setItem('teleportEditId', id); // Save the ID to memory
    navigate('/admin'); // Warp to Admin!
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-2xl font-black text-gray-800 animate-pulse uppercase tracking-widest">Harvesting Data...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight sm:text-5xl uppercase">Premium <span className="text-orange-500">Selection</span></h1>
          <p className="mt-4 text-lg text-gray-500 font-medium">Fresh from the orchards of Rajshahi. Hand-picked for excellence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {mangoes.map((mango) => (
            <div key={mango.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col relative">
              
              {/* GOD MODE BUTTON */}
              {isAdmin && (
                <button 
                  onClick={(e) => handleGodModeEdit(e, mango.id)}
                  className="absolute top-4 right-4 z-20 bg-black text-white px-3 py-1 rounded font-black text-xs uppercase tracking-widest hover:bg-orange-500 shadow-lg border border-gray-800"
                >
                  ⚡ Quick Edit
                </button>
              )}

              {/* DISPLAY DISCOUNT BADGE */}
              {mango.discountPercent && (
                <div className="absolute top-4 left-4 bg-orange-500 text-white px-3 py-1 rounded-full font-black text-xs z-10 animate-bounce">
                  {mango.discountPercent}% OFF
                </div>
              )}

              <Link to={`/product/${mango.id}`} className="block cursor-pointer group">
                <div className="h-64 bg-gray-200 relative overflow-hidden">
                  <img src={mango.images && mango.images.length > 0 ? mango.images[0] : mango.image} alt={mango.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                
                <div className="p-6 pb-2 flex flex-col">
                  <h2 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-orange-500 transition-colors">{mango.name}</h2>
                  {mango.stats && (
                    <div className="flex items-center gap-3 text-xs font-bold text-gray-500 mb-3">
                      <span className="flex items-center gap-1 text-yellow-500">
                        ★ {mango.stats.rating || '5.0'}
                      </span>
                      <span>({mango.stats.reviewCount || 0} reviews)</span>
                      <span>•</span>
                      <span className="text-orange-500">{mango.stats.sales || 0}+ Sold</span>
                    </div>
                  )}
                  <p className="text-gray-600 mb-2 line-clamp-2">{mango.description}</p>
                </div>
              </Link>
              
              <div className="px-6 pb-6 flex flex-col flex-grow">
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                  <div className="flex flex-col">
                    {mango.discountPrice ? (
                      <>
                        <span className="text-sm text-gray-400 line-through font-bold">৳{mango.price}</span>
                        <span className="text-2xl font-black text-orange-500">৳{mango.discountPrice}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-black text-orange-500">৳{mango.price}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-300 rounded">
                      <button onClick={() => updateQty(mango.id, -1)} className="px-3 py-1 text-gray-600 hover:bg-gray-100 font-bold">-</button>
                      <span className="px-3 py-1 font-bold text-sm border-l border-r border-gray-300 w-8 text-center">{quantities[mango.id] || 1}</span>
                      <button onClick={() => updateQty(mango.id, 1)} className="px-3 py-1 text-gray-600 hover:bg-gray-100 font-bold">+</button>
                    </div>
                    <button onClick={() => handleAddToCart(mango)} className="bg-black text-white px-4 py-1.5 rounded font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm">Add</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}