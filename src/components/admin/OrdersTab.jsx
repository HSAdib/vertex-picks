import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { isValidBDPhoneNumber } from '../../utils/phoneValidation';
import { toast } from 'react-hot-toast';

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
  const [editAddressModal, setEditAddressModal] = useState({ isOpen: false, orderId: null, address: '' });
  const [editFinancialsModal, setEditFinancialsModal] = useState({ isOpen: false, orderId: null, total: '', deliveryFee: '' });

  // --- BATCH SELECTION STATE ---
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);

  // --- TRASH VIEW STATE ---
  const [showTrash, setShowTrash] = useState(false);

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

  const executeSoftDelete = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: true, deletedAt: new Date() });
    setOrders(orders.map(o => o.id === id ? { ...o, deleted: true, deletedAt: new Date() } : o));
    toast.success('Order moved to Trash');
  };

  const handleDeleteOrder = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Move to Trash',
      message: 'This order will be moved to the trash bin. You can restore it later or permanently delete it.',
      action: () => executeSoftDelete(id)
    });
  };

  const handleRestoreOrder = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: false, deletedAt: null });
    setOrders(orders.map(o => o.id === id ? { ...o, deleted: false, deletedAt: null } : o));
    toast.success('Order restored!');
  };

  const executePermanentDelete = async (id) => {
    await deleteDoc(doc(db, 'orders', id));
    setOrders(orders.filter(o => o.id !== id));
    toast.success('Order permanently deleted');
  };

  const handlePermanentDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete',
      message: 'This will PERMANENTLY erase this order from the database. This cannot be undone!',
      action: () => executePermanentDelete(id)
    });
  };

  const createWhatsAppLink = (phone, total, address) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    const message = `হ্যালো, Vertex Picks থেকে বলছি! আপনার ${total} টাকার অর্ডারটি কনফার্ম করার জন্য মেসেজ দিচ্ছি। আপনার ডেলিভারি ঠিকানা: ${address}। অর্ডারটি কি কনফার্ম করব?`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // --- CSV EXPORT ---
  const handleExportCSV = () => {
    const activeOrders = orders.filter(o => !o.deleted);
    if (!activeOrders || activeOrders.length === 0) return;
    const headers = ['Order ID', 'Customer Name', 'Phone', 'Address', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Status', 'Date'];
    const rows = activeOrders.map(o => [
      o.id,
      o.customerName || o.customerEmail || 'Unknown',
      o.deliveryPhone || o.customerPhone || 'N/A',
      `"${(o.deliveryAddress || 'N/A').replace(/"/g, '""')}"`,
      `"${(o.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ')}"`,
      o.subtotal || 0,
      o.deliveryFee || 0,
      o.total || 0,
      o.status || 'Pending',
      o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'N/A'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  // --- BATCH SELECTION HELPERS ---
  const toggleSelectOrder = (id) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const handleBatchStatus = async (newStatus) => {
    if (selectedOrders.size === 0) return;
    setBatchUpdating(true);
    try {
      await Promise.all(
        [...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { status: newStatus }))
      );
      setOrders(orders.map(o => selectedOrders.has(o.id) ? { ...o, status: newStatus } : o));
      toast.success(`${selectedOrders.size} order(s) marked as ${newStatus}`);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Batch update failed.');
    }
    setBatchUpdating(false);
  };

  const handleBatchDelete = async () => {
    if (selectedOrders.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedOrders.size} order(s)?`)) return;
    
    setBatchUpdating(true);
    try {
      await Promise.all(
        [...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { deleted: true }))
      );
      setOrders(orders.map(o => selectedOrders.has(o.id) ? { ...o, deleted: true } : o));
      toast.success(`${selectedOrders.size} order(s) moved to trash.`);
      setSelectedOrders(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Batch delete failed.');
    }
    setBatchUpdating(false);
  };

  const handleUpdateAddress = async () => {
    if (!editAddressModal.address.trim()) return;
    try {
      await updateDoc(doc(db, 'orders', editAddressModal.orderId), {
        deliveryAddress: editAddressModal.address
      });
      setOrders(orders.map(o => o.id === editAddressModal.orderId ? { ...o, deliveryAddress: editAddressModal.address } : o));
      toast.success("Delivery address updated!");
      setEditAddressModal({ isOpen: false, orderId: null, address: '' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update address");
    }
  };

  const handleUpdateFinancials = async () => {
    if (editFinancialsModal.total === '' || editFinancialsModal.deliveryFee === '') return;
    try {
      const newTotal = Number(editFinancialsModal.total);
      const newDeliveryFee = Number(editFinancialsModal.deliveryFee);
      await updateDoc(doc(db, 'orders', editFinancialsModal.orderId), {
        total: newTotal,
        deliveryFee: newDeliveryFee
      });
      setOrders(orders.map(o => o.id === editFinancialsModal.orderId ? { ...o, total: newTotal, deliveryFee: newDeliveryFee } : o));
      toast.success("Financials updated!");
      setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update financials");
    }
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

  const displayOrders = orders.filter(o => showTrash ? o.deleted : !o.deleted);

  const handlePrintSingleOrder = (orderId) => {
    const prev = new Set(selectedOrders);
    setSelectedOrders(new Set([orderId]));
    setTimeout(() => {
      window.print();
      setSelectedOrders(prev);
    }, 150);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <style>{`
        @media print {
          @page { margin: 0; }
          body { background: white; }
        }
      `}</style>
      <div className="print:hidden space-y-6">
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div>
          <h2 className="font-black uppercase text-xl">{showTrash ? '🗑️ Trash Bin' : 'Order Management'}</h2>
          <p className="text-gray-500 font-bold text-sm">
            {showTrash ? 'Restore or permanently delete trashed orders.' : `Showing Latest Orders (${orders.filter(o => !o.deleted).length} active)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {showTrash ? (
            <button 
              onClick={() => { setShowTrash(false); setSelectedOrders(new Set()); setExpandedOrder(null); }}
              className="bg-gray-800 text-white font-black px-5 py-3 rounded uppercase text-sm tracking-widest shadow-md hover:bg-gray-700"
            >
              ← Back to Orders
            </button>
          ) : (
            <>
              <button onClick={() => window.print()} disabled={displayOrders.length === 0} className="bg-blue-600 text-white font-black px-5 py-3 rounded hover:bg-blue-700 uppercase text-sm tracking-widest shadow-md disabled:opacity-40 flex items-center gap-2">
                🖨️ Print Labels
              </button>
              <button onClick={handleExportCSV} disabled={orders.filter(o => !o.deleted).length === 0} className="bg-green-600 text-white font-black px-5 py-3 rounded hover:bg-green-700 uppercase text-sm tracking-widest shadow-md disabled:opacity-40 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export CSV
              </button>
              <button onClick={() => setShowManualModal(true)} className="bg-orange-500 text-white font-black px-5 py-3 rounded hover:bg-black uppercase text-sm tracking-widest shadow-md">
                + Add Offline Sale
              </button>
              <button
                onClick={() => { setShowTrash(true); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                className="relative bg-gray-100 border border-gray-200 rounded px-5 py-3 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white hover:border-gray-300 hover:drop-shadow-[0_0_15px_rgba(192,192,192,1)] transition-all shadow-md"
                title="Open Trash Bin"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8v12a2 2 0 002 2h10a2 2 0 002-2V8m-9 4v6m4-6v6M6 4l12-2M9 2l4-.67" /></svg>
                {orders.filter(o => o.deleted).length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                    {orders.filter(o => o.deleted).length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* BATCH ACTION BAR */}
      <AnimatePresence>
        {selectedOrders.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white rounded-full px-6 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 sm:gap-6 border border-gray-700 w-max max-w-[95vw] overflow-x-auto scrollbar-hide"
          >
            <span className="font-black text-sm uppercase tracking-widest bg-orange-500 text-white px-3 py-1 rounded-full shrink-0 shadow-inner">
              {selectedOrders.size}
            </span>
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={() => selectedOrders.size === displayOrders.length ? setSelectedOrders(new Set()) : setSelectedOrders(new Set(displayOrders.map(o => o.id)))} 
                className="text-gray-300 font-black px-3 py-2 rounded-full text-xs uppercase tracking-widest hover:text-white hover:bg-gray-800 transition-colors shrink-0 flex items-center gap-1"
              >
                {selectedOrders.size === displayOrders.length ? '⨯ Clear' : '☑ Select All'}
              </button>
              <div className="w-px h-6 bg-gray-700 shrink-0 mx-1"></div>
              <button onClick={() => handleBatchStatus('Done')} disabled={batchUpdating} className="text-gray-300 font-black px-3 py-2 rounded-full text-xs uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Done</button>
              <button onClick={() => handleBatchStatus('Shipped')} disabled={batchUpdating} className="text-gray-300 font-black px-3 py-2 rounded-full text-xs uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Shipped</button>
              <button onClick={() => handleBatchStatus('Delivered')} disabled={batchUpdating} className="text-gray-300 font-black px-3 py-2 rounded-full text-xs uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Delivered</button>
              <div className="w-px h-6 bg-gray-700 shrink-0 mx-1"></div>
              <button onClick={handleBatchDelete} disabled={batchUpdating} className="text-red-400 font-black px-3 py-2 rounded-full text-xs uppercase tracking-widest hover:text-red-300 hover:bg-red-900/30 transition-colors shrink-0 flex items-center gap-1">
                🗑 Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingOrders ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-200 rounded animate-pulse w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-2/5"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded animate-pulse w-24"></div>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="h-9 bg-gray-200 rounded animate-pulse w-28"></div>
                <div className="h-9 bg-gray-200 rounded animate-pulse w-28"></div>
                <div className="h-9 bg-gray-200 rounded animate-pulse w-28"></div>
              </div>
            </div>
          ))}
        </div>
      ) : displayOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed font-bold text-gray-400">
            {showTrash ? 'Trash is empty. Deleted orders will appear here.' : 'No active orders.'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* SELECT ALL + TRASH ICON ROW */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedOrders.size === displayOrders.length && displayOrders.length > 0}
                  onChange={() => {
                    if (selectedOrders.size === displayOrders.length) setSelectedOrders(new Set());
                    else setSelectedOrders(new Set(displayOrders.map(o => o.id)));
                  }}
                  className="w-5 h-5 accent-orange-500 cursor-pointer rounded"
                />
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Select All ({displayOrders.length})</span>
              </div>
              {/* Trash bin moved to top */}
            </div>
          {displayOrders.map(order => (
          <div key={order.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${selectedOrders.has(order.id) ? 'border-orange-400 ring-2 ring-orange-200' : order.status === 'Cancelled' ? 'border-red-300' : 'border-gray-200'}`}>

            {/* CANCELLATION BANNER */}
            {order.status === 'Cancelled' && (
              <div className="bg-red-500 text-white font-black text-xs uppercase tracking-widest py-1.5 px-6">
                Order Cancelled • Reason: {order.cancelReason || 'Not specified'}
              </div>
            )}

            {/* MAIN ROW */}
            <div
              className={`p-6 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-gray-50 transition-colors ${order.isManual ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start gap-4 flex-1">
                <input
                  type="checkbox"
                  checked={selectedOrders.has(order.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 mt-1 accent-orange-500 cursor-pointer rounded shrink-0"
                />
                <div onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">ID: {order.id?.slice(-6) || 'N/A'}</p>
                  {order.isManual && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest">Offline Sale</span>}
                </div>
                <h3 className="text-xl font-black text-gray-900">{order.customerName || order.customerEmail || 'Unknown Customer'}</h3>
                <div className="text-gray-500 font-bold text-sm flex flex-wrap items-center">
                  {order.isManual ? (
                    <span className="text-green-600 font-black">Profit: ৳{order.profit || 0}</span>
                  ) : (
                    `Total: ৳${order.total || 0}`
                  )}
                  <span className="mx-2">•</span>
                  <span className="mr-1">Status:</span>
                  <select 
                    value={order.status || 'Pending'}
                    onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`bg-transparent font-black outline-none cursor-pointer border-b-2 border-transparent hover:border-gray-300 transition-colors ${order.status === 'Done' ? 'text-green-500' : order.status === 'Cancelled' ? 'text-red-500' : 'text-orange-500'}`}
                  >
                    <option value="Pending" className="text-orange-500">Pending</option>
                    <option value="Confirmed" className="text-orange-500">Confirmed</option>
                    <option value="Shipped" className="text-orange-500">Shipped</option>
                    <option value="Delivered" className="text-orange-500">Delivered</option>
                    <option value="Done" className="text-green-500">Done</option>
                    <option value="Cancelled" className="text-red-500">Cancelled</option>
                  </select>
                </div>
              </div>
              </div>
              <div className="flex items-center gap-3 mt-4 md:mt-0 shrink-0">
                {!showTrash && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                    className="text-red-400 hover:text-red-600 transition-colors drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]"
                    title="Move to Trash"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
                {showTrash && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRestoreOrder(order.id); }}
                    className="text-green-500 hover:text-green-600 transition-colors drop-shadow-[0_0_8px_rgba(34,197,94,0.7)]"
                    title="Restore Order"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
                  </button>
                )}
                <div onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} className="text-gray-400 font-black cursor-pointer">
                  {expandedOrder === order.id ? '▲ CLOSE' : '▼ VIEW DETAILS'}
                </div>
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
                      <div className="font-bold text-gray-800 mt-1">
                        <div className="flex items-start gap-2">
                          <p className="whitespace-pre-line leading-relaxed">Address: {order.deliveryAddress || 'N/A'}</p>
                          <button 
                            onClick={() => setEditAddressModal({ isOpen: true, orderId: order.id, address: order.deliveryAddress || '' })}
                            className="text-gray-400 hover:text-orange-500 transition-colors p-1 shrink-0"
                            title="Edit Address"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>
                        {order.deliveryCoords && (
                          <a 
                            href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-orange-600 hover:text-white hover:bg-orange-500 uppercase tracking-widest bg-orange-100 border border-orange-200 px-3 py-1.5 rounded transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            View on Map
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Items Ordered</h4>
                      <ul className="space-y-1 mb-4">
                        {order.items?.map((item, idx) => (
                          <li key={idx} className="font-bold text-gray-800 text-sm flex justify-between">
                            <span>{item.quantity || 1}x {item.name || 'Unnamed Item'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                            <span>৳{(item.discountPrice || item.price) * (item.quantity || 1)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* NEW RECEIPT BLOCK */}
                      <div className="border-t border-gray-200 pt-3 mt-3 space-y-1 text-sm">
                        <div className="flex justify-between font-bold text-gray-500">
                          <span>Subtotal</span>
                          <span>৳{order.subtotal || order.total - (order.deliveryFee || 0) + (order.discount || 0)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-blue-500">
                          <span>Delivery Fee {order.totalWeight ? `(${order.totalWeight}kg)` : ''}</span>
                          <span>৳{order.deliveryFee || 0}</span>
                        </div>
                        {(order.discount > 0 || (order.promoUsed && order.promoUsed !== 'None')) && (
                          <div className="flex justify-between font-bold text-orange-500">
                            <span>Discount {order.promoUsed && order.promoUsed !== 'None' ? `(${order.promoUsed})` : ''}</span>
                            <span>- ৳{order.discount || 0}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-gray-900 text-base pt-2 border-t border-dashed border-gray-300 mt-2 items-center">
                          <span className="flex items-center gap-2">
                            Total
                            <button 
                              onClick={() => setEditFinancialsModal({ isOpen: true, orderId: order.id, total: order.total || 0, deliveryFee: order.deliveryFee || 0 })}
                              className="text-gray-400 hover:text-orange-500 transition-colors p-1"
                              title="Edit Financials"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </span>
                          <span>৳{order.total || 0}</span>
                        </div>
                      </div>
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
                      <button onClick={() => handleUpdateStatus(order.id, 'Done')} className="bg-black text-white font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-orange-500 transition-colors shadow-sm">
                        Mark as Done
                      </button>
                    )}

                    <button onClick={() => handlePrintSingleOrder(order.id)} className="bg-white text-gray-800 font-black px-4 py-2 rounded text-xs uppercase tracking-widest border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-colors">
                      🖨️ Print Receipt
                    </button>
                    {order.status !== 'Cancelled' && (
                      <button onClick={() => handleAddTracking(order.id)} className={`font-black px-4 py-2 rounded text-xs uppercase tracking-widest transition-colors ${order.trackingLink ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {order.trackingLink ? 'Edit Tracking' : '+ Add Tracking'}
                      </button>
                    )}
                    {order.trackingLink && (
                       <a href={order.trackingLink?.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 underline self-center">View Link</a>
                    )}

                    {/* TRASH ACTIONS vs ACTIVE ACTIONS */}
                    {showTrash ? (
                      <>
                        <button onClick={() => handleRestoreOrder(order.id)} className="bg-green-100 text-green-700 font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-green-600 hover:text-white ml-auto">
                          ↩ Restore
                        </button>
                        <button onClick={() => handlePermanentDelete(order.id)} className="bg-red-100 text-red-600 font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white">
                          🗑 Permanently Delete
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleDeleteOrder(order.id)} className="bg-red-100 text-red-600 font-black px-4 py-2 rounded text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white ml-auto">
                        Move to Trash
                      </button>
                    )}
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
      <AnimatePresence>
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl"
          >
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
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* EDIT ADDRESS MODAL */}
      <AnimatePresence>
      {editAddressModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl"
          >
            <h3 className="text-xl font-black uppercase text-gray-900 mb-4">Edit Delivery Address</h3>
            <textarea 
              value={editAddressModal.address}
              onChange={(e) => setEditAddressModal({ ...editAddressModal, address: e.target.value })}
              className="w-full p-3 border rounded font-bold outline-none focus:border-orange-500 min-h-[120px] mb-6 whitespace-pre-line"
              placeholder="Enter new delivery address..."
            />
            <div className="flex gap-4">
              <button onClick={() => setEditAddressModal({ isOpen: false, orderId: null, address: '' })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={handleUpdateAddress} className="flex-1 bg-orange-500 text-white font-black py-3 rounded uppercase text-sm hover:bg-black transition-colors shadow-md">Save</button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* EDIT FINANCIALS MODAL */}
      <AnimatePresence>
      {editFinancialsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-xl font-black uppercase text-gray-900 mb-4">Edit Financials</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Delivery Fee (৳)</label>
                <input 
                  type="number" 
                  value={editFinancialsModal.deliveryFee}
                  onChange={(e) => setEditFinancialsModal({ ...editFinancialsModal, deliveryFee: e.target.value })}
                  className="w-full p-3 border rounded font-bold outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Grand Total (৳)</label>
                <input 
                  type="number" 
                  value={editFinancialsModal.total}
                  onChange={(e) => setEditFinancialsModal({ ...editFinancialsModal, total: e.target.value })}
                  className="w-full p-3 border rounded font-bold outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' })} className="flex-1 bg-gray-200 font-black py-3 rounded uppercase text-sm hover:bg-gray-300 transition-colors">Cancel</button>
              <button onClick={handleUpdateFinancials} className="flex-1 bg-green-500 text-white font-black py-3 rounded uppercase text-sm hover:bg-green-600 transition-colors shadow-md">Update</button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      </div> {/* END print:hidden wrapper */}

      {/* PHASE 2: PRINTABLE PACKING SLIPS */}
      <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:z-[9999] print:p-8 space-y-12 text-black bg-white">
        {(selectedOrders.size > 0 ? displayOrders.filter(o => selectedOrders.has(o.id)) : displayOrders).map(order => (
           <div key={`print-${order.id}`} className="p-8 border-4 border-black rounded-2xl break-inside-avoid print:page-break-inside-avoid">
             <div className="flex justify-between items-start border-b-8 border-black pb-4 mb-6">
               <div>
                 <h1 className="text-4xl font-black uppercase tracking-tighter">VERTEX PICKS</h1>
                 <p className="text-base font-bold text-gray-500 tracking-widest uppercase">Premium Delivery</p>
               </div>
               <div className="text-right">
                 <h2 className="text-3xl font-black uppercase">Order #{order.id?.slice(-6)}</h2>
                 <p className="font-bold text-gray-600">Date: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}</p>
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-8 mb-8">
               <div>
                 <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Ship To</h3>
                 <p className="text-2xl font-black mt-2">{order.customerName || order.customerEmail || 'Valued Customer'}</p>
                 <p className="font-black text-xl mt-1 tracking-wider">{order.deliveryPhone || 'N/A'}</p>
                 <p className="font-bold text-lg mt-2 whitespace-pre-line leading-relaxed">{order.deliveryAddress || 'N/A'}</p>
               </div>
               <div>
                 <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Order Details</h3>
                 <p className="font-bold text-lg mt-2">Total Weight: <span className="font-black text-2xl">{order.totalWeight || 'N/A'} kg</span></p>
                 <p className="font-bold text-lg mt-1">Status: <span className="uppercase">{order.status || 'Pending'}</span></p>
                 {order.isManual && <p className="font-black text-xl border-2 border-black inline-block px-3 py-1 mt-2 uppercase tracking-widest">Offline Sale</p>}
               </div>
             </div>

             <div>
               <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4 border-b-2 border-gray-200 pb-2">Items Included</h3>
               <ul className="space-y-3">
                 {order.items?.map((item, idx) => (
                   <li key={idx} className="flex justify-between text-xl font-bold border-b border-dashed border-gray-300 pb-3">
                     <span>{item.quantity || 1}x {item.name || 'Unnamed Item'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                     <span>৳{(item.discountPrice || item.price) * (item.quantity || 1)}</span>
                   </li>
                 ))}
               </ul>
             </div>

             <div className="mt-8 flex justify-between items-center border-t-8 border-black pt-4">
               <span className="font-black uppercase tracking-widest text-xl">Amount To Collect</span>
               <span className="text-5xl font-black tracking-tighter">৳{order.total || 0}</span>
             </div>
           </div>
        ))}
      </div>

    </motion.div>
  );
}
