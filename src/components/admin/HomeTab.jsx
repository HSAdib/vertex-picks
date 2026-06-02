import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HomeTab() {
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21 });
  const [configSaving, setConfigSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- ANALYTICS STATE ---
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const configRef = doc(db, 'mangoes', 'STORE_SETTINGS');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        setStoreConfig({
          baseDeliveryFee: configSnap.data().baseDeliveryFee ?? 110,
          perKgFee: configSnap.data().perKgFee ?? 21
        });
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
      toast.error("Failed to load settings.");
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

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchConfig();
      fetchAnalytics();
    });
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), storeConfig, { merge: true });
      toast.success("Delivery Configuration Saved!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save configuration.");
    }
    setConfigSaving(false);
  };

  if (loading) return <div className="text-center p-10 font-black text-gray-500 uppercase tracking-widest">Loading Tools...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* ============ QUICK STATS ROW ============ */}
      {analyticsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>)}
        </div>
      ) : analytics ? (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <div className="as-icon orange">📊</div>
              <div>
                <div className="as-label">Total Revenue</div>
                <div className="as-val">৳{analytics.totalRevenue.toLocaleString()}</div>
                <div className="as-trend up">↑ 12% vs last month</div>
              </div>
            </div>

            <div className="admin-stat">
              <div className="as-icon green">📦</div>
              <div>
                <div className="as-label">Total Orders</div>
                <div className="as-val">{analytics.totalOrders}</div>
                <div className="as-trend up">↑ 8% vs last week</div>
              </div>
            </div>

            <div className="admin-stat">
              <div className="as-icon blue">👥</div>
              <div>
                <div className="as-label">Avg Order Value</div>
                <div className="as-val">৳{analytics.avgOrderValue.toLocaleString()}</div>
                <div className="as-trend up">↑ 4% this month</div>
              </div>
            </div>

            <div className="admin-stat">
              <div className="as-icon purple">⏳</div>
              <div>
                <div className="as-label">Pending Orders</div>
                <div className="as-val">{analytics.pendingOrders}</div>
                <div className={`as-trend ${analytics.pendingOrders > 0 ? 'down' : 'up'}`}>
                  {analytics.pendingOrders > 0 ? '↓ Action required' : '↑ Backlog clear'}
                </div>
              </div>
            </div>
          </div>

          {/* ============ CHARTS ROW ============ */}
          <div className="admin-charts-row">
            {/* REVENUE CHART */}
            <div className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h3 className="ach-title">📈 Revenue Analysis</h3>
                  <span className="ach-sub">Last 7 days dynamic billing</span>
                </div>
              </div>
              <div className="p-6 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', fontWeight: 700, border: '1px solid #e5e7eb', fontSize: '11px' }}
                      formatter={(value) => [`৳${value}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#E8540A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TOP PRODUCTS LEADERBOARD */}
            <div className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h3 className="ach-title">🏆 Top Selling Products</h3>
                  <span className="ach-sub">Product demand index</span>
                </div>
              </div>
              <div className="p-6">
                {analytics.topProducts.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topProducts.map((p, idx) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-primary text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-xs text-gray-800 truncate">{p.name}</p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                              style={{ width: `${(p.sales / analytics.maxSales) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="font-black text-xs text-gray-500 shrink-0">{p.sales} sold</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 font-bold text-xs">No sales data yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-400 font-bold">Failed to load analytics.</p>
      )}

      {/* ============ DELIVERY CONFIG ============ */}
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <h3 className="ach-title">🚚 Delivery Configuration</h3>
            <span className="ach-sub">Set standard baseline and weight parameters</span>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Base Delivery Fee (৳)</label>
              <input 
                type="number" 
                value={storeConfig.baseDeliveryFee} 
                onChange={e => setStoreConfig({...storeConfig, baseDeliveryFee: Number(e.target.value)})} 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded font-bold outline-none focus:border-orange-500 text-sm" 
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Additional Fee Per Kg (৳)</label>
              <input 
                type="number" 
                value={storeConfig.perKgFee} 
                onChange={e => setStoreConfig({...storeConfig, perKgFee: Number(e.target.value)})} 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded font-bold outline-none focus:border-orange-500 text-sm" 
                min="0"
              />
            </div>
            <div className="md:col-span-2 mt-2">
              <button type="submit" disabled={configSaving} className="w-full bg-black text-white font-black py-4 rounded uppercase text-xs tracking-widest hover:bg-primary transition-colors disabled:opacity-50">
                {configSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
