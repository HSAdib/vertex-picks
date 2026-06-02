import React, { useState, useEffect } from 'react';
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
  
  // --- REAL-TIME SEARCH & FILTER STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // --- ORDERS EXPANSION & MANUAL ORDER STATE ---
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [mName, setMName] = useState(''); 
  const [mPhone, setMPhone] = useState('');
  const [mItem, setMItem] = useState(''); 
  const [mCharged, setMCharged] = useState('');
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
    Promise.resolve().then(() => {
      fetchOrders();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const executeAddTracking = async (id, url) => {
    if (url) {
      await updateDoc(doc(db, 'orders', id), { trackingLink: url });
      setOrders(orders.map(o => o.id === id ? { ...o, trackingLink: url } : o));
      toast.success('Logistics tracker updated!');
    }
  };

  const handleAddTracking = (id) => {
    const activeOrderObj = orders.find(o => o.id === id);
    setPromptModal({
      isOpen: true,
      title: "Add Logistics Tracking Link",
      placeholder: "e.g., Pathao or Steadfast tracking URL",
      value: activeOrderObj?.trackingLink || "",
      action: (url) => executeAddTracking(id, url)
    });
  };

  const executeSoftDelete = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: true, deletedAt: new Date() });
    setOrders(orders.map(o => o.id === id ? { ...o, deleted: true, deletedAt: new Date() } : o));
    toast.success('Order moved to Trash bin');
  };

  const handleDeleteOrder = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Move Order to Trash',
      message: 'Are you sure you want to move this order to the Trash bin? You can restore it later if needed.',
      action: () => executeSoftDelete(id)
    });
  };

  const handleRestoreOrder = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: false, deletedAt: null });
    setOrders(orders.map(o => o.id === id ? { ...o, deleted: false, deletedAt: null } : o));
    toast.success('Order restored to active queue!');
  };

  const executePermanentDelete = async (id) => {
    await deleteDoc(doc(db, 'orders', id));
    setOrders(orders.filter(o => o.id !== id));
    toast.success('Order permanently deleted from database');
  };

  const handlePermanentDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Erase Order',
      message: 'WARNING: This will permanently delete this order record from the Firestore database. This action is absolute and cannot be undone!',
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
        [...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { deleted: true, deletedAt: new Date() }))
      );
      setOrders(orders.map(o => selectedOrders.has(o.id) ? { ...o, deleted: true, deletedAt: new Date() } : o));
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
    toast.success("Offline sale registered successfully");
  };

  const handlePrintSingleOrder = (orderId) => {
    const prev = new Set(selectedOrders);
    setSelectedOrders(new Set([orderId]));
    setTimeout(() => {
      window.print();
      setSelectedOrders(prev);
    }, 150);
  };

  // --- FILTER & SEARCH IMPLEMENTATION ---
  const displayOrders = orders
    .filter(o => showTrash ? o.deleted : !o.deleted)
    .filter(o => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const queryStr = searchQuery.toLowerCase();
        const matchName = (o.customerName || '').toLowerCase().includes(queryStr);
        const matchPhone = (o.deliveryPhone || '').includes(queryStr);
        const matchId = o.id.toLowerCase().includes(queryStr);
        return matchName || matchPhone || matchId;
      }
      return true;
    });

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
        
        {/* OFFLINE ORDER CREATION MODAL */}
        <AnimatePresence>
          {showManualModal && (
            <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-brand p-6 max-w-md w-full shadow-lg"
              >
                <h3 className="text-lg font-black uppercase text-dark mb-6">Create Offline Order</h3>
                <form onSubmit={handleManualOrderSubmit} className="space-y-4">
                  <input type="text" placeholder="Customer Name" value={mName} onChange={e => setMName(e.target.value)} required className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
                  <input type="text" placeholder="Phone Number" value={mPhone} onChange={e => setMPhone(e.target.value)} required className={`w-full p-3 border rounded font-bold text-sm outline-none transition-colors duration-300 ${phoneError ? 'bg-red-pale border-red text-red shadow-sm' : 'bg-white border-gray2 focus:border-primary shadow-sm'}`} />
                  <input type="text" placeholder="Item/Box Name" value={mItem} onChange={e => setMItem(e.target.value)} required className="w-full p-3 bg-white border border-gray2 rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
                  
                  <div className="flex gap-2">
                    <input type="number" placeholder="Amt Charged" value={mCharged} onChange={e => setMCharged(e.target.value)} required className="w-full p-3 bg-green-light/5 border border-green-light/20 text-green rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
                    <input type="number" placeholder="True Cost" value={mCost} onChange={e => setMCost(e.target.value)} required className="w-full p-3 bg-red-pale border border-red/20 text-red rounded font-bold text-sm outline-none focus:border-primary shadow-sm" />
                  </div>
                  
                  {mCharged && mCost && (
                    <p className="text-center font-black text-xs uppercase text-primary bg-primary-pale py-2.5 rounded border border-primary/20">
                      Calculated Net Profit: ৳{Number(mCharged) - Number(mCost)}
                    </p>
                  )}
                  
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
                    <button type="submit" className="flex-1 btn-primary text-xs uppercase py-2.5">Save Sale</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ORDER GRID REGISTRY */}
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h3 className="ach-title">{showTrash ? '🗑️ Trashed Bookings' : '📦 Orders Registry'}</h3>
              <span className="ach-sub">Manage processing queues, logistics, and packing slips</span>
            </div>
            <span className="bg-primary-pale text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {displayOrders.length} Orders Listed
            </span>
          </div>

          {/* TABLE FILTERS & ACTIONS BAR */}
          <div className="admin-action-bar">
            <div className="aab-left">
              <div className="aab-search">
                <span className="aab-search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search customer, ID, phone..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="aab-filter"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {showTrash ? (
                <button 
                  onClick={() => { setShowTrash(false); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                  className="btn-secondary text-[10px] uppercase py-2 px-4 shadow-sm shrink-0"
                >
                  ← Active Queue
                </button>
              ) : (
                <button 
                  onClick={() => { setShowTrash(true); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                  className="bg-red-pale text-red text-[10px] font-black uppercase py-2 px-4 rounded border border-red/10 shadow-sm flex items-center gap-1.5 hover:bg-red/10 shrink-0"
                >
                  🗑️ Trash Bin ({orders.filter(o => o.deleted).length})
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => window.print()} disabled={displayOrders.length === 0} className="bg-blue text-white font-black px-4 py-2 rounded text-xs uppercase tracking-wider hover:bg-blue/80 shadow disabled:opacity-40 flex items-center gap-1.5">
                🖨️ Print Labels
              </button>
              <button onClick={handleExportCSV} disabled={orders.filter(o => !o.deleted).length === 0} className="bg-green text-white font-black px-4 py-2 rounded text-xs uppercase tracking-wider hover:bg-green-light shadow disabled:opacity-40 flex items-center gap-1.5">
                Export CSV
              </button>
              <button onClick={() => setShowManualModal(true)} className="btn-primary text-xs uppercase py-2 px-4 shadow">
                + Offline Sale
              </button>
            </div>
          </div>

          <div className="p-6">
            {loadingOrders ? (
              <div className="text-center py-20 border-2 border-dashed border-gray2 rounded-brand font-bold text-gray4 text-xs animate-pulse">Loading orders...</div>
            ) : displayOrders.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-gray2 rounded-brand font-bold text-gray4 text-xs">
                {showTrash ? 'Trash bin is empty.' : 'No orders matched the active filter queries.'}
              </div>
            ) : (
              <div className="overflow-x-auto select-none">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedOrders.size === displayOrders.length && displayOrders.length > 0}
                          onChange={() => {
                            if (selectedOrders.size === displayOrders.length) setSelectedOrders(new Set());
                            else setSelectedOrders(new Set(displayOrders.map(o => o.id)));
                          }}
                          className="at-check"
                        />
                      </th>
                      <th>Order Details</th>
                      <th>Items Summary</th>
                      <th>Amount Paid (৳)</th>
                      <th>Status Badge</th>
                      <th>Logistics & Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayOrders.map((order) => (
                      <React.Fragment key={order.id}>
                        <tr className={order.status === 'Cancelled' ? 'bg-red-pale/20' : order.isManual ? 'bg-blue-50/30' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedOrders.has(order.id)}
                              onChange={() => toggleSelectOrder(order.id)}
                              className="at-check"
                            />
                          </td>
                          <td>
                            <div className="font-black text-xs text-gray-500 uppercase tracking-wide">#{order.id.slice(-6).toUpperCase()}</div>
                            <div className="font-bold text-sm text-dark mt-0.5">{order.customerName || 'Offline Sale'}</div>
                            <div className="text-[10px] text-gray4">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td>
                            <div className="text-xs text-gray-700 max-w-xs truncate font-medium">
                              {(order.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Mango'}`).join(', ')}
                            </div>
                          </td>
                          <td>
                            <div className="font-black text-sm text-primary">৳{order.total}</div>
                            <div className="text-[9px] text-gray4">incl. ৳{order.deliveryFee || 0} fee</div>
                          </td>
                          <td>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              order.status === 'Delivered' || order.status === 'Done' ? 'bg-green-light/10 text-green' :
                              order.status === 'Cancelled' ? 'bg-red-pale text-red' :
                              order.status === 'Shipped' ? 'bg-blue-pale text-blue' :
                              'bg-primary-pale text-primary'
                            }`}>
                              {order.status || 'Pending'}
                            </span>
                          </td>
                          <td>
                            <div className="at-actions">
                              <button 
                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} 
                                className={`at-action-btn ${expandedOrder === order.id ? 'bg-primary-pale border-primary text-primary' : ''}`}
                                title="Expand Details"
                              >
                                🔍
                              </button>
                              
                              <button 
                                onClick={() => handleAddTracking(order.id)} 
                                className={`at-action-btn ${order.trackingLink ? 'bg-blue-pale border-blue text-blue' : ''}`}
                                title="Add Tracking Link"
                              >
                                🚀
                              </button>
                              
                              {order.deliveryPhone && (
                                <a 
                                  href={createWhatsAppLink(order.deliveryPhone, order.total, order.deliveryAddress)}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="at-action-btn"
                                  title="WhatsApp Courier Confirmation"
                                >
                                  💬
                                </a>
                              )}
                              
                              <button 
                                onClick={() => handlePrintSingleOrder(order.id)} 
                                className="at-action-btn"
                                title="Print Packing Receipt"
                              >
                                🖨️
                              </button>
                              
                              {showTrash ? (
                                <button 
                                  onClick={() => handleRestoreOrder(order.id)} 
                                  className="at-action-btn text-green"
                                  title="Restore Order"
                                >
                                  ↩
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleDeleteOrder(order.id)} 
                                  className="at-action-btn danger text-red"
                                  title="Move to Trash"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* NESTED EXPANDABLE INFO CYCLE */}
                        <AnimatePresence>
                          {expandedOrder === order.id && (
                            <tr>
                              <td colSpan="6" className="bg-gray1/80 p-5 border-b border-gray2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                                  
                                  {/* Delivery Addresses */}
                                  <div>
                                    <h4 className="text-[10px] font-black text-gray4 uppercase tracking-widest mb-2">Delivery parameters</h4>
                                    <p className="font-bold text-xs text-dark">Phone Contact: <span className="text-primary">{order.deliveryPhone || 'N/A'}</span></p>
                                    <div className="font-bold text-xs text-dark mt-2 leading-relaxed">
                                      <div className="flex items-start gap-2">
                                        <p className="whitespace-pre-line text-gray-700">Shipping Address: {order.deliveryAddress || 'N/A'}</p>
                                        <button 
                                          onClick={() => setEditAddressModal({ isOpen: true, orderId: order.id, address: order.deliveryAddress || '' })}
                                          className="text-gray4 hover:text-primary transition-colors p-1"
                                          title="Modify Shipping Address"
                                        >
                                          ✏️
                                        </button>
                                      </div>
                                      
                                      {order.deliveryCoords && (
                                        <a 
                                          href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="inline-flex items-center gap-1 mt-3 text-[9px] font-black text-primary hover:bg-primary hover:text-white uppercase tracking-widest bg-primary-pale border border-primary/20 px-2.5 py-1.5 rounded transition-all"
                                        >
                                          📍 View Coordinates on Google Maps
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Items list receipt details */}
                                  <div>
                                    <h4 className="text-[10px] font-black text-gray4 uppercase tracking-widest mb-2">Summary billing receipt</h4>
                                    <ul className="space-y-1 mb-3">
                                      {order.items?.map((item, idx) => (
                                        <li key={idx} className="font-bold text-xs text-dark flex justify-between">
                                          <span>{item.quantity || 1}x {item.name || 'Unnamed Item'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                                          <span className="text-primary">৳{(item.discountPrice || item.price) * (item.quantity || 1)}</span>
                                        </li>
                                      ))}
                                    </ul>

                                    <div className="border-t border-gray2 pt-3 mt-3 space-y-1 text-xs">
                                      <div className="flex justify-between font-bold text-gray-500">
                                        <span>Subtotal</span>
                                        <span>৳{order.subtotal || order.total - (order.deliveryFee || 0) + (order.discount || 0)}</span>
                                      </div>
                                      <div className="flex justify-between font-bold text-blue">
                                        <span>Delivery Charge {order.totalWeight ? `(${order.totalWeight}kg)` : ''}</span>
                                        <span>৳{order.deliveryFee || 0}</span>
                                      </div>
                                      {(order.discount > 0 || (order.promoUsed && order.promoUsed !== 'None')) && (
                                        <div className="flex justify-between font-bold text-primary">
                                          <span>VIP Coupon Discount {order.promoUsed && order.promoUsed !== 'None' ? `(${order.promoUsed})` : ''}</span>
                                          <span>- ৳{order.discount || 0}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between font-black text-gray-900 text-sm pt-2 border-t border-dashed border-gray-300 mt-2 items-center">
                                        <span className="flex items-center gap-1.5">
                                          Grand Total Amount
                                          <button 
                                            onClick={() => setEditFinancialsModal({ isOpen: true, orderId: order.id, total: order.total || 0, deliveryFee: order.deliveryFee || 0 })}
                                            className="text-gray4 hover:text-primary transition-colors p-1"
                                            title="Modify Financials"
                                          >
                                            ✏️
                                          </button>
                                        </span>
                                        <span>৳{order.total || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                </div>

                                <div className="flex flex-wrap gap-2.5 pt-4 border-t border-gray2 mt-3 items-center">
                                  {order.status !== 'Done' && order.status !== 'Cancelled' && (
                                    <button onClick={() => handleUpdateStatus(order.id, 'Done')} className="bg-black text-white font-black px-4 py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-primary transition-colors shadow-sm">
                                      Mark as Done ✓
                                    </button>
                                  )}
                                  
                                  {order.status === 'Pending' && (
                                    <button onClick={() => handleUpdateStatus(order.id, 'Confirmed')} className="bg-primary text-white font-black px-4 py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-primary-light transition-colors shadow-sm">
                                      Confirm Order
                                    </button>
                                  )}

                                  {order.trackingLink && (
                                    <a href={order.trackingLink?.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue hover:underline uppercase tracking-wider">
                                      View Courier Tracking URL
                                    </a>
                                  )}

                                  {showTrash ? (
                                    <>
                                      <button onClick={() => handleRestoreOrder(order.id)} className="bg-green-light/10 text-green font-black px-4 py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-green hover:text-white transition-colors ml-auto shadow-sm">
                                        ↩ Restore
                                      </button>
                                      <button onClick={() => handlePermanentDelete(order.id)} className="bg-red-pale text-red font-black px-4 py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-red hover:text-white transition-colors shadow-sm">
                                        🗑 Permanent Erase
                                      </button>
                                    </>
                                  ) : (
                                    <button onClick={() => handleDeleteOrder(order.id)} className="bg-red-pale text-red font-black px-4 py-1.5 rounded text-[10px] uppercase tracking-widest hover:bg-red hover:text-white transition-colors ml-auto shadow-sm">
                                      Move to Trash
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PAGINATION TRIGGER */}
          {hasMore && orders.length > 0 && !loadingOrders && (
            <div className="p-6 pt-0">
              <button 
                onClick={() => fetchOrders(true)} 
                disabled={loadingMore}
                className="w-full bg-gray1 text-dark border border-gray2 font-black py-3.5 rounded uppercase tracking-widest hover:bg-gray2 disabled:opacity-50 transition-all text-xs"
              >
                {loadingMore ? 'Syncing...' : 'Load More Registry Orders'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* PROMPT POPUPS LINK */}
      <AnimatePresence>
        {promptModal.isOpen && (
          <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-brand p-6 max-w-sm w-full shadow-lg"
            >
              <h3 className="text-lg font-black uppercase text-dark mb-4">{promptModal.title}</h3>
              <input 
                type="text" 
                placeholder={promptModal.placeholder}
                value={promptModal.value}
                onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
                className="w-full p-3 border border-gray2 rounded font-bold text-sm outline-none focus:border-primary mb-6"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setPromptModal({ ...promptModal, isOpen: false })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
                <button onClick={() => { promptModal.action(promptModal.value); setPromptModal({ ...promptModal, isOpen: false }); }} className="flex-1 btn-primary text-xs uppercase py-2.5">Submit</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT ADDRESS MODAL */}
      <AnimatePresence>
        {editAddressModal.isOpen && (
          <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-brand p-6 max-w-lg w-full shadow-lg"
            >
              <h3 className="text-lg font-black uppercase text-dark mb-4">Edit Shipping Address</h3>
              <textarea 
                value={editAddressModal.address}
                onChange={(e) => setEditAddressModal({ ...editAddressModal, address: e.target.value })}
                className="w-full p-3 border border-gray2 rounded font-bold text-xs outline-none focus:border-primary min-h-[100px] mb-6 whitespace-pre-line resize-none"
                placeholder="Enter new delivery address..."
              />
              <div className="flex gap-3">
                <button onClick={() => setEditAddressModal({ isOpen: false, orderId: null, address: '' })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
                <button onClick={handleUpdateAddress} className="flex-1 btn-primary text-xs uppercase py-2.5">Save address</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT FINANCIALS MODAL */}
      <AnimatePresence>
        {editFinancialsModal.isOpen && (
          <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-brand p-6 max-w-sm w-full shadow-lg"
            >
              <h3 className="text-lg font-black uppercase text-dark mb-4">Edit Financials</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-black text-gray4 uppercase tracking-widest mb-1.5">Delivery Fee (৳)</label>
                  <input 
                    type="number" 
                    value={editFinancialsModal.deliveryFee}
                    onChange={(e) => setEditFinancialsModal({ ...editFinancialsModal, deliveryFee: e.target.value })}
                    className="w-full p-3 border border-gray2 rounded font-bold text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray4 uppercase tracking-widest mb-1.5">Grand Total (৳)</label>
                  <input 
                    type="number" 
                    value={editFinancialsModal.total}
                    onChange={(e) => setEditFinancialsModal({ ...editFinancialsModal, total: e.target.value })}
                    className="w-full p-3 border border-gray2 rounded font-bold text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
                <button onClick={handleUpdateFinancials} className="flex-1 btn-primary text-xs uppercase py-2.5">Update</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-dark/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-brand p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-lg font-black uppercase text-dark mb-2">{confirmModal.title}</h3>
            <p className="text-xs font-bold text-gray4 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 btn-secondary text-xs uppercase py-2.5">Cancel</button>
              <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }} className="flex-1 bg-red text-white font-bold py-2.5 rounded-brand-sm uppercase text-xs hover:bg-red/80">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH ACTION BAR COMPONENT FLOATS */}
      <AnimatePresence>
        {selectedOrders.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900/90 backdrop-blur-md text-white rounded-full px-6 py-2.5 shadow-xl flex items-center gap-4 sm:gap-6 border border-white/10 w-max max-w-[95vw] overflow-x-auto"
          >
            <span className="font-black text-xs uppercase tracking-widest bg-primary text-white px-3 py-1 rounded-full shrink-0 shadow">
              {selectedOrders.size} Selected
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => selectedOrders.size === displayOrders.length ? setSelectedOrders(new Set()) : setSelectedOrders(new Set(displayOrders.map(o => o.id)))} 
                className="text-gray-300 font-black px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest hover:text-white hover:bg-gray-800 transition-colors shrink-0"
              >
                {selectedOrders.size === displayOrders.length ? '⨯ Clear' : '☑ All'}
              </button>
              <div className="w-px h-6 bg-gray-700 shrink-0"></div>
              <button onClick={() => handleBatchStatus('Done')} disabled={batchUpdating} className="text-gray-300 font-black px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Done</button>
              <button onClick={() => handleBatchStatus('Shipped')} disabled={batchUpdating} className="text-gray-300 font-black px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Shipped</button>
              <button onClick={() => handleBatchStatus('Delivered')} disabled={batchUpdating} className="text-gray-300 font-black px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0">Delivered</button>
              <div className="w-px h-6 bg-gray-700 shrink-0"></div>
              <button onClick={handleBatchDelete} disabled={batchUpdating} className="text-red font-black px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest hover:text-red-300 hover:bg-red/20 transition-colors shrink-0">
                🗑 Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHASE 2: PRINTABLE PACKING SLIPS */}
      <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:z-[9999] print:p-8 space-y-12 text-black bg-white select-none">
        {(selectedOrders.size > 0 ? displayOrders.filter(o => selectedOrders.has(o.id)) : displayOrders).map(order => (
          <div key={`print-${order.id}`} className="p-8 border-4 border-black rounded-2xl break-inside-avoid print:page-break-inside-avoid shadow-sm">
            <div className="flex justify-between items-start border-b-8 border-black pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter">VERTEX PICKS</h1>
                <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">Premium Orchard Delivery</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black uppercase">Order #{order.id?.slice(-6).toUpperCase()}</h2>
                <p className="font-bold text-gray-600 text-xs">Date: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
             
            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Ship To Customer</h3>
                <p className="text-xl font-black mt-2">{order.customerName || order.customerEmail || 'Valued Customer'}</p>
                <p className="font-black text-lg mt-1 tracking-wider text-primary">{order.deliveryPhone || 'N/A'}</p>
                <p className="font-bold text-xs mt-2 whitespace-pre-line leading-relaxed text-gray-700">{order.deliveryAddress || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Order Details</h3>
                <p className="font-bold text-xs mt-2">Boxed Total Weight: <span className="font-black text-lg">{order.totalWeight || 'N/A'} kg</span></p>
                <p className="font-bold text-xs mt-1">Status Code: <span className="uppercase font-black text-primary">{order.status || 'Pending'}</span></p>
                {order.isManual && <p className="font-black text-xs border border-black inline-block px-2.5 py-0.5 mt-2 uppercase tracking-widest">Offline Registered</p>}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3 border-b-2 border-gray-200 pb-2">Items Included</h3>
              <ul className="space-y-2">
                {order.items?.map((item, idx) => (
                  <li key={idx} className="flex justify-between text-base font-bold border-b border-dashed border-gray-300 pb-2">
                    <span>{item.quantity || 1}x {item.name || 'Unnamed Item'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                    <span>৳{(item.discountPrice || item.price) * (item.quantity || 1)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex justify-between items-center border-t-8 border-black pt-4">
              <span className="font-black uppercase tracking-widest text-lg">Total Collection Amount</span>
              <span className="text-4xl font-black tracking-tighter text-primary">৳{order.total || 0}</span>
            </div>
          </div>
        ))}
      </div>

    </motion.div>
  );
}
