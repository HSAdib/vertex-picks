import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, updateDoc, deleteDoc,
  doc, addDoc, query, orderBy, limit, startAfter
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { isValidBDPhoneNumber } from '../../utils/phoneValidation';
import { toast } from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/**
 * createWhatsAppLink
 * Formats phone for Bangladesh (strips spaces, ensures 880 prefix),
 * then constructs the encoded formal WhatsApp message.
 */
const createWhatsAppLink = (phone, total, address, orderId, itemsArray, customerName, orderStatus) => {
  if (!phone) return '#';

  // Normalise phone number
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    // 01XXXXXXXXX → 8801XXXXXXXXX
    cleanPhone = '88' + cleanPhone;
  } else if (!cleanPhone.startsWith('880') && cleanPhone.length === 10) {
    // 10-digit without country code
    cleanPhone = '880' + cleanPhone;
  } else if (cleanPhone.startsWith('88') && !cleanPhone.startsWith('880')) {
    // already has 88 prefix but missing the leading 0 (e.g. 881XXXXXXXXX)
    // keep as-is; edge case
  }

  const name = customerName || 'Valued Customer';
  const orderIdShort = orderId ? `#${orderId.slice(-6).toUpperCase()}` : '#N/A';
  const itemsList = (itemsArray || [])
    .map(i => `${i.quantity || 1}x ${i.name || 'Item'}`)
    .join('\n  ');

  const message =
`Dear ${name},

This is a formal update from Vertex Picks regarding your recent order (${orderIdShort}).

Order Summary:
  - Items: ${itemsList}
  - Total Amount: ৳${total}
  - Delivery Address: ${address || 'N/A'}
  - Current Status: ${orderStatus || 'Pending'}

If you require any modifications to your delivery details or have further inquiries, please reply to this message.

Thank you for choosing Vertex Picks.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

/** Status badge colour mapping */
const statusClass = (status) => {
  switch (status) {
    case 'Delivered':
    case 'Done':       return 'status-delivered';
    case 'Shipped':    return 'status-transit';
    case 'Confirmed':  return 'status-processing';
    case 'Cancelled':  return 'status-cancelled';
    default:           return 'status-processing';
  }
};

/** Format Firestore timestamp or plain Date */
const fmtDate = (ts) => {
  if (!ts) return 'N/A';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return 'N/A'; }
};

/* ─────────────────────────────────────────────────────────────
   MODALS (reusable wrappers)
───────────────────────────────────────────────────────────── */
const ModalBackdrop = ({ children, onClose }) => (
  <div
    className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      transition={{ duration: 0.18 }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </motion.div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function OrdersTab() {
  /* ── Pagination ── */
  const [orders, setOrders] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  /* ── Search & Filter ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  /* ── Row UI ── */
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  /* ─────────────────────────────────────────
     STATUS UPDATE
  ───────────────────────────────────────── */
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status.');
    }
  };

  /* ─────────────────────────────────────────
     TRACKING
  ───────────────────────────────────────── */
  const handleSaveTracking = async () => {
    const { orderId, url } = trackingModal;
    if (!url.trim()) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), { trackingLink: url.trim() });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, trackingLink: url.trim() } : o));
      toast.success('Tracking link saved!');
      setTrackingModal({ isOpen: false, orderId: null, url: '' });
    } catch {
      toast.error('Failed to save tracking link.');
    }
  };

  /* ─────────────────────────────────────────
     ADDRESS
  ───────────────────────────────────────── */
  const handleUpdateAddress = async () => {
    if (!editAddressModal.address.trim()) return;
    try {
      await updateDoc(doc(db, 'orders', editAddressModal.orderId), { deliveryAddress: editAddressModal.address });
      setOrders(prev => prev.map(o => o.id === editAddressModal.orderId ? { ...o, deliveryAddress: editAddressModal.address } : o));
      toast.success('Delivery address updated!');
      setEditAddressModal({ isOpen: false, orderId: null, address: '' });
    } catch {
      toast.error('Failed to update address.');
    }
  };

  /* ─────────────────────────────────────────
     FINANCIALS
  ───────────────────────────────────────── */
  const handleUpdateFinancials = async () => {
    if (editFinancialsModal.total === '' || editFinancialsModal.deliveryFee === '') return;
    try {
      const newTotal = Number(editFinancialsModal.total);
      const newFee = Number(editFinancialsModal.deliveryFee);
      await updateDoc(doc(db, 'orders', editFinancialsModal.orderId), { total: newTotal, deliveryFee: newFee });
      setOrders(prev => prev.map(o => o.id === editFinancialsModal.orderId ? { ...o, total: newTotal, deliveryFee: newFee } : o));
      toast.success('Financials updated!');
      setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' });
    } catch {
      toast.error('Failed to update financials.');
    }
  };

  /* ─────────────────────────────────────────
     SOFT DELETE / RESTORE / PERMANENT DELETE
  ───────────────────────────────────────── */
  const executeSoftDelete = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: true, deletedAt: new Date() });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, deleted: true } : o));
    toast.success('Order moved to Trash bin.');
  };

  const handleDeleteOrder = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Move Order to Trash',
      message: 'Are you sure you want to move this order to the Trash bin? You can restore it later.',
      action: () => executeSoftDelete(id),
    });
  };

  const handleRestoreOrder = async (id) => {
    await updateDoc(doc(db, 'orders', id), { deleted: false, deletedAt: null });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, deleted: false } : o));
    toast.success('Order restored!');
  };

  const executePermanentDelete = async (id) => {
    await deleteDoc(doc(db, 'orders', id));
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success('Order permanently deleted.');
  };

  const handlePermanentDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Erase Order',
      message: 'WARNING: This will permanently delete this order from Firestore. This action cannot be undone!',
      action: () => executePermanentDelete(id),
    });
  };

  /* ─────────────────────────────────────────
     PRINT
  ───────────────────────────────────────── */
  const handlePrintSingleOrder = (orderId) => {
    const prev = new Set(selectedOrders);
    setSelectedOrders(new Set([orderId]));
    setTimeout(() => {
      window.print();
      setSelectedOrders(prev);
    }, 150);
  };

  /* ─────────────────────────────────────────
     CSV EXPORT
  ───────────────────────────────────────── */
  const handleExportCSV = () => {
    const active = orders.filter(o => !o.deleted);
    if (!active.length) return;
    const headers = ['Order ID', 'Customer', 'Phone', 'Address', 'Items', 'Subtotal', 'Delivery Fee', 'Total', 'Status', 'Date'];
    const rows = active.map(o => [
      o.id,
      o.customerName || 'Unknown',
      o.deliveryPhone || o.customerPhone || 'N/A',
      `"${(o.deliveryAddress || 'N/A').replace(/"/g, '""')}"`,
      `"${(o.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ')}"`,
      o.subtotal || 0,
      o.deliveryFee || 0,
      o.total || 0,
      o.status || 'Pending',
      fmtDate(o.createdAt),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  /* ─────────────────────────────────────────
     BATCH ACTIONS
  ───────────────────────────────────────── */
  const toggleSelectOrder = (id) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchStatus = async (newStatus) => {
    if (!selectedOrders.size) return;
    setBatchUpdating(true);
    try {
      await Promise.all([...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { status: newStatus })));
      setOrders(prev => prev.map(o => selectedOrders.has(o.id) ? { ...o, status: newStatus } : o));
      toast.success(`${selectedOrders.size} order(s) marked as ${newStatus}`);
      setSelectedOrders(new Set());
    } catch { toast.error('Batch update failed.'); }
    setBatchUpdating(false);
  };

  const handleBatchDelete = async () => {
    if (!selectedOrders.size) return;
    setBatchUpdating(true);
    try {
      await Promise.all([...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { deleted: true, deletedAt: new Date() })));
      setOrders(prev => prev.map(o => selectedOrders.has(o.id) ? { ...o, deleted: true } : o));
      toast.success(`${selectedOrders.size} order(s) moved to trash.`);
      setSelectedOrders(new Set());
    } catch { toast.error('Batch delete failed.'); }
    setBatchUpdating(false);
  };

  /* ─────────────────────────────────────────
     MANUAL / OFFLINE ORDER
  ───────────────────────────────────────── */
  const handleManualOrderSubmit = async (e) => {
    e.preventDefault();
    if (!isValidBDPhoneNumber(mPhone)) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 3000);
      toast.error('Please enter a valid Bangladeshi phone number.');
      return;
    }
    const profit = Number(mCharged) - Number(mCost);
    try {
      await addDoc(collection(db, 'orders'), {
        isManual: true,
        customerName: mName,
        deliveryPhone: mPhone,
        deliveryAddress: mAddress,
        items: [{ name: mItem, quantity: 1, price: Number(mCharged) }],
        total: Number(mCharged),
        cost: Number(mCost),
        profit,
        status: 'Done',
        createdAt: new Date(),
      });
      setShowManualModal(false);
      setMName(''); setMPhone(''); setMItem(''); setMCharged('');  useEffect(() => {
    Promise.resolve().then(() => fetchOrders());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Close dropdown on any click outside it.
   */
  useEffect(() => {
    if (!activeDropdown) return;
    const handler = () => setActiveDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeDropdown]); } catch {
      toast.error('Failed to save offline sale.');
    }
  };

  /* ─────────────────────────────────────────
     FILTERED / DISPLAYED LIST
  ───────────────────────────────────────── */
  const displayOrders = orders
    .filter(o => showTrash ? o.deleted : !o.deleted)
    .filter(o => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.deliveryPhone || '').includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      }
      return true;
    });

  const allSelected = displayOrders.length > 0 && selectedOrders.size === displayOrders.length;

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body > *:not(#print-root) { display: none !important; }
          #print-root { display: block !important; }
          .print\\:hidden { display: none !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          #print-root { display: none; }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          SCREEN UI (hidden on print)
      ══════════════════════════════════════════ */}
      <div className="print:hidden space-y-6">

        {/* ── ORDER REGISTRY CARD ── */}
        <div className="admin-card overflow-visible">

          {/* Card header */}
          <div className="admin-card-head flex-wrap gap-3">
            <div>
              <h3 className="ach-title">{showTrash ? '🗑️ Trashed Bookings' : '📦 Orders Registry'}</h3>
              <span className="ach-sub">Manage processing queues, logistics, and packing slips</span>
            </div>
            <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {displayOrders.length} Listed
            </span>
          </div>

          {/* ── Action Bar ── */}
          <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{borderBottom:'1.5px solid var(--gray2)'}}>
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'var(--gray4)',fontSize:'.85rem'}}>🔍</span>
              <input
                type="text"
                placeholder="Search name, ID, phone…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="aab-search"
                style={{paddingLeft:'2.2rem',width:'100%'}}
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="aab-filter"
            >
              {['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Done', 'Cancelled'].map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
              ))}
            </select>

            {/* Trash toggle */}
            {showTrash ? (
              <button
                onClick={() => { setShowTrash(false); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                className="btn-secondary"
                style={{fontSize:'.75rem',padding:'.4rem .9rem'}}
              >
                ← Active Queue
              </button>
            ) : (
              <button
                onClick={() => { setShowTrash(true); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                style={{display:'flex',alignItems:'center',gap:'.4rem',background:'var(--red-pale)',color:'var(--red)',border:'1.5px solid rgba(220,38,38,0.2)',borderRadius:100,padding:'.4rem .9rem',fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}
              >
                🗑️ Trash ({orders.filter(o => o.deleted).length})
              </button>
            )}

            {/* Right-side actions */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button
                  onClick={() => window.print()}
                  disabled={displayOrders.length === 0}
                  className="add-btn"
                  style={{background:'var(--blue)',opacity:displayOrders.length===0?.4:1}}
                >
                  🖨️ Print Labels
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={orders.filter(o => !o.deleted).length === 0}
                  className="add-btn"
                  style={{background:'var(--green)',opacity:orders.filter(o=>!o.deleted).length===0?.4:1}}
                >
                  Export CSV
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="add-btn"
                >
                  + Add Offline Sale
                </button>
              </div>
          </div>

          {/* ── Inline Bulk Actions Bar (appears when rows are selected) ── */}
          <AnimatePresence>
            {selectedOrders.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3" style={{background:'var(--primary-pale)',borderColor:'rgba(232,84,10,0.2)'}}>
                  <span style={{fontSize:'.75rem',fontWeight:900,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'.1em'}}>
                    {selectedOrders.size} Selected:
                  </span>
                  <button onClick={() => handleBatchStatus('Done')} disabled={batchUpdating}
                    className="order-action-btn">✓ Mark Done</button>
                  <button onClick={() => handleBatchStatus('Shipped')} disabled={batchUpdating}
                    className="order-action-btn">🚚 Mark Shipped</button>
                  <button onClick={() => handleBatchStatus('Delivered')} disabled={batchUpdating}
                    className="order-action-btn">📬 Mark Delivered</button>
                  <button onClick={handleBatchDelete} disabled={batchUpdating}
                    className="order-action-btn" style={{background:'var(--red-pale)',color:'var(--red)'}}>🗑️ Delete Selected</button>
                  <button onClick={() => setSelectedOrders(new Set())}
                    style={{marginLeft:'auto',fontSize:'.75rem',fontWeight:700,color:'var(--gray4)',background:'none',border:'none',cursor:'pointer'}}>✕ Clear</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Orders List ── */}
          <div className="p-5 space-y-3">

            {/* Select-all header */}
            {!loadingOrders && displayOrders.length > 0 && (
              <div className="flex items-center gap-3 px-1 pb-1">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={allSelected}
                  onChange={() => allSelected
                    ? setSelectedOrders(new Set())
                    : setSelectedOrders(new Set(displayOrders.map(o => o.id)))
                  }
                  className="w-4 h-4 accent-orange-500 cursor-pointer rounded"
                />
                <label htmlFor="select-all" className="text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer">
                  Select All
                </label>
              </div>
            )}

            {loadingOrders ? (
              <div className="text-center py-16 text-gray-400 text-sm font-bold animate-pulse">
                Loading orders…
              </div>
            ) : displayOrders.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-bold">
                {showTrash ? 'Trash bin is empty.' : 'No orders match the current filters.'}
              </div>
            ) : (
              displayOrders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  isSelected={selectedOrders.has(order.id)}
                  isExpanded={expandedOrder === order.id}
                  isDropdownOpen={activeDropdown === order.id}
                  showTrash={showTrash}
                  onToggleSelect={() => toggleSelectOrder(order.id)}
                  onToggleExpand={() => setExpandedOrder(prev => prev === order.id ? null : order.id)}
                  onToggleDropdown={() => setActiveDropdown(prev => prev === order.id ? null : order.id)}
                  onCloseDropdown={() => setActiveDropdown(null)}
                  onUpdateStatus={handleUpdateStatus}
                  onDelete={handleDeleteOrder}
                  onRestore={handleRestoreOrder}
                  onPermanentDelete={handlePermanentDelete}
                  onPrintReceipt={() => handlePrintSingleOrder(order.id)}
                  onEditAddress={() => {
                    setEditAddressModal({ isOpen: true, orderId: order.id, address: order.deliveryAddress || '' });
                    setActiveDropdown(null);
                  }}
                  onEditFinancials={() => {
                    setEditFinancialsModal({ isOpen: true, orderId: order.id, total: order.total || 0, deliveryFee: order.deliveryFee || 0 });
                  }}
                  onAddTracking={() => {
                    setTrackingModal({ isOpen: true, orderId: order.id, url: order.trackingLink || '' });
                    setActiveDropdown(null);
                  }}
                />
              ))
            )}
          </div>

          {/* Load More */}
          {hasMore && orders.length > 0 && !loadingOrders && (
            <div className="px-5 pb-5">
              <button
                onClick={() => fetchOrders(true)}
                disabled={loadingMore}
                className="btn-secondary"
                style={{width:'100%',justifyContent:'center',fontSize:'.8rem',padding:'.875rem'}}
              >
                {loadingMore ? 'Loading…' : 'Load More Orders'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          FLOATING BULK ACTION BAR
      ══════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedOrders.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 sm:gap-4 border w-max max-w-[95vw] overflow-x-auto"
            style={{background:'rgba(18,18,18,0.97)',backdropFilter:'blur(12px)',borderColor:'rgba(255,255,255,0.08)'}}
          >
            <span className="font-black text-xs uppercase tracking-widest bg-orange-500 text-white px-2.5 py-1 rounded-lg shrink-0">
              {selectedOrders.size} Selected
            </span>
            <div className="w-px h-5 bg-white/20 shrink-0" />
            <button onClick={() => selectedOrders.size === displayOrders.length ? setSelectedOrders(new Set()) : setSelectedOrders(new Set(displayOrders.map(o => o.id)))}
              className="text-gray-300 font-bold px-2 py-1 rounded-lg text-xs hover:text-white hover:bg-white/10 transition-colors shrink-0">
              {allSelected ? '⨯ Clear' : '☑ All'}
            </button>
            <div className="w-px h-5 bg-white/20 shrink-0" />
            <button onClick={() => handleBatchStatus('Done')} disabled={batchUpdating}
              className="text-gray-300 font-bold px-2 py-1 rounded-lg text-xs hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors shrink-0">Done</button>
            <button onClick={() => handleBatchStatus('Shipped')} disabled={batchUpdating}
              className="text-gray-300 font-bold px-2 py-1 rounded-lg text-xs hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors shrink-0">Shipped</button>
            <button onClick={() => handleBatchStatus('Delivered')} disabled={batchUpdating}
              className="text-gray-300 font-bold px-2 py-1 rounded-lg text-xs hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors shrink-0">Delivered</button>
            <div className="w-px h-5 bg-white/20 shrink-0" />
            <button onClick={handleBatchDelete} disabled={batchUpdating}
              className="text-red-400 font-bold px-2 py-1 rounded-lg text-xs hover:text-red-300 hover:bg-red-500/20 transition-colors shrink-0">
              🗑 Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}

      {/* ── Add Offline Sale ── */}
      <AnimatePresence>
        {showManualModal && (
          <ModalBackdrop onClose={() => setShowManualModal(false)}>
            <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:440,boxShadow:'var(--shadow-lg)'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.1rem',fontWeight:900,color:'var(--dark)',marginBottom:'1.25rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Create Offline Order</h3>
              <form onSubmit={handleManualOrderSubmit} className="space-y-4">
                <input type="text" placeholder="Customer Name *" value={mName}
                  onChange={e => setMName(e.target.value)} required
                  className="form-input" />
                <input type="text" placeholder="Phone Number *" value={mPhone}
                  onChange={e => setMPhone(e.target.value)} required
                  className="form-input" style={phoneError?{borderColor:'var(--red)',background:'var(--red-pale)'}:{}} />
                <input type="text" placeholder="Item / Box Name *" value={mItem}
                  onChange={e => setMItem(e.target.value)} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors" />
                <input type="text" placeholder="Delivery Address (optional)" value={mAddress}
                  onChange={e => setMAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-orange-400 focus:bg-white transition-colors" />
                <div className="flex gap-3">
                  <input type="number" placeholder="Amount Charged (৳) *" value={mCharged}
                    onChange={e => setMCharged(e.target.value)} required
                    className="flex-1 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-800 outline-none focus:border-green-500 transition-colors" />
                  <input type="number" placeholder="True Cost (৳) *" value={mCost}
                    onChange={e => setMCost(e.target.value)} required
                    className="flex-1 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700 outline-none focus:border-red-400 transition-colors" />
                </div>
                {mCharged && mCost && (
                  <p className="text-center text-xs font-black uppercase text-orange-600 bg-orange-50 py-2.5 rounded-lg border border-orange-200">
                    Net Profit: ৳{Number(mCharged) - Number(mCost)}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowManualModal(false)}
                    className="flex-1 px-4 py-2.5 text-xs font-black uppercase bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 px-4 py-2.5 text-xs font-black uppercase bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
                    Save Sale
                  </button>
                </div>
              </form>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── Edit Address ── */}
      <AnimatePresence>
        {editAddressModal.isOpen && (
          <ModalBackdrop onClose={() => setEditAddressModal({ isOpen: false, orderId: null, address: '' })}>
            <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:520,boxShadow:'var(--shadow-lg)'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.1rem',fontWeight:900,color:'var(--dark)',marginBottom:'1rem',textTransform:'uppercase'}}>Edit Shipping Address</h3>
              <textarea
                value={editAddressModal.address}
                onChange={e => setEditAddressModal({ ...editAddressModal, address: e.target.value })}
                className="form-input"
                style={{minHeight:100,resize:'none',marginBottom:'1.25rem'}}
                placeholder="Enter updated delivery address…"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setEditAddressModal({ isOpen: false, orderId: null, address: '' })}
                  className="btn-secondary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Cancel</button>
                <button onClick={handleUpdateAddress}
                  className="btn-primary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Save Address</button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── Edit Financials ── */}
      <AnimatePresence>
        {editFinancialsModal.isOpen && (
          <ModalBackdrop onClose={() => setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' })}>
            <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:380,boxShadow:'var(--shadow-lg)'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.1rem',fontWeight:900,color:'var(--dark)',marginBottom:'1rem',textTransform:'uppercase'}}>Edit Financials</h3>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="form-label">Delivery Fee (৳)</label>
                  <input type="number" value={editFinancialsModal.deliveryFee}
                    onChange={e => setEditFinancialsModal({ ...editFinancialsModal, deliveryFee: e.target.value })}
                    className="form-input" />
                </div>
                <div>
                  <label className="form-label">Grand Total (৳)</label>
                  <input type="number" value={editFinancialsModal.total}
                    onChange={e => setEditFinancialsModal({ ...editFinancialsModal, total: e.target.value })}
                    className="form-input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditFinancialsModal({ isOpen: false, orderId: null, total: '', deliveryFee: '' })}
                  className="btn-secondary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Cancel</button>
                <button onClick={handleUpdateFinancials}
                  className="btn-primary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Update</button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── Add Tracking ── */}
      <AnimatePresence>
        {trackingModal.isOpen && (
          <ModalBackdrop onClose={() => setTrackingModal({ isOpen: false, orderId: null, url: '' })}>
            <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:440,boxShadow:'var(--shadow-lg)'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.1rem',fontWeight:900,color:'var(--dark)',marginBottom:'1rem',textTransform:'uppercase'}}>Add Logistics Tracking</h3>
              <input
                type="url"
                placeholder="e.g. Pathao or Steadfast tracking URL"
                value={trackingModal.url}
                onChange={e => setTrackingModal({ ...trackingModal, url: e.target.value })}
                className="form-input"
                style={{marginBottom:'1.25rem'}}
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setTrackingModal({ isOpen: false, orderId: null, url: '' })}
                  className="btn-secondary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Cancel</button>
                <button onClick={handleSaveTracking}
                  className="btn-primary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem',background:'var(--blue)'}}>Save Link</button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── Confirm ── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <ModalBackdrop onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
            <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:380,boxShadow:'var(--shadow-lg)'}}>
              <h3 style={{fontFamily:'var(--ff-display)',fontSize:'1.1rem',fontWeight:900,color:'var(--dark)',marginBottom:'.5rem',textTransform:'uppercase'}}>{confirmModal.title}</h3>
              <p style={{fontSize:'.82rem',color:'var(--gray4)',lineHeight:1.6,marginBottom:'1.25rem'}}>{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="btn-secondary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem'}}>Cancel</button>
                <button onClick={() => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); }}
                  className="btn-primary flex-1" style={{justifyContent:'center',fontSize:'.8rem',padding:'.6rem',background:'var(--red)'}}>Confirm</button>
              </div>
            </div>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          PRINTABLE PACKING SLIPS (screen:hidden, print:block)
      ══════════════════════════════════════════ */}
      <div id="print-root" className="hidden print:block bg-white text-black p-8 space-y-10">
        {(selectedOrders.size > 0
          ? displayOrders.filter(o => selectedOrders.has(o.id))
          : displayOrders
        ).map(order => (
          <div key={`print-${order.id}`} className="p-8 border-4 border-black rounded-2xl break-inside-avoid" style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">VERTEX PICKS</h1>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Premium Orchard Delivery</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black uppercase">Order #{order.id?.slice(-6).toUpperCase()}</h2>
                <p className="text-xs font-bold text-gray-500 mt-0.5">Date: {fmtDate(order.createdAt)}</p>
                <p className="text-xs font-bold text-gray-500">Status: <span className="uppercase font-black text-black">{order.status || 'Pending'}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Ship To</h3>
                <p className="text-xl font-black mt-2">{order.customerName || order.customerEmail || 'Valued Customer'}</p>
                <p className="font-black text-lg mt-1 tracking-wider text-orange-600">{order.deliveryPhone || 'N/A'}</p>
                <p className="font-bold text-xs mt-2 whitespace-pre-line leading-relaxed text-gray-700">{order.deliveryAddress || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 border-b-2 border-gray-200 pb-1">Logistics</h3>
                <p className="font-bold text-xs mt-2">Boxed Weight: <span className="font-black text-lg">{order.totalWeight || 'N/A'} kg</span></p>
                {order.isManual && <span className="font-black text-[9px] border-2 border-black inline-block px-2 py-0.5 mt-2 uppercase tracking-widest">Offline Sale</span>}
                {order.trackingLink && <p className="font-bold text-xs mt-2 text-blue-700 break-all">Tracking: {order.trackingLink}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-3 border-b-2 border-gray-200 pb-2">Items Included</h3>
              <ul className="space-y-2">
                {(order.items || []).map((item, idx) => (
                  <li key={idx} className="flex justify-between text-base font-bold border-b border-dashed border-gray-200 pb-2">
                    <span>{item.quantity || 1}x {item.name || 'Unnamed'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                    <span>৳{(item.discountPrice || item.price) * (item.quantity || 1)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex justify-between items-center border-t-4 border-black pt-4">
              <span className="font-black uppercase tracking-widest text-lg">Total Collection Amount</span>
              <span className="text-4xl font-black tracking-tight text-orange-600">৳{order.total || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ORDER ROW (extracted sub-component for clarity & perf)
───────────────────────────────────────────────────────────── */
function OrderRow({
  order, isSelected, isExpanded, isDropdownOpen, showTrash,
  onToggleSelect, onToggleExpand, onToggleDropdown, onCloseDropdown,
  onUpdateStatus, onDelete, onRestore, onPermanentDelete,
  onPrintReceipt, onEditAddress, onEditFinancials, onAddTracking,
}) {
  const itemsSummary = (order.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ');
  const phone = order.deliveryPhone || order.customerPhone || '';
  const waLink = createWhatsAppLink(
    phone, order.total, order.deliveryAddress,
    order.id, order.items, order.customerName, order.status
  );

  return (
    <div
      className={`
        bg-white rounded-[14px] shadow-sm border transition-all duration-200
        ${isSelected ? 'border-[var(--primary)] bg-[var(--primary-pale)]/30' : 'border-[var(--gray2)]'}
        ${order.status === 'Cancelled' ? 'opacity-70' : ''}
        ${isDropdownOpen ? 'z-[9999] relative overflow-visible' : 'z-10 relative overflow-visible'}
        hover:shadow-md
      `}
    >
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

        <div className="flex items-start gap-4 w-full lg:w-auto">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 mt-1 accent-orange-500 cursor-pointer rounded shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">
                #{order.id.slice(-6).toUpperCase()}
              </span>
              {order.isManual && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 tracking-wider">OFFLINE</span>
              )}
            </div>
            <p className="font-black text-sm text-gray-900 truncate">{order.customerName || 'Offline Sale'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(order.createdAt)}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-xs">{itemsSummary || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-none pt-4 lg:pt-0 border-gray-100 mt-2 lg:mt-0">

          <div className="mr-2 text-right shrink-0">
            <p className="font-black text-base text-orange-600">৳{order.total || 0}</p>
            <p className="text-[9px] text-gray-400">+৳{order.deliveryFee || 0} fee</p>
          </div>

          <select
            value={order.status || 'Pending'}
            onChange={e => onUpdateStatus(order.id, e.target.value)}
            onClick={e => e.stopPropagation()}
            className={`order-status ${statusClass(order.status)}`}
            style={{cursor:'pointer',fontSize:'.72rem',fontWeight:700}}
          >
            {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Done', 'Cancelled'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={onToggleExpand}
            className="order-action-btn"
            style={isExpanded ? {background:'var(--primary)',color:'#fff'} : {}}
          >
            {isExpanded ? '▲ Hide' : '▼ Details'}
          </button>

          <div className="relative inline-block shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onToggleDropdown(); }}
              className="nav-icon-btn"
              style={{width:34,height:34,borderRadius:'var(--radius-sm)'}}
              aria-label="More actions"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white rounded-[14px] shadow-2xl z-[9999] origin-top-right flex flex-col overflow-hidden"
                  style={{border:'1.5px solid var(--gray2)'}}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onPrintReceipt(); onCloseDropdown(); }}
                    className="nud-item"
                  >
                    🖨️ Print Receipt
                  </button>
                  <button
                    onClick={() => { onEditAddress(); onCloseDropdown(); }}
                    className="nud-item"
                  >
                    ✏️ Edit Address
                  </button>
                  <button
                    onClick={() => { onAddTracking(); onCloseDropdown(); }}
                    className="nud-item"
                    style={{color:'var(--blue)'}}
                  >
                    📦 Add Tracking
                  </button>
                  {phone ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => onCloseDropdown()}
                      className="nud-item"
                      style={{color:'var(--green)'}}
                    >
                      💬 WhatsApp Msg
                    </a>
                  ) : (
                    <span className="nud-item" style={{color:'var(--gray3)',cursor:'not-allowed'}}>
                      💬 No Phone
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-5" style={{borderTop:'1.5px solid var(--gray2)'}}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">

                <div style={{background:'var(--gray1)',borderRadius:14,padding:'1rem'}}>
                  <h4 style={{fontSize:'.72rem',fontWeight:900,color:'var(--gray4)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'.75rem'}}>Delivery Parameters</h4>
                  <p style={{fontSize:'.8rem',fontWeight:700,color:'var(--dark)'}}>
                    Phone: <span style={{color:'var(--primary)',fontWeight:900}}>{order.deliveryPhone || 'N/A'}</span>
                  </p>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'.5rem',marginTop:'.5rem'}}>
                    <p style={{fontSize:'.8rem',fontWeight:700,color:'var(--dark)',whiteSpace:'pre-line',lineHeight:1.5,flex:1}}>
                      Address: {order.deliveryAddress || 'N/A'}
                    </p>
                    <button
                      onClick={onEditAddress}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray3)',fontSize:'.85rem',padding:'.2rem'}}
                      title="Edit Address"
                    >✏️</button>
                  </div>
                  {order.deliveryCoords && (
                    <a
                      href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`}
                      target="_blank" rel="noreferrer"
                      className="addr-btn"
                      style={{display:'inline-flex',alignItems:'center',gap:'.3rem',marginTop:'.75rem',fontSize:'.72rem',textDecoration:'none'}}
                    >
                      📍 View on Google Maps
                    </a>
                  )}
                  {order.trackingLink && (
                    <a
                      href={order.trackingLink.startsWith('http') ? order.trackingLink : `https://${order.trackingLink}`}
                      target="_blank" rel="noreferrer"
                      style={{display:'inline-flex',alignItems:'center',gap:'.25rem',marginTop:'.5rem',fontSize:'.72rem',fontWeight:700,color:'var(--blue)',textDecoration:'none'}}
                    >
                      View Courier Tracking →
                    </a>
                  )}
                </div>

                <div style={{background:'var(--gray1)',borderRadius:14,padding:'1rem'}}>
                  <h4 style={{fontSize:'.72rem',fontWeight:900,color:'var(--gray4)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'.75rem'}}>Billing Receipt</h4>
                  <ul style={{display:'flex',flexDirection:'column',gap:'.4rem',marginBottom:'.75rem'}}>
                    {(order.items || []).map((item, idx) => (
                      <li key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:'.8rem',fontWeight:700,color:'var(--dark)'}}>
                        <span>{item.quantity || 1}x {item.name || 'Item'} {item.weight ? `(${item.weight}kg)` : ''}</span>
                        <span style={{color:'var(--primary)'}}>৳{(item.discountPrice || item.price || 0) * (item.quantity || 1)}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{borderTop:'1px solid var(--gray2)',paddingTop:'.75rem',display:'flex',flexDirection:'column',gap:'.3rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',fontWeight:700,color:'var(--gray4)'}}>
                      <span>Subtotal</span>
                      <span>৳{order.subtotal || (order.total - (order.deliveryFee || 0) + (order.discount || 0))}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',fontWeight:700,color:'var(--blue)'}}>
                      <span>Delivery {order.totalWeight ? `(${order.totalWeight}kg)` : ''}</span>
                      <span>৳{order.deliveryFee || 0}</span>
                    </div>
                    {order.discount > 0 && (
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.78rem',fontWeight:700,color:'var(--primary)'}}>
                        <span>Discount {order.promoUsed ? `(${order.promoUsed})` : ''}</span>
                        <span>- ৳{order.discount}</span>
                      </div>
                    )}
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.88rem',fontWeight:900,color:'var(--dark)',paddingTop:'.5rem',borderTop:'1px dashed var(--gray2)',marginTop:'.25rem',alignItems:'center'}}>
                      <span style={{display:'flex',alignItems:'center',gap:'.25rem'}}>
                        Grand Total
                        <button
                          onClick={onEditFinancials}
                          style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray3)',fontSize:'.8rem',padding:'.1rem'}}
                          title="Edit Financials"
                        >✏️</button>
                      </span>
                      <span>৳{order.total || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 mt-1">
                {order.status !== 'Done' && order.status !== 'Cancelled' && (
                  <button onClick={() => onUpdateStatus(order.id, 'Done')}
                    className="order-action-btn" style={{background:'var(--dark)',color:'#fff',borderRadius:100}}>
                    Mark as Done ✓
                  </button>
                )}
                {order.status === 'Pending' && (
                  <button onClick={() => onUpdateStatus(order.id, 'Confirmed')}
                    className="btn-primary" style={{padding:'.35rem .9rem',fontSize:'.72rem'}}>
                    Confirm Order
                  </button>
                )}

                {showTrash ? (
                  <>
                    <button onClick={() => onRestore(order.id)}
                      className="order-action-btn" style={{marginLeft:'auto',background:'#DCFCE7',color:'#16A34A'}}>
                      ↩ Restore
                    </button>
                    <button onClick={() => onPermanentDelete(order.id)}
                      className="order-action-btn" style={{background:'var(--red-pale)',color:'var(--red)'}}>
                      🗑 Permanent Erase
                    </button>
                  </>
                ) : (
                  <button onClick={() => onDelete(order.id)}
                    className="order-action-btn" style={{marginLeft:'auto',background:'var(--red-pale)',color:'var(--red)'}}>
                    Move to Trash
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
