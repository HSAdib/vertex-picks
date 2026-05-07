import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext'; 
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Shop() {
  const [mangoes, setMangoes] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabObj, setActiveTabObj] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { isAdmin } = useAuth();
  const [quantities, setQuantities] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL query
  const queryParams = new URLSearchParams(location.search);
  const tabId = queryParams.get('tabId');

  useEffect(() => {
    const fetchMangoes = async () => {
      try {
        // 1. Fetch NAVBAR_TABS to know which sections belong to this tabId
        let allowedSections = [];
        if (tabId) {
          const navDoc = await getDoc(doc(db, 'mangoes', 'NAVBAR_TABS'));
          if (navDoc.exists() && navDoc.data().list) {
            const activeTab = navDoc.data().list.find(t => t.id === tabId);
            if (activeTab) {
              setActiveTabObj(activeTab);
              if (activeTab.sections) {
                allowedSections = activeTab.sections;
              }
            }
          }
        } else {
          setActiveTabObj(null);
        }

        // 2. Fetch all mangoes and STORE_SECTIONS
        const querySnapshot = await getDocs(collection(db, 'mangoes'));
        const productsArray = [];
        let fetchedSections = [];
        
        querySnapshot.docs.forEach(d => {
          if (d.id === 'STORE_SECTIONS') {
            fetchedSections = d.data().list || [];
          } else if (d.id !== 'NAVBAR_TABS' && d.id !== 'STORE_SETTINGS') {
            productsArray.push({ id: d.id, ...d.data() });
          }
        });

        // Filter sections if a tab is active
        if (tabId && allowedSections.length > 0) {
          fetchedSections = fetchedSections.filter(s => allowedSections.includes(s));
        }

        // Sort products by their manual `order`
        productsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

        setSections(fetchedSections);
        setMangoes(productsArray);
        
        // Reset selected section when tab changes
        setSelectedSection('All');
        setLoading(false);
      } catch (error) {
        console.error("Error fetching shop data: ", error);
        setLoading(false);
      }
    };
    fetchMangoes();
  }, [tabId]);

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
    return (
      <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <div className="h-10 w-72 bg-gray-200 rounded-lg animate-pulse mx-auto mb-4"></div>
            <div className="h-5 w-96 bg-gray-200 rounded animate-pulse mx-auto"></div>
          </div>
          <div className="max-w-4xl mx-auto mb-6">
            <div className="h-14 bg-gray-200 rounded-md animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-md animate-pulse mb-12"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="h-64 bg-gray-200 animate-pulse"></div>
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <div className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
                    <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight sm:text-5xl uppercase">
            {activeTabObj?.heroTitle ? activeTabObj.heroTitle : <>Premium <span className="text-orange-500">Selection</span></>}
          </h1>
          <p className="mt-4 text-lg text-gray-500 font-medium">
            {activeTabObj?.heroSubtitle ? activeTabObj.heroSubtitle : 'Fresh from the orchards of Rajshahi. Hand-picked for excellence.'}
          </p>
        </div>

        {/* AMAZON-STYLE SEARCH BAR */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex w-full h-12 md:h-14 shadow-sm rounded-md overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all">
            {/* Category Dropdown */}
            <select 
              value={selectedSection} 
              onChange={e => setSelectedSection(e.target.value)} 
              className="bg-gray-100 hover:bg-gray-200 px-2 md:px-4 text-xs md:text-sm font-bold border-r border-gray-300 outline-none text-gray-700 cursor-pointer transition-colors max-w-[100px] md:max-w-xs"
            >
              <option value="All">All</option>
              <option value="Uncategorized">Uncategorized</option>
              {sections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
            </select>
            
            {/* Text Input */}
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 outline-none font-medium text-gray-800"
            />
            
            {/* Search Button */}
            <button className="bg-[#febd69] hover:bg-[#f3a847] px-4 md:px-6 flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6 text-gray-900"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </button>
          </div>
        </div>

        {/* FLOATING STORE SECTION NAV BAR */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-[#232F3E]/80 backdrop-blur-lg text-white flex items-center px-6 py-3 gap-6 overflow-x-auto whitespace-nowrap text-sm font-medium rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/20 w-max max-w-[95vw] scrollbar-hide">
          <button 
            onClick={() => setSelectedSection('All')} 
            className={`flex items-center gap-2 hover:text-orange-400 transition-colors ${selectedSection === 'All' ? 'font-black text-orange-500' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            All
          </button>
          {sections.map(sec => (
            <button 
              key={sec} 
              onClick={() => setSelectedSection(sec)} 
              className={`hover:text-orange-400 transition-colors ${selectedSection === sec ? 'font-black text-orange-500' : ''}`}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {mangoes
            .filter(mango => {
              // Only show products belonging to the sections allowed in this Tab
              if (tabId && sections.length > 0 && !sections.includes(mango.section)) {
                return false;
              }
              // Normal section filter
              return selectedSection === 'All' || mango.section === selectedSection || (!mango.section && selectedSection === 'Uncategorized');
            })
            .filter(mango => mango.name?.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((mango) => (
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
                  {mango.section && mango.section !== 'Uncategorized' && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">{mango.section}</span>
                  )}
                  <h2 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-orange-500 transition-colors">{mango.name} ({mango.fixedWeight || 1}kg)</h2>
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