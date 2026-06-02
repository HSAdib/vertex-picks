import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

function getCouponStatus(expiryDateStr) {
  if (!expiryDateStr) return 'active';
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  
  if (expiry < today) {
    return 'expired';
  } else if (expiry.getTime() === today.getTime()) {
    return 'active';
  } else {
    // If it's in the future and doesn't have a start date, it is active
    return 'active';
  }
}

export default function PromosTab() {
  const [promos, setPromos] = useState([]);
  const [newPromoCode, setNewPromoCode] = useState(''); 
  const [newDiscountType, setNewDiscountType] = useState('percentage');
  const [newDiscountValue, setNewDiscountValue] = useState('');
  const [newMinOrderValue, setNewMinOrderValue] = useState('0');
  const [newUsageLimit, setNewUsageLimit] = useState('100');
  const [newPromoExpiry, setNewPromoExpiry] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const promoSnap = await getDocs(collection(db, 'promos'));
      setPromos(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching promos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchPromos();
    });
  }, []);

  const handleAddPromo = async (e) => { 
    e.preventDefault(); 
    const code = newPromoCode.trim().toUpperCase();
    const discountType = newDiscountType;
    const discountValue = Number(newDiscountValue);
    const minOrderValue = Number(newMinOrderValue) || 0;
    const usageLimit = Number(newUsageLimit) || 100;
    const expiryDate = newPromoExpiry || '';
    
    // Determine initial status based on date
    const calculatedStatus = getCouponStatus(expiryDate);

    try {
      await addDoc(collection(db, 'promos'), { 
        code, 
        discountType,
        discountValue,
        minOrderValue,
        usageLimit,
        usedCount: 0,
        // Maintain backward compatibility for standard percentages
        discountPercent: discountType === 'percentage' ? discountValue : 0, 
        expiryDate,
        status: calculatedStatus,
        createdAt: new Date() 
      }); 
      setNewPromoCode(''); 
      setNewDiscountType('percentage');
      setNewDiscountValue('');
      setNewMinOrderValue('0');
      setNewUsageLimit('100');
      setNewPromoExpiry('');
      setShowCreateForm(false);
      fetchPromos(); 
      toast.success("Promo Coupon created successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create coupon code");
    }
  };

  const handleDeletePromo = async (id) => { 
    if (!window.confirm("Permanently delete this promo code?")) return;
    try {
      await deleteDoc(doc(db, 'promos', id)); 
      fetchPromos(); 
      toast.success("Coupon code deleted");
    } catch {
      toast.error("Failed to delete coupon code");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 select-none"
    >
      {/* ============ ADMIN CARD WRAPPER ============ */}
      <div className="admin-card">
        {/* HEADER SECTION WITH CREATE BUTTON */}
        <div className="admin-action-bar">
          <div className="aab-left">
            <h3 className="ach-title">🎫 Promotional Coupon Manager</h3>
            <span className="ach-sub">Create, schedule, and validate active discount campaigns</span>
          </div>
          <div className="aab-right">
            <button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="add-btn cursor-pointer"
            >
              {showCreateForm ? 'Cancel Creation' : '+ Create Coupon'}
            </button>
          </div>
        </div>

        {/* CREATE NEW COUPON FORM INLINE */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-gray2 bg-gray1/50 overflow-hidden"
            >
              <div className="p-6">
                <form onSubmit={handleAddPromo} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">Coupon Code (Uppercase)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. VIPCOUPON" 
                        required 
                        value={newPromoCode} 
                        onChange={e => setNewPromoCode(e.target.value)} 
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary uppercase shadow-sm" 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">Discount Type</label>
                      <select 
                        value={newDiscountType} 
                        onChange={e => setNewDiscountType(e.target.value)}
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm cursor-pointer"
                      >
                        <option value="percentage">Percentage Discount (%)</option>
                        <option value="flat">Flat Amount Discount (৳)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">
                        {newDiscountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Flat Value (৳)'}
                      </label>
                      <input 
                        type="number" 
                        placeholder={newDiscountType === 'percentage' ? 'e.g. 15' : 'e.g. 100'} 
                        required 
                        min="1"
                        value={newDiscountValue} 
                        onChange={e => setNewDiscountValue(e.target.value)} 
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">Minimum Order Amount (৳)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 1000" 
                        required 
                        min="0"
                        value={newMinOrderValue} 
                        onChange={e => setNewMinOrderValue(e.target.value)} 
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">Maximum Usage Limit (uses)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 100" 
                        required 
                        min="1"
                        value={newUsageLimit} 
                        onChange={e => setNewUsageLimit(e.target.value)} 
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray4 mb-1.5">Expiration Date (Optional)</label>
                      <input 
                        type="date" 
                        value={newPromoExpiry} 
                        onChange={e => setNewPromoExpiry(e.target.value)} 
                        className="w-full p-3 bg-white border border-gray2 rounded font-bold text-xs outline-none focus:border-primary shadow-sm cursor-pointer" 
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <button type="submit" className="add-btn text-xs uppercase shadow-sm px-8 py-3 cursor-pointer">
                      Publish Coupon 🚀
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE COUPONS TABLE LOGS */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-20 border-2 border-dashed border-gray2 rounded-brand font-bold text-gray4 text-xs animate-pulse">
              Loading promos...
            </div>
          ) : (!promos || promos.length === 0) ? (
            <div className="text-center py-20 border-2 border-dashed border-gray2 rounded-brand font-bold text-gray4 text-xs">
              No active coupons. Create one above!
            </div>
          ) : (
            <div className="coupon-table-wrap overflow-x-auto w-full">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Coupon Code</th>
                    <th>Discount value</th>
                    <th>Minimum Order</th>
                    <th>Usage limit</th>
                    <th>Expiration date</th>
                    <th>Status Badge</th>
                    <th>Date Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map(promo => {
                    const status = promo.status || getCouponStatus(promo.expiryDate);
                    const formattedExpiry = promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : 'No Expiry (Lifetime)';
                    const formattedCreated = promo.createdAt?.toDate ? promo.createdAt.toDate().toLocaleDateString() : new Date(promo.createdAt).toLocaleDateString();
                    
                    return (
                      <tr key={promo.id}>
                        <td>
                          <span className="font-bold text-sm text-primary uppercase tracking-wider bg-primary-pale border border-primary/20 px-2.5 py-1 rounded">
                            {promo.code || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="font-bold text-sm text-gray-800">
                          {promo.discountType === 'flat' ? `Flat ৳${promo.discountValue} OFF` : `${promo.discountValue || promo.discountPercent || 0}% OFF`}
                        </td>
                        <td className="font-bold text-xs text-gray-700">
                          ৳{promo.minOrderValue || 0}
                        </td>
                        <td className="font-bold text-xs text-gray-700 font-mono">
                          {promo.usedCount || 0} / {promo.usageLimit || '∞'}
                        </td>
                        <td className="font-medium text-xs text-gray-700">
                          {formattedExpiry}
                        </td>
                        <td>
                          <span className={`coupon-status ${
                            status === 'expired' ? 'cs-expired' :
                            status === 'active' ? 'cs-active' :
                            'cs-scheduled'
                          }`}>
                            {status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Scheduled'}
                          </span>
                        </td>
                        <td className="font-medium text-xs text-gray4">
                          {formattedCreated}
                        </td>
                        <td>
                          <div className="at-actions">
                            <button 
                              type="button"
                              onClick={() => handleDeletePromo(promo.id)}
                              className="at-action-btn danger text-red"
                              title="Delete Promo Code"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
