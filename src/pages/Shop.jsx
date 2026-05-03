import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../Firebase';
import { useCart } from '../context/CartContext';

export default function Shop() {
  const { addToCart } = useCart();
  const [mangoes, setMangoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // This fetches the live data from Firebase when the page loads
  useEffect(() => {
    const fetchMangoes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'mangoes'));
        const productsArray = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMangoes(productsArray);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mangoes: ", error);
        setLoading(false);
      }
    };

    fetchMangoes();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-2xl font-black text-gray-800 animate-pulse">Harvesting Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight sm:text-5xl uppercase">
            Premium <span className="text-orange-500">Selection</span>
          </h1>
          <p className="mt-4 text-lg text-gray-500 font-medium">
            Fresh from the orchards of Rajshahi. Hand-picked for excellence.
          </p>
        </div>

        {mangoes.length === 0 ? (
          <div className="text-center text-gray-500 font-bold text-xl">
            Sold out. Check back soon for the next harvest!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {mangoes.map((mango) => (
              <div key={mango.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col">
                {/* Image Placeholder - Uses your public folder images */}
                <div className="h-64 bg-gray-200 relative overflow-hidden">
                  <img 
                    src={mango.image} 
                    alt={mango.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/400x300?text=Mango+Image'; // Fallback if image not found
                    }}
                  />
                </div>
                
                <div className="p-6 flex flex-col flex-grow">
                  <h2 className="text-2xl font-black text-gray-900 mb-2">{mango.name}</h2>
                  <p className="text-gray-600 mb-6 flex-grow">{mango.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <span className="text-2xl font-black text-orange-500">৳{mango.price}</span>
                    <button className="bg-black text-white px-5 py-2.5 rounded font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm">
                      <button 
  onClick={() => addToCart(mango)}
  className="bg-black text-white px-5 py-2.5 rounded font-bold hover:bg-orange-500 transition-colors uppercase tracking-wider text-sm"
>
  Add to Box
</button>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}