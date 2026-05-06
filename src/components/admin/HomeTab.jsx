import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HomeTab() {
  const [storeSections, setStoreSections] = useState([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');

  // --- ANALYTICS STATE ---
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    fetchSections();
    fetchAnalytics();
  }, []);

  const fetchSections = async () => {
    try {
      const docRef = doc(db, 'mangoes', 'STORE_SECTIONS');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setStoreSections(docSnap.data().list || []);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      toast.error("Failed to load sections. Check Firestore rules.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const orderSnap = await getDocs(collection(db, 'orders'));
      const allOrders = orderSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(o => !o.deleted); // Exclude soft-deleted (trashed) orders

      // --- QUICK STATS ---
      const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const totalOrders = allOrders.length;
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const pendingOrders = allOrders.filter(o => o.status === 'Pending').length;

      // --- DAILY REVENUE (LAST 7 DAYS) ---
      const today = new Date();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyRevenue = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        
        const dayTotal = allOrders
          .filter(o => {
            if (!o.createdAt) return false;
            const orderDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
            return orderDate >= dayStart && orderDate < dayEnd;
          })
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        dailyRevenue.push({
          name: `${dayNames[d.getDay()]} ${d.getDate()}`,
          revenue: dayTotal
        });
      }

      // --- TOP SELLING PRODUCTS ---
      const productSales = {};
      allOrders.forEach(o => {
        (o.items || []).forEach(item => {
          const name = item.name || 'Unknown';
          productSales[name] = (productSales[name] || 0) + (item.quantity || 1);
        });
      });
      const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, sales]) => ({ name, sales }));
      
      const maxSales = topProducts.length > 0 ? topProducts[0].sales : 1;

      setAnalytics({ totalRevenue, totalOrders, avgOrderValue, pendingOrders, dailyRevenue, topProducts, maxSales });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const saveSections = async (updatedSections) => {
    await setDoc(doc(db, 'mangoes', 'STORE_SECTIONS'), { list: updatedSections }, { merge: true });
    setStoreSections(updatedSections);
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    if (storeSections.includes(newSectionName.trim())) return toast.error("Section already exists!");
    try {
      await saveSections([...storeSections, newSectionName.trim()]);
      setNewSectionName('');
      toast.success("Section Added!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add section.");
    }
  };

  const handleRemoveSection = async (sec) => {
    try {
      await saveSections(storeSections.filter(s => s !== sec));
      toast.success("Section Removed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove section.");
    }
  };

  const handleRenameSection = async (idx) => {
    if (!editingName.trim()) return;
    if (storeSections.includes(editingName.trim())) return toast.error("That name already exists!");
    try {
      const updated = [...storeSections];
      updated[idx] = editingName.trim();
      await saveSections(updated);
      setEditingIndex(null);
      setEditingName('');
      toast.success("Section Renamed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename section.");
    }
  };

  const moveSection = async (index, direction) => {
    const newSections = [...storeSections];
    if (direction === 'up' && index > 0) {
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    } else {
      return;
    }
    try {
      await saveSections(newSections);
    } catch (err) {
      console.error(err);
      toast.error("Failed to rearrange sections.");
    }
  };

  if (loading) return <div className="text-center p-10 font-black text-gray-500 uppercase tracking-widest">Loading Tools...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      {/* ============ ANALYTICS DASHBOARD ============ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-6 text-gray-900">📊 Analytics Dashboard</h2>

        {analyticsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>)}
          </div>
        ) : analytics ? (
          <>
            {/* QUICK STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-md">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Total Revenue</p>
                <p className="text-2xl font-black mt-1">৳{analytics.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-5 rounded-xl shadow-md">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Total Orders</p>
                <p className="text-2xl font-black mt-1">{analytics.totalOrders}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-md">
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Avg. Order Value</p>
                <p className="text-2xl font-black mt-1">৳{analytics.avgOrderValue}</p>
              </div>
              <div className={`p-5 rounded-xl shadow-md ${analytics.pendingOrders > 0 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 'bg-gradient-to-br from-green-500 to-green-600 text-white'}`}>
                <p className="text-xs font-black uppercase tracking-widest opacity-80">Pending</p>
                <p className="text-2xl font-black mt-1">{analytics.pendingOrders}</p>
              </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* REVENUE CHART */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-600 mb-4">Revenue — Last 7 Days</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', fontWeight: 700, border: '1px solid #e5e7eb' }}
                      formatter={(value) => [`৳${value}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* TOP PRODUCTS LEADERBOARD */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-600 mb-4">Top Selling Products</h3>
                {analytics.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topProducts.map((p, idx) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-orange-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-gray-800 truncate">{p.name}</p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-orange-500 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${(p.sales / analytics.maxSales) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="font-black text-sm text-gray-600 shrink-0">{p.sales} sold</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 font-bold text-sm">No sales data yet.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-400 font-bold">Failed to load analytics.</p>
        )}
      </div>

      {/* ============ MANAGE STORE SECTIONS ============ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-black uppercase text-xl mb-4 text-gray-900">Manage Store Sections</h2>
        <p className="text-sm text-gray-500 font-bold mb-6">Create, delete, rename, and arrange the order of your shop's categories. The order here determines the layout of your Shop's navigation bar.</p>
        
        <form onSubmit={handleAddSection} className="flex gap-2 mb-8">
          <input type="text" placeholder="New Section Name (e.g. Sweets)" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} className="p-3 bg-gray-50 border rounded font-bold outline-none flex-grow" />
          <button type="submit" className="bg-black text-white font-black px-6 py-3 rounded uppercase text-sm hover:bg-orange-500 transition-colors">Add</button>
        </form>

        {storeSections.length > 0 ? (
          <div className="space-y-3">
            {storeSections.map((sec, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border border-gray-200 shadow-sm gap-3">
                {editingIndex === idx ? (
                  <div className="flex items-center gap-2 flex-grow">
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={e => setEditingName(e.target.value)} 
                      className="p-2 bg-white border-2 border-orange-400 rounded font-bold outline-none flex-grow"
                      autoFocus
                    />
                    <button onClick={() => handleRenameSection(idx)} className="bg-orange-500 text-white px-4 py-2 rounded font-black text-xs uppercase hover:bg-orange-600 transition-colors">Save</button>
                    <button onClick={() => { setEditingIndex(null); setEditingName(''); }} className="bg-gray-200 text-gray-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-gray-300 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <span className="font-black text-lg text-gray-800">{sec}</span>
                )}

                {editingIndex !== idx && (
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    <div className="flex gap-1 bg-white border border-gray-200 rounded overflow-hidden">
                      <button 
                        onClick={() => moveSection(idx, 'up')} 
                        disabled={idx === 0}
                        className={`px-3 py-2 ${idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-black'} transition-colors font-bold border-r border-gray-200`}
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => moveSection(idx, 'down')} 
                        disabled={idx === storeSections.length - 1}
                        className={`px-3 py-2 ${idx === storeSections.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-black'} transition-colors font-bold`}
                      >
                        ▼
                      </button>
                    </div>
                    <button onClick={() => { setEditingIndex(idx); setEditingName(sec); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-blue-500 hover:text-white transition-colors border border-blue-100 shadow-sm">Edit</button>
                    <button onClick={() => handleRemoveSection(sec)} className="bg-red-50 text-red-600 px-4 py-2 rounded font-black text-xs uppercase hover:bg-red-500 hover:text-white transition-colors border border-red-100 shadow-sm">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 font-bold">
            <p className="text-lg">No sections yet.</p>
            <p className="text-sm mt-1">Use the input above to create your first store section!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
