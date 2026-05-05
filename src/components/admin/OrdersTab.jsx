import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { isValidBDPhoneNumber } from '../../utils/phoneValidation';

export default function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // --- ORDERS EXPANSION & MANUAL ORDER STATE ---
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [mName, setMName] = useState(''); const [mPhone, setMPhone] = useState('');
  const [mItem, setMItem] = useState(''); const [mCharged, setMCharged] = useState('');
  const [mCost, setMCost] = useState('');
  const [phoneError, setPhoneError] = useState(false);

  // --- MODALS STATE ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });
  const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', placeholder: '', value: '', action: null });

  const fetchOrders = async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoadingOrders(true);

      let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(20));
      
      if (isLoadMore && lastVisible) {
        q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(20));
      }

      const orderSnap = await getDocs(q);
      const fetchedOrders = orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (orderSnap.docs.length > 0) {
        setLastVisible(orderSnap.docs[orderSnap.docs.length - 1]);
      }
      
      if (fetchedOrders.length < 20) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (isLoadMore) {
        setOrders(prev => [...prev, ...fetchedOrders]);
      } else {
        setOrders(fetchedOrders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoadingOrders(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    await updateDoc(doc(db, 'orders', id), { status: newStatus });
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const executeAddTracking = async (id, url) => {
    if (url) {
      await updateDoc(doc(db, 'orders', id), { trackingLink: url });
      setOrders(orders.map(o => o.id === id ? { ...o, trackingLink: url } : o));
    }
  };

  const handleAddTracking = (id) => {
    setPromptModal({
      isOpen: true,
      title: "Add Tracking Link",
      placeholder: "e.g. Pathao/Steadfast URL",
      value: "",
      action: (url) => executeAddTracking(id, url)
    });
  };

  const executeDeleteOrder = async (id) => {
    await deleteDoc(doc(db, 'orders', id)); 
    setOrders(orders.filter(o => o.id !== id));
  };

  const handleDeleteOrder = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Order',
      message: 'Are you sure you want to completely delete this order? This action cannot be undone.',
      action: () => executeDeleteOrder(id)
    });
  };

  const createWhatsAppLink = (phone, total, address) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    const message = `হ্যালো, Vertex Picks থেকে বলছি! আপনার ${total} টাকার অর্ডারটি কনফার্ম করার জন্য মেসেজ দিচ্ছি। আপনার ডেলিভারি ঠিকানা: ${address}। অর্ডারটি কি কনফার্ম করব?`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleManualOrderSubmit = async (e) => {
    e.preventDefault();
    if (!isValidBDPhoneNumber(mPhone)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      alert("Please enter a valid Bangladeshi phone number");
      return;
    }
    const profit = Number(mCharged) - Number(mCost);
    await addDoc(collection(db, 'orders'), {
      isManual: true,
      customerName: mName,
      deliveryPhone: mPhone,
      items: [{ name: mItem, quantity: 1, price: Number(mCharged) }],
      total: Number(mCharged),
      cost: Number(mCost),
      profit: profit,
      status: 'Done',
      createdAt: new Date()
    });
    setShowManualModal(false); setMName(''); setMPhone(''); setMItem(''); setMCharged(''); setMCost('');
    fetchOrders(); // Refresh to show new order
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* MANUAL ORDER MODAL */}
      <AnimatePresence>
      {showManualModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-xl font-black uppercase text-gray-900 mb-6">Create Offline Order</h3>
            <form onSubmit={handleManualOrderSubmit} className="space-y-4">
              <input type="text" placeholder="Customer Name" value={mName} onChange={e => setMName(e.target.value)} required className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />
              <input type="text" placeholder="Phone Number" value={mPhone} onChange={e => setMPhone(e.target.value)} required className={`w-full p-3 border rounded font-bold outline-none transition-colors duration-300 ${phoneError ? 'bg-red-50 border-red-500 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-50'}`} />
              <input type="text" placeholder="Item/Box Name" value={mItem} onChange={e => setMItem(e.target.value)} required className="w-full p-3 bg-gray-50 border rounded font-bold outline-none" />
              <div className="flex gap-2">
                <input type="number" placeholder="Amt Charged" value={mCharged} onChange={e => setMCharged(e.target.value)} required className="w-full p-3 bg-green-50 border border-green-200 text-green-700 rounded font-bold outline-none" />
                <input type="number" placeholder="True Cost" value={mCost} onChange={e => setMCost(e.target.value)} required className="w-full p-3 bg-red-50 border border-red-200 text-red-700 rounded font-bold outline-none" />
              </div>
              {mCharged && mCost && (
                <p className="text-center font-black text-sm uppercase text-blue-600 bg-blue-50 py-2 rounded border border-blue-200">
                  Calculated Profit: ৳{Number(mCharged) - Number(mCost)}
                </p>
              )}
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 bg-black text-white font-black py-3 rounded uppercase text-sm hover:bg-orange-500">Save Sale</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="font-black uppercase text-xl">Order Management</h2>
          <p className="text-gray-500 font-bold text-sm">Showing Latest Orders</p>
        </div>
        <button onClick={() => setShowManualModal(true)} className="bg-orange-500 text-white font-black px-6 py-3 rounded hover:bg-black uppercase text-sm tracking-widest shadow-md">
          + Add Offline Sale
        </button>
      </div>

      {loadingOrders ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed font-bold text-gray-400">Loading Orders...</div>
      ) : (!orders || orders.length === 0) ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed font-bold text-gray-400">No active orders.</div>
      ) : (
        <div className="space-y-4">
        {orders.map(order => (
          <div key={order.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${order.status === 'Cancelled' ? 'border-red-300' : 'border-gray-200'}`}>

            {/* CANCELLATION BANNER */}
            {order.status === 'Cancelled' && (
              <div className="bg-red-500 text-white font-black text-xs uppercase tracking-widest py-1.5 px-6">
                Order Cancelled • Reason: {order.cancelReason || 'Not specified'}
              </div>
            )}

            {/* MAIN ROW */}
            <div
              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-gray-50 transition-colors ${order.isManual ? 'bg-blue-50' : ''}`}
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">ID: {order.id?.slice(-6) || 'N/A'}</p>
                  {order.isManual && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">Offline Sale</span>}
                </div>
                <h3 className="text-xl font-black text-gray-900">{order.customerName || order.customerEmail || 'Unknown Customer'}</h3>
                <p className="text-gray-500 font-bold text-sm">
                  {order.isManual ? (
                    <span className="text-green-600 font-black">Profit: ৳{order.profit || 0}</span>
                  ) : (
                    `Total: ৳${order.total || 0}`
                  )}
                  <span className="mx-2">•</span>
                  Status: <span className={`${order.status === 'Done' ? 'text-green-500' : order.status === 'Cancelled' ? 'text-red-500' : 'text-orange-500'}`}>{order.status || 'Pending'}</span>
                </p>
              </div>
              <div className="text-gray-400 font-black mt-4 md:mt-0">
                {expandedOrder === order.id ? '▲ CLOSE' : '▼ VIEW DETAILS'}
              </div>
            </div>

            {/* EXPANDED DETAILS WITH FRAMER MOTION */}
            <AnimatePresence>
            {expandedOrder === order.id && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-gray-50 p-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Delivery Info</h4>
                      <p className="font-bold text-gray-800">Phone: <span className="text-blue-600">{order.deliveryPhone || 'N/A'}</span></p>
                      <p className="font-bold text-gray-800 mt-1">Address: {order.deliveryAddress || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Items Ordered</h4>
                      <ul className="space-y-1">
                        {order.items?.map((item, idx) => (
                          <li key={idx} className="font-bold text-gray-800 text-sm">
                            {item.quantity || 1}x {item.name || 'Unnamed Item'} {item.weight ? `(${item.weight}kg)` : ''}
                          </li>
                        ))}
                      </ul>
                      {!order.isManual && (
                        <div className="mt-2 text-xs font-bold text-gray-500">
                          Promo Used: <span className="text-orange-500">{order.promoUsed || 'None'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                    {order.deliveryPhone && order.status !== 'Cancelled' && (
                      <a
                        href={createWhatsAppLink(order.deliveryPhone, order.total, order.deliveryAddress)}
                        target="_blank" rel="noreferrer"
                        className="bg-[#25D366] text-white font-black px-4 py-2 rounded text-xs uppercase tracking-widest shadow-sm hover:bg-[#128C7E] flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.299 1.263.478 1.694.611.712.22 1.36.189 1.872.114.576-.084 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                        Send WA Confirm
                      </a>
                    )}
                    {order.status !== 'Done' && order.status !== 'Cancelled' && (
                      <button onClick={() => handleUpdateStatus(order.id, 'Done')} className="bg-black text-white font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-orange-500">
                        Mark as Done
                      </button>
                    )}
                    {order.status !== 'Cancelled' && (
                      <button onClick={() => handleAddTracking(order.id)} className={`font-black px-4 py-2 rounded text-xs uppercase tracking-widest transition-colors ${order.trackingLink ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {order.trackingLink ? 'Edit Tracking' : '+ Add Tracking'}
                      </button>
                    )}
                    {order.trackingLink && (
                       <a href={order.trackingLink?.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 underline self-center">View Link</a>
                    )}
                    <button onClick={() => handleDeleteOrder(order.id)} className="bg-red-100 text-red-600 font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white ml-auto">
                      Delete Record
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        ))}
        </div>
      )}

      {hasMore && orders.length > 0 && !loadingOrders && (
        <button 
          onClick={() => fetchOrders(true)} 
          disabled={loadingMore}
          className="w-full mt-6 bg-gray-200 text-black font-black py-4 rounded-xl uppercase tracking-widest hover:bg-gray-300 disabled:opacity-50 transition-all"
        >
          {loadingMore ? 'Loading...' : 'Load More Orders'}
        </button>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 bg-red-600 text-white font-black py-3 rounded uppercase text-sm hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* PROMPT MODAL */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black uppercase text-gray-900 mb-4">{promptModal.title}</h3>
            <input 
              type="text" 
              placeholder={promptModal.placeholder}
              value={promptModal.value}
              onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
              className="w-full p-3 border rounded font-bold outline-none focus:border-orange-500 mb-6"
              autoFocus
            />
            <div className="flex gap-4">
              <button onClick={() => setPromptModal({ ...promptModal, isOpen: false })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300">Cancel</button>
              <button onClick={() => { promptModal.action(promptModal.value); setPromptModal({ ...promptModal, isOpen: false }); }} className="flex-1 bg-blue-600 text-white font-black py-3 rounded uppercase text-sm hover:bg-blue-700">Submit</button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
