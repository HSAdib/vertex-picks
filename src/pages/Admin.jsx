import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import CategoriesTab from '../components/admin/CategoriesTab';
import FiltersTab from '../components/admin/FiltersTab';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { sanitizeHTML } from '../utils/sanitizeHTML';

const exportToCSV = (filename, rows, headers) => {
  const escapeCsvField = (field) => {
    if (field === null || field === undefined) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsvField).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function generateUniqueId() {
  return Date.now().toString();
}

export default function Admin() {
  const { user, isAdmin, authLoading } = useAuth();

  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real-time notification state
  const [newOrderAlert, setNewOrderAlert] = useState({ show: false, orders: [], count: 0 });
  const [unreadOrderCount, setUnreadOrderCount] = useState(0);
  const pageLoadTime = useRef(Date.now());
  const ordersListenerRef = useRef(null);

  const playNotificationChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch { /* Audio not available */ }
  };

  // Firestore Data Collections
  const [mangoes, setMangoes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [promos, setPromos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [packagingOptions, setPackagingOptions] = useState([]);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [editPackagingId, setEditPackagingId] = useState(null);
  const [pkgLabel, setPkgLabel] = useState('');
  const [pkgType, setPkgType] = useState('crate');
  const [pkgQuality, setPkgQuality] = useState('normal');
  const [pkgMinCapacity, setPkgMinCapacity] = useState(20);
  const [pkgMaxCapacity, setPkgMaxCapacity] = useState(25);
  const [pkgPrice, setPkgPrice] = useState(150);
  const [pkgActive, setPkgActive] = useState(true);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editDeliveryId, setEditDeliveryId] = useState(null);
  const [dlvLabel, setDlvLabel] = useState('');
  const [dlvDescription, setDlvDescription] = useState('');
  const [dlvPricingType, setDlvPricingType] = useState('per_kg');
  const [dlvPerKgRate, setDlvPerKgRate] = useState(13);
  const [dlvFirstKgPrice, setDlvFirstKgPrice] = useState(125);
  const [dlvExtraKgRate, setDlvExtraKgRate] = useState(22);
  const [dlvActive, setDlvActive] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [editAddressModal, setEditAddressModal] = useState({ isOpen: false, orderId: null, address: '' });
  const [editFinancialsModal, setEditFinancialsModal] = useState({ isOpen: false, orderId: null, total: '', deliveryFee: '' });

  // Edit Order Steps Modal States
  const [editOrderStepsModal, setEditOrderStepsModal] = useState({ isOpen: false, orderId: null });
  const [editOrderStepsActiveTab, setEditOrderStepsActiveTab] = useState('items');
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editOrderPackagingId, setEditOrderPackagingId] = useState('');
  const [editOrderDeliveryId, setEditOrderDeliveryId] = useState('');
  const [editOrderRecipientName, setEditOrderRecipientName] = useState('');
  const [editOrderRecipientPhone, setEditOrderRecipientPhone] = useState('');
  const [editOrderAddress, setEditOrderAddress] = useState('');
  const [editOrderPostcode, setEditOrderPostcode] = useState('');
  const [editOrderCoords, setEditOrderCoords] = useState(null);
  const [editOrderDiscount, setEditOrderDiscount] = useState(0);
  const [editOrderPromoUsed, setEditOrderPromoUsed] = useState('None');
  const [editOrderDeliveryFee, setEditOrderDeliveryFee] = useState(0);

  // Map Modal & Geolocation States/Refs
  const [showMapModal, setShowMapModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState({ lat: 23.6850, lng: 90.3563 });
  const mapRef = useRef(null);

  // New item states inside the editor
  const [addItemProductId, setAddItemProductId] = useState('');
  const [addItemWeight, setAddItemWeight] = useState('');
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [trackingModal, setTrackingModal] = useState({ isOpen: false, orderId: null, value: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });
  const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', placeholder: '', value: '', action: null });
  const [showTrash, setShowTrash] = useState(false);

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
      await Promise.all([...selectedOrders].map(id => updateDoc(doc(db, 'orders', id), { status: newStatus })));
      setOrders(orders.map(o => selectedOrders.has(o.id) ? { ...o, status: newStatus } : o));
      toast.success(`${selectedOrders.size} order(s) marked as ${newStatus}`);
      setSelectedOrders(new Set());
    } catch {
      toast.error('Failed to update orders.');
    }
    setBatchUpdating(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status.');
    }
  };



  const parseWeight = (selectedWeightStr, fallbackWeight) => {
    if (!selectedWeightStr) return fallbackWeight;
    const kgMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*k?g/i);
    if (kgMatch) return Number(kgMatch[1]);
    const gMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*g/i);
    if (gMatch) return Number(gMatch[1]) / 1000;
    return fallbackWeight;
  };

  const handleCoordsChange = (key, val) => {
    setEditOrderCoords(prev => {
      const base = prev || { lat: 0, lng: 0 };
      return {
        ...base,
        [key]: val === '' ? '' : Number(val)
      };
    });
  };

  const handleOpenEditOrderSteps = (order) => {
    setEditOrderStepsModal({ isOpen: true, orderId: order.id });
    setEditOrderStepsActiveTab('items');
    setEditOrderItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    setEditOrderPackagingId(order.packagingOption?.id || '');
    setEditOrderDeliveryId(order.deliveryMethod?.id || '');
    setEditOrderRecipientName(order.deliveryName || order.customerName || '');
    setEditOrderRecipientPhone(order.deliveryPhone || '');
    setEditOrderAddress(order.deliveryAddress || '');
    setEditOrderPostcode(order.deliveryPostcode || '');
    setEditOrderCoords(order.deliveryCoords || null);
    setEditOrderDiscount(0);
    setEditOrderPromoUsed(order.promoUsed || 'None');
    setEditOrderDeliveryFee(Number(order.deliveryFee) || 0);
    setAddItemProductId('');
    setAddItemWeight('');
    setAddItemQuantity(1);
  };

  const editedTotalWeight = useMemo(() => {
    return editOrderItems.reduce((sum, item) => {
      const product = mangoes.find(p => p.id === item.id);
      const fallbackW = Number(product?.fixedWeight) || 1;
      const w = parseWeight(item.selectedWeight, fallbackW);
      return sum + (w * (Number(item.quantity) || 0));
    }, 0);
  }, [editOrderItems, mangoes]);

  const editedSubtotal = useMemo(() => {
    return editOrderItems.reduce((sum, item) => {
      const activePrice = Number(item.discountPrice) || Number(item.price) || 0;
      return sum + (activePrice * (Number(item.quantity) || 0));
    }, 0);
  }, [editOrderItems]);

  const editedPackagingCostInfo = useMemo(() => {
    const pkg = packagingOptions.find(p => p.id === editOrderPackagingId);
    if (!pkg || editedTotalWeight <= 0) return { units: 0, cost: 0, label: '', type: '' };
    const capacity = Number(pkg.maxCapacity) || 1;
    const units = Math.ceil(editedTotalWeight / capacity);
    const price = Number(pkg.price) || 0;
    return {
      units,
      cost: units * price,
      label: pkg.label,
      type: pkg.type,
      price: price
    };
  }, [editOrderPackagingId, editedTotalWeight, packagingOptions]);

  // Update delivery fee automatically based on chosen courier and weight
  useEffect(() => {
    if (editOrderStepsModal.isOpen) {
      const dlv = deliveryOptions.find(d => d.id === editOrderDeliveryId);
      if (dlv && editedTotalWeight > 0) {
        const perKgRate = Number(dlv.perKgRate) || 0;
        const firstKgPrice = Number(dlv.firstKgPrice) || 0;
        const extraKgRate = Number(dlv.extraKgRate) || 0;
        const fee = dlv.pricingType === 'per_kg'
          ? perKgRate * editedTotalWeight
          : firstKgPrice + (extraKgRate * Math.max(0, editedTotalWeight - 1));
        setEditOrderDeliveryFee(fee);
      } else if (!editOrderDeliveryId) {
        setEditOrderDeliveryFee(0);
      }
    }
  }, [editOrderDeliveryId, editedTotalWeight, deliveryOptions, editOrderStepsModal.isOpen]);

  const editedTotal = useMemo(() => {
    return Math.max(0, editedSubtotal + editedPackagingCostInfo.cost + editOrderDeliveryFee - editOrderDiscount);
  }, [editedSubtotal, editedPackagingCostInfo.cost, editOrderDeliveryFee, editOrderDiscount]);

  // Leaflet script/css loader & initialization for order shipping location pin map
  useEffect(() => {
    if (showMapModal) {
      const linkId = 'leaflet-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      
      const scriptId = 'leaflet-js';
      let script = document.getElementById(scriptId);
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = false;
        document.head.appendChild(script);
      }

      const initMap = () => {
        if (!window.L || mapRef.current) return;
        const container = document.getElementById('leaflet-map-container');
        if (!container) return;

        const startLat = editOrderCoords ? editOrderCoords.lat : 23.6850;
        const startLng = editOrderCoords ? editOrderCoords.lng : 90.3563;
        setPinnedCoords({ lat: startLat, lng: startLng });

        mapRef.current = window.L.map(container).setView([startLat, startLng], editOrderCoords ? 15 : 7);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapRef.current);

        mapRef.current.on('move', function () {
          const center = mapRef.current.getCenter();
          setPinnedCoords({ lat: center.lat, lng: center.lng });
        });
      };

      if (window.L) {
        initMap();
      } else {
        script.addEventListener('load', initMap);
      }

      return () => {
        if (script) script.removeEventListener('load', initMap);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }
  }, [showMapModal, editOrderCoords]);

  const handleConfirmMapPin = async () => {
    setEditOrderCoords({ lat: pinnedCoords.lat, lng: pinnedCoords.lng });
    
    // Reverse geocode to fill in address
    const loadingToast = toast.loading("Resolving pinned address...");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pinnedCoords.lat}&lon=${pinnedCoords.lng}&accept-language=en`,
        { headers: { 'User-Agent': 'VertexPicks/1.0' } }
      );
      if (!response.ok) throw new Error("Geocoding failed");
      const data = await response.json();
      let formattedAddress = "";
      if (data.address) {
        const { road, neighbourhood, town, city, state_district, state, postcode, country } = data.address;
        const parts = [
          road,
          neighbourhood,
          city || town,
          state_district,
          state,
          postcode,
          country
        ];
        formattedAddress = Array.from(new Set(parts)).filter(Boolean).join(', ');
        if (postcode) {
          setEditOrderPostcode(`Postal Code: ${postcode}`);
        }
      } else {
        formattedAddress = data.display_name || '';
      }
      if (formattedAddress) {
        setEditOrderAddress(formattedAddress.trim());
        toast.success("Address resolved!", { id: loadingToast });
      } else {
        toast.error("Couldn't resolve address text. Coordinates saved.", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to resolve address. Coordinates saved.", { id: loadingToast });
    } finally {
      setShowMapModal(false);
    }
  };

  const selectedProductForAdd = useMemo(() => {
    return mangoes.find(p => p.id === addItemProductId);
  }, [addItemProductId, mangoes]);

  useEffect(() => {
    if (selectedProductForAdd) {
      if (selectedProductForAdd.weightOptions && selectedProductForAdd.weightOptions.length > 0) {
        setAddItemWeight(selectedProductForAdd.weightOptions[0]);
      } else if (selectedProductForAdd.fixedWeight) {
        setAddItemWeight(`${selectedProductForAdd.fixedWeight}kg Box`);
      } else {
        setAddItemWeight('');
      }
    } else {
      setAddItemWeight('');
    }
  }, [selectedProductForAdd]);

  const handleAddItemToOrder = () => {
    if (!addItemProductId) return toast.error("Please select a product!");
    const prod = selectedProductForAdd;
    if (!prod) return;

    const existingIndex = editOrderItems.findIndex(item => 
      item.id === prod.id && item.selectedWeight === addItemWeight
    );

    if (existingIndex > -1) {
      const updated = [...editOrderItems];
      updated[existingIndex].quantity = (Number(updated[existingIndex].quantity) || 0) + Number(addItemQuantity);
      setEditOrderItems(updated);
    } else {
      setEditOrderItems([
        ...editOrderItems,
        {
          id: prod.id,
          name: prod.name,
          price: Number(prod.price) || 0,
          discountPrice: Number(prod.discountPrice) || 0,
          quantity: Number(addItemQuantity) || 1,
          selectedWeight: addItemWeight,
          image: prod.image || (prod.images && prod.images[0]) || ''
        }
      ]);
    }
    toast.success(`${prod.name} added to order list.`);
    setAddItemProductId('');
    setAddItemQuantity(1);
  };

  const handleUpdateItemQty = (idx, qty) => {
    const updated = [...editOrderItems];
    updated[idx].quantity = qty === '' ? '' : Math.max(1, parseInt(qty) || 1);
    setEditOrderItems(updated);
  };

  const handleUpdateItemWeight = (idx, weight) => {
    const updated = [...editOrderItems];
    updated[idx].selectedWeight = weight;
    setEditOrderItems(updated);
  };

  const handleRemoveItem = (idx) => {
    setEditOrderItems(editOrderItems.filter((_, i) => i !== idx));
  };

  const handleSaveOrderSteps = async (e) => {
    e.preventDefault();
    if (editOrderItems.length === 0) {
      return toast.error("An order must have at least one item!");
    }
    if (!editOrderRecipientName.trim() || !editOrderRecipientPhone.trim() || !editOrderAddress.trim()) {
      return toast.error("Recipient Name, Phone, and Address are required!");
    }

    try {
      const orderRef = doc(db, 'orders', editOrderStepsModal.orderId);
      const updatedData = {
        deliveryName: editOrderRecipientName.trim(),
        customerName: editOrderRecipientName.trim(),
        deliveryPhone: editOrderRecipientPhone.trim(),
        deliveryAddress: editOrderAddress.trim(),
        deliveryPostcode: editOrderPostcode.trim(),
        deliveryCoords: editOrderCoords,
        items: editOrderItems,
        subtotal: editedSubtotal,
        totalWeight: editedTotalWeight,
        packagingOption: editOrderPackagingId ? {
          id: editOrderPackagingId,
          label: editedPackagingCostInfo.label,
          type: editedPackagingCostInfo.type,
          unitsNeeded: editedPackagingCostInfo.units,
          unitPrice: editedPackagingCostInfo.price,
          totalCost: editedPackagingCostInfo.cost
        } : null,
        packagingCost: editedPackagingCostInfo.cost,
        deliveryMethod: editOrderDeliveryId ? {
          id: editOrderDeliveryId,
          label: deliveryOptions.find(d => d.id === editOrderDeliveryId)?.label || '',
          totalCost: editOrderDeliveryFee
        } : null,
        deliveryFee: editOrderDeliveryFee,
        discount: editOrderDiscount,
        promoUsed: editOrderPromoUsed,
        total: editedTotal
      };

      await updateDoc(orderRef, updatedData);
      setOrders(orders.map(o => o.id === editOrderStepsModal.orderId ? { ...o, ...updatedData } : o));
      toast.success('Order steps updated successfully!');
      setEditOrderStepsModal({ isOpen: false, orderId: null });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update order steps: ' + err.message);
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingModal.value.trim()) return;
    try {
      await updateDoc(doc(db, 'orders', trackingModal.orderId), { trackingLink: trackingModal.value });
      setOrders(orders.map(o => o.id === trackingModal.orderId ? { ...o, trackingLink: trackingModal.value } : o));
      toast.success('Tracking link saved!');
      setTrackingModal({ isOpen: false, orderId: null, value: '' });
    } catch {
      toast.error('Failed to save tracking link.');
    }
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

  const handlePrintSingleOrder = (orderId) => {
    const prev = new Set(selectedOrders);
    setSelectedOrders(new Set([orderId]));
    setTimeout(() => {
      window.print();
      setSelectedOrders(prev);
    }, 150);
  };

  const handleAddTracking = (id) => {
    setPromptModal({
      isOpen: true,
      title: "Add Tracking Link",
      placeholder: "e.g. Pathao/Steadfast URL",
      value: "",
      action: (url) => {
        if (url) {
          updateDoc(doc(db, 'orders', id), { trackingLink: url });
          setOrders(orders.map(o => o.id === id ? { ...o, trackingLink: url } : o));
        }
      }
    });
  };

  const createWhatsAppLink = (order) => {
    const phone = order.deliveryPhone;
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    
    let itemsText = '';
    if (order.items && order.items.length > 0) {
      itemsText = order.items.map((item, index) => {
        const itemName = item.name || 'Item';
        const qty = item.quantity || 1;
        const price = (item.discountPrice || item.price || 0) * qty;
        return `${index + 1}. ${itemName} x${qty} - ৳${price}`;
      }).join('\n');
    }
    
    const subtotal = order.subtotal || Math.max(0, (order.total || 0) - (order.deliveryFee || 0) + (order.discount || 0));
    
    let fullAddress = order.deliveryAddress || 'N/A';
    if (order.deliveryPostcode) {
      fullAddress += `\n${order.deliveryPostcode}`;
    }
    
    let message = `হ্যালো, Vertex Picks থেকে বলছি! আপনার অর্ডারটি কনফার্ম করার জন্য মেসেজ দিচ্ছি।\n\n`;
    message += `Order Details:\n${itemsText}\n\n`;
    message += `Subtotal: ৳${subtotal}\n`;
    message += `Delivery: ৳${order.deliveryFee || 0}\n`;
    if (order.discount > 0) {
      message += `Discount: -৳${order.discount}\n`;
    }
    message += `Total: ৳${order.total || 0}\n\n`;
    message += `আপনার ডেলিভারি ঠিকানা: ${fullAddress}।\n\n`;
    message += `অর্ডারটি কি কনফার্ম করব?`;
    
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isAndroid) {
      return `intent://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
    } else if (isIOS) {
      return `whatsapp-business://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };



  const [leadsSearch, setLeadsSearch] = useState('');
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21 });
  const [storeName, setStoreName] = useState('Vertex Picks');
  const [contactEmail, setContactEmail] = useState('hello@vertexpicks.com');
  const [footerDesc, setFooterDesc] = useState('Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.');
  const [contactPhone, setContactPhone] = useState('+880 1581-221084');
  const [contactAddress, setContactAddress] = useState('Rajshahi, Bangladesh');
  const [floatingWhatsappPhone, setFloatingWhatsappPhone] = useState('8801581221084');

  // Homepage Customizer states
  const [marqueeItems, setMarqueeItems] = useState([
    '🌿 100% tree-bagged & chemical-free',
    '⚡ Same-day dispatch before 12pm',
    '🎁 Eid gift boxes available',
    '🔄 Full refund if not satisfied',
    '⭐ 4.9/5 rating from 500+ customers'
  ]);
  const [newMarqueeText, setNewMarqueeText] = useState('');
  const [editingMarqueeIndex, setEditingMarqueeIndex] = useState(null);
  const [editingMarqueeText, setEditingMarqueeText] = useState('');

  // Hero Copy States
  const [heroBadge1, setHeroBadge1] = useState('🥭 Season 2026');
  const [heroBadge2, setHeroBadge2] = useState('🌿 100% Chemical-Free');
  const [heroBadge3, setHeroBadge3] = useState('⚡ Same-Day Dispatch');
  const [heroTitleLine1, setHeroTitleLine1] = useState('The Finest Rajshahi');
  const [heroTitleLine2, setHeroTitleLine2] = useState('Mangoes. Delivered');
  const [heroTitleLine3, setHeroTitleLine3] = useState('Fresh.');
  const [heroSubtitle, setHeroSubtitle] = useState('Hand-picked, tree-bagged, and shipped within hours. No middlemen, no cold storage — just pure mango perfection from Rajshahi to your door.');
  const [heroTrust1, setHeroTrust1] = useState('⭐ <strong>4.9/5</strong> from 500+ reviews');
  const [heroTrust2, setHeroTrust2] = useState('📦 <strong>2,000+</strong> orders shipped');
  const [heroTrust3, setHeroTrust3] = useState('🔄 <strong>100%</strong> refund guarantee');

  // Promise Section States
  const [promiseTitle, setPromiseTitle] = useState('✦ The Vertex <span>Promise</span>');
  const [promiseFeature1Title, setPromiseFeature1Title] = useState('Chemical-Free');
  const [promiseFeature1Text, setPromiseFeature1Text] = useState('Tree-bagged from the start. Zero pesticides, zero artificial ripening.');
  const [promiseFeature1Icon, setPromiseFeature1Icon] = useState('🌿');

  const [promiseFeature2Title, setPromiseFeature2Title] = useState('Same-Day Dispatch');
  const [promiseFeature2Text, setPromiseFeature2Text] = useState('Picked at dawn, shipped by noon. Freshness measured in hours, not days.');
  const [promiseFeature2Icon, setPromiseFeature2Icon] = useState('⚡');

  const [promiseFeature3Title, setPromiseFeature3Title] = useState('A-Grade Only');
  const [promiseFeature3Text, setPromiseFeature3Text] = useState('We reject 40% of fruit. Only perfect size, colour, and sweetness passes.');
  const [promiseFeature3Icon, setPromiseFeature3Icon] = useState('🏅');

  const [promiseFeature4Title, setPromiseFeature4Title] = useState('Full Refund');
  const [promiseFeature4Text, setPromiseFeature4Text] = useState('Not happy? 100% refund, no questions asked. That\'s our commitment.');
  const [promiseFeature4Icon, setPromiseFeature4Icon] = useState('🔄');

  // Promo Banners State
  const [promoBanners, setPromoBanners] = useState([
    {
      id: '1',
      label: 'Limited Stock',
      title: 'Himsagar<br />Pre-Order Open',
      btnText: 'Order Now →',
      btnLink: '/shop',
      emoji: '🥭',
      color1: '#FF7A35',
      color2: '#E8540A'
    },
    {
      id: '2',
      label: 'Perfect for Gifting',
      title: 'Eid Gift<br />Boxes 2026',
      btnText: 'Explore →',
      btnLink: '/shop',
      emoji: '🎁',
      color1: '#2A9445',
      color2: '#1B6B2F'
    }
  ]);


  // --- CRUD SEARCH / FILTER STATES ---
  const [productSearch, setProductSearch] = useState('');
  const [productSectionFilter, setProductSectionFilter] = useState('All Varieties');
  const [productStockFilter, setProductStockFilter] = useState('All Status');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All Status');
  const [, setOrdersPage] = useState(1);

  // Reviews soft-delete (trash + undo)
  const [trashedReviews, setTrashedReviews] = useState({}); // { reviewId: { review, timer } }
  const undoTimersRef = { current: {} };

  // Inline stock editing
  const [editingStock, setEditingStock] = useState(null); // { productId, value }

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);

  const [expandProductSales, setExpandProductSales] = useState(false);

  // Analytics Live States derived via useMemo
  const {
    analyticsOrdersByCity,
    analyticsRevenueByProduct,
    analyticsMonthlyRevenue,
    analyticsLoading
  } = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        analyticsOrdersByCity: [],
        analyticsRevenueByProduct: [],
        analyticsMonthlyRevenue: [],
        analyticsLoading: false
      };
    }

    const cityMap = {};
    const productMap = {};
    const monthMap = {};
    
    orders.filter(o => o.status !== 'Cancelled').forEach(o => {
      const addrLower = (typeof o.deliveryAddress === 'string' ? o.deliveryAddress : '').toLowerCase();
      let city;
      if (addrLower.includes('dhaka')) city = 'Dhaka';
      else if (addrLower.includes('rajshahi')) city = 'Rajshahi';
      else if (addrLower.includes('chattogram') || addrLower.includes('chittagong')) city = 'Chattogram';
      else if (addrLower.includes('sylhet')) city = 'Sylhet';
      else if (addrLower.includes('khulna')) city = 'Khulna';
      else if (addrLower.includes('barishal') || addrLower.includes('barisal')) city = 'Barishal';
      else if (addrLower.includes('rangpur')) city = 'Rangpur';
      else if (addrLower.includes('mymensingh')) city = 'Mymensingh';
      else if (addrLower.includes('gazipur')) city = 'Gazipur';
      else if (addrLower.includes('narayanganj')) city = 'Narayanganj';
      else if (addrLower.includes('savar')) city = 'Savar';
      else city = 'Other';
      
      cityMap[city] = (cityMap[city] || 0) + 1;
      
      (o.items || []).forEach(item => {
        const product = item.name || item.title || 'Unknown Product';
        const itemRevenue = (Number(item.discountPrice) || Number(item.price) || 0) * (Number(item.quantity) || 1);
        productMap[product] = (productMap[product] || 0) + itemRevenue;
      });
      
      if (o.createdAt) {
        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt);
        const month = d.toLocaleString('en-US', { month: 'short' });
        monthMap[month] = (monthMap[month] || 0) + (Number(o.total) || 0);
      }
    });

    const totalValidOrders = Object.values(cityMap).reduce((a, b) => a + b, 0) || 1;
    const ordersByCity = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, val: count, fill: `${((count / totalValidOrders) * 100).toFixed(0)}%` }));

    const sortedProductsList = Object.entries(productMap).sort((a, b) => b[1] - a[1]);
    const maxProduct = sortedProductsList.length > 0 ? sortedProductsList[0][1] : 1;
    const revenueByProduct = sortedProductsList.map(([name, revenue]) => ({ name, revenue, fill: `${((revenue / maxProduct) * 100).toFixed(0)}%` }));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedMonths = Object.entries(monthMap).sort((a, b) => monthNames.indexOf(a[0]) - monthNames.indexOf(b[0]));
    const monthlyRevenue = sortedMonths.map(([name, revenue]) => ({ name, revenue }));

    return {
      analyticsOrdersByCity: ordersByCity,
      analyticsRevenueByProduct: revenueByProduct,
      analyticsMonthlyRevenue: monthlyRevenue,
      analyticsLoading: false
    };
  }, [orders]);

  // --- CRUD ACTION MODALS STATES ---
  // 1. Add / Edit Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [activeProdFormTab, setActiveProdFormTab] = useState('basic');
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState(100);
  const [prodDiscountPrice, setProdDiscountPrice] = useState('');
  const [prodStock, setProdStock] = useState(50);
  const [prodCategories, setProdCategories] = useState([]);
  const [prodVariety, setProdVariety] = useState([]);
  const [adminCategories, setAdminCategories] = useState([]);
  const [adminFilters, setAdminFilters] = useState({ rating: [], season: [], weight: [], priceRange: [], variety: [] });
  const [prodSku, setProdSku] = useState('');
  const [prodMinThreshold, setProdMinThreshold] = useState(10);
  const [prodSeason, setProdSeason] = useState([]);
  const [prodImages, setProdImages] = useState(['']);
  const [prodDescription, setProdDescription] = useState('');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodFixedWeight, setProdFixedWeight] = useState([]);
  const [weightOptions, setWeightOptions] = useState([]);
  const [prodBadge, setProdBadge] = useState('');

  const [prodTrustStrip, setProdTrustStrip] = useState([
    { title: 'Chemical-Free', sub: 'Guaranteed' },
    { title: 'Same-Day', sub: 'Dispatch' },
    { title: '100% Refund', sub: 'Guarantee' }
  ]);
  const [prodDeliveryInfo, setProdDeliveryInfo] = useState({ dispatch: 'order before 12pm', metro: '৳60 delivery fee', packaging: 'no plastic' });
  const [prodFarmer, setProdFarmer] = useState({ name: 'Abdul Karim — Lead Farmer', bio: 'Rajshahi Orchards · 15+ years growing premium mangoes', badge: 'Verified Farmer Partner' });
  const [prodSpecs, setProdSpecs] = useState({ origin: 'Rajshahi, Bangladesh', sweetness: '⭐⭐⭐⭐⭐ Very High', fiber: 'Fibreless', preservation: 'No chemicals. Tree-bagged.', shelfLife: '5–7 days at room temp', bestFor: 'Eating fresh, juicing, desserts' });
  const [prodHighlights, setProdHighlights] = useState([
    'Handpicked at peak ripeness for maximum sweetness and aroma', 
    'Tree-bagged from early growth — zero pesticides, zero artificial chemicals', 
    'Sorted and graded by hand — only A-grade fruit ships',
    'Eco-friendly packaging — no styrofoam, no single-use plastic',
    'Dispatched within hours of picking — freshness guaranteed'
  ]);
  const [prodSteps, setProdSteps] = useState([
    'Mangoes are tree-bagged at young stage to prevent pesticide exposure',
    'Hand-picked at dawn when sugar content is highest',
    'Graded for size, colour, and aroma — only A-grade passes',
    'Packed in eco-friendly boxes and dispatched same morning'
  ]);

  // 2. Add Promo Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editPromoId, setEditPromoId] = useState(null);
  const [editPromoUsedCount, setEditPromoUsedCount] = useState(0);
  const [editPromoCreatedAt, setEditPromoCreatedAt] = useState(null);
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState('percent');
  const [coupValue, setCoupValue] = useState(10);
  const [coupMinOrder, setCoupMinOrder] = useState(500);
  const [coupLimit, setCoupLimit] = useState(100);
  const [coupExpires, setCoupExpires] = useState('');

  const openPromoModal = (promo = null) => {
    if (promo) {
      setEditPromoId(promo.id);
      setCoupCode(promo.code);
      setCoupType(promo.type);
      setCoupValue(promo.value);
      setCoupMinOrder(promo.minOrder);
      setCoupLimit(promo.limit);
      setCoupExpires(promo.expires);
      setEditPromoUsedCount(promo.usedCount || 0);
      setEditPromoCreatedAt(promo.createdAt || null);
    } else {
      setEditPromoId(null);
      setCoupCode('');
      setCoupType('percent');
      setCoupValue(10);
      setCoupMinOrder(500);
      setCoupLimit(100);
      setCoupExpires('');
      setEditPromoUsedCount(0);
      setEditPromoCreatedAt(null);
    }
    setShowCouponModal(true);
  };

  // 3. View Order Details Modal
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);



  // Fetch Master Dataset
  const fetchData = async () => {
    try {
      // 1. Fetch mangoes
      const mangoesSnap = await getDocs(collection(db, 'mangoes'));
      const productsList = [];
      mangoesSnap.docs.forEach(d => {
        if (d.id === 'CATEGORIES') {
          const list = d.data().list || [];
          setAdminCategories(list.length > 0 ? list : ['Mangoes', 'Gift Boxes', 'Pickles']);
        } else if (d.id === 'FILTERS') {
          const data = d.data() || {};
          const isFunctionallyEmpty = (!data.variety || data.variety.length === 0) && 
                                      (!data.weight || data.weight.length === 0) && 
                                      (!data.season || data.season.length === 0);
          if (isFunctionallyEmpty) {
            setAdminFilters({
              variety: ['Himsagar', 'Langra', 'Fazli', 'Gopalbhog', 'Amrapali', 'Gift Box'],
              weight: ['5kg', '10kg', '20kg'],
              season: ['Early Season', 'Peak Season', 'Late Season'],
              priceRange: ['0-500', '501-1000', '1000+']
            });
          } else {
            setAdminFilters({
              rating: data.rating || [], season: data.season || [], weight: data.weight || [], priceRange: data.priceRange || [], variety: data.variety || []
            });
          }
        } else if (d.id !== 'STORE_SECTIONS' && d.id !== 'STORE_SETTINGS' && d.id !== 'NAVBAR_TABS' && d.id !== 'VARIETIES' && d.id !== 'PACKAGING_OPTIONS' && d.id !== 'DELIVERY_OPTIONS') {
          productsList.push({ id: d.id, ...d.data() });
        }
      });
      productsList.sort((a, b) => (a.order || 0) - (b.order || 0));
      setMangoes(productsList);

      // 2. Fetch orders (initial load only via getDocs — real-time handled by onSnapshot below)
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const ordersList = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordersList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
      setOrders(ordersList);
      // Mark page load time so we only alert on FUTURE orders
      pageLoadTime.current = Date.now();

      // 3. Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersList);

      // 4. Fetch promos
      const promosSnap = await getDocs(collection(db, 'promos'));
      const promosList = promosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPromos(promosList);

      // 4b. Fetch leads
      try {
        const leadsSnap = await getDocs(collection(db, 'leads'));
        const leadsList = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        leadsList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setLeads(leadsList);
      } catch (err) {
        console.error('Failed to load leads:', err);
      }

      // 6. Fetch packaging options
      try {
        const pkgSnap = await getDoc(doc(db, 'mangoes', 'PACKAGING_OPTIONS'));
        if (pkgSnap.exists() && Array.isArray(pkgSnap.data().options)) {
          setPackagingOptions(pkgSnap.data().options);
        }
      } catch (err) {
        console.error('Failed to load packaging options:', err);
      }

      // 7. Fetch delivery options
      try {
        const dlvSnap = await getDoc(doc(db, 'mangoes', 'DELIVERY_OPTIONS'));
        if (dlvSnap.exists() && Array.isArray(dlvSnap.data().options)) {
          setDeliveryOptions(dlvSnap.data().options);
        }
      } catch (err) {
        console.error('Failed to load delivery options:', err);
      }

      // 5. Fetch settings
      const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
      if (configSnap.exists()) {
        const cData = configSnap.data();
        setStoreConfig({
          baseDeliveryFee: cData.baseDeliveryFee ?? 110,
          perKgFee: cData.perKgFee ?? 21,
          automatedLeadEmail: cData.automatedLeadEmail || "আসসালামু আলাইকুম,\nVertex Picks-এর আর্লি অ্যাক্সেস লিস্টে যুক্ত হওয়ার জন্য আপনাকে ধন্যবাদ! আমাদের নতুন সিজনের প্রিমিয়াম রাজশাহীর আম যখনই স্টকে আসবে, আমরা সবার আগে আপনাকে জানাবো। \n\nযেকোনো প্রয়োজনে আমাদের সাথে যোগাযোগ করতে পারেন।\nধন্যবাদ,\nVertex Picks টিম",
          automatedLeadWhatsapp: cData.automatedLeadWhatsapp || "আসসালামু আলাইকুম! Vertex Picks-এর আর্লি অ্যাক্সেস লিস্টে যুক্ত হওয়ার জন্য ধন্যবাদ 🥭 নতুন সিজনের আম স্টকে আসলে আমরা আপনাকে এখানেই জানিয়ে দিবো!"
        });
        setStoreName(cData.storeName || 'Vertex Picks');
        setContactEmail(cData.contactEmail || 'hello@vertexpicks.com');
        setFooterDesc(cData.footerDesc || 'Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.');
        setContactPhone(cData.contactPhone || '+880 1581-221084');
        setContactAddress(cData.contactAddress || 'Rajshahi, Bangladesh');
        setFloatingWhatsappPhone(cData.floatingWhatsappPhone || '8801581221084');


        // Fetch customizer text settings if they exist
        if (cData.marqueeItems && Array.isArray(cData.marqueeItems)) setMarqueeItems(cData.marqueeItems);
        if (cData.heroBadge1 !== undefined) setHeroBadge1(cData.heroBadge1);
        if (cData.heroBadge2 !== undefined) setHeroBadge2(cData.heroBadge2);
        if (cData.heroBadge3 !== undefined) setHeroBadge3(cData.heroBadge3);
        if (cData.heroTitleLine1 !== undefined) setHeroTitleLine1(cData.heroTitleLine1);
        if (cData.heroTitleLine2 !== undefined) setHeroTitleLine2(cData.heroTitleLine2);
        if (cData.heroTitleLine3 !== undefined) setHeroTitleLine3(cData.heroTitleLine3);
        if (cData.heroSubtitle !== undefined) setHeroSubtitle(cData.heroSubtitle);
        if (cData.heroTrust1 !== undefined) setHeroTrust1(cData.heroTrust1);
        if (cData.heroTrust2 !== undefined) setHeroTrust2(cData.heroTrust2);
        if (cData.heroTrust3 !== undefined) setHeroTrust3(cData.heroTrust3);
        if (cData.promiseTitle !== undefined) setPromiseTitle(cData.promiseTitle);
        if (cData.promiseFeature1Title !== undefined) setPromiseFeature1Title(cData.promiseFeature1Title);
        if (cData.promiseFeature1Text !== undefined) setPromiseFeature1Text(cData.promiseFeature1Text);
        if (cData.promiseFeature1Icon !== undefined) setPromiseFeature1Icon(cData.promiseFeature1Icon);
        if (cData.promiseFeature2Title !== undefined) setPromiseFeature2Title(cData.promiseFeature2Title);
        if (cData.promiseFeature2Text !== undefined) setPromiseFeature2Text(cData.promiseFeature2Text);
        if (cData.promiseFeature2Icon !== undefined) setPromiseFeature2Icon(cData.promiseFeature2Icon);
        if (cData.promiseFeature3Title !== undefined) setPromiseFeature3Title(cData.promiseFeature3Title);
        if (cData.promiseFeature3Text !== undefined) setPromiseFeature3Text(cData.promiseFeature3Text);
        if (cData.promiseFeature3Icon !== undefined) setPromiseFeature3Icon(cData.promiseFeature3Icon);
        if (cData.promiseFeature4Title !== undefined) setPromiseFeature4Title(cData.promiseFeature4Title);
        if (cData.promiseFeature4Text !== undefined) setPromiseFeature4Text(cData.promiseFeature4Text);
        if (cData.promiseFeature4Icon !== undefined) setPromiseFeature4Icon(cData.promiseFeature4Icon);
        
        if (cData.promoBanners && Array.isArray(cData.promoBanners)) {
          setPromoBanners(cData.promoBanners);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load admin dataset:', err);
      setLoading(false);
    }
  };

  // Initial data load on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Real-time orders listener — fires on new order creation after page load
  useEffect(() => {
    // Wait until initial fetch is done before subscribing
    if (loading) return;
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = { id: change.doc.id, ...change.doc.data() };
          const orderTime = order.createdAt?.toMillis
            ? order.createdAt.toMillis()
            : order.createdAt?.seconds
              ? order.createdAt.seconds * 1000
              : typeof order.createdAt === 'string'
                ? new Date(order.createdAt).getTime()
                : Date.now();
          // Only alert for orders created AFTER this admin page loaded
          if (orderTime > pageLoadTime.current) {
            setOrders(prev => {
              if (prev.find(o => o.id === order.id)) return prev;
              return [order, ...prev];
            });
            setNewOrderAlert(prev => ({
              show: true,
              orders: [order, ...prev.orders].slice(0, 5),
              count: prev.count + 1
            }));
            setUnreadOrderCount(prev => prev + 1);
            playNotificationChime();
            toast.success(
              `📦 New order! ৳${order.total || 0} from ${order.customerName || order.deliveryName || 'customer'}`,
              { duration: 6000, icon: '📦' }
            );
          }
        }
      });
    });
    ordersListenerRef.current = unsubscribe;
    return () => unsubscribe();
  }, [loading]);

  // Seed the 4 default products into Firestore if DB has no products
  useEffect(() => {
    if (loading) return; // wait for fetchData to complete
    if (mangoes.length > 0) return; // already has products

    const seedDefaults = async () => {
      const seeds = [
        { id: 'seed_himsagar', name: 'Himsagar Premium Dozen', price: 850, discountPrice: null, stock: 100, section: 'Himsagar', variety: 'Himsagar', season: 'Peak', grade: 'A-Grade', fixedWeight: 1, featured: true, images: ['/assets/placeholder-mango.png'], description: 'Hand-picked, tree-bagged Himsagar — the king of mangoes from Rajshahi.' },
        { id: 'seed_langra', name: 'Langra Fresh Dozen', price: 700, discountPrice: null, stock: 80, section: 'Langra', variety: 'Langra', season: 'Peak', grade: 'A-Grade', fixedWeight: 1, featured: true, images: ['/assets/placeholder-mango.png'], description: 'Sweet and aromatic Langra from the orchards of Rajshahi.' },
        { id: 'seed_fazli', name: 'Fazli Large Dozen', price: 600, discountPrice: null, stock: 60, section: 'Fazli', variety: 'Fazli', season: 'Late', grade: 'Premium', fixedWeight: 1, featured: true, images: ['/assets/placeholder-mango.png'], description: 'Late season Fazli — large, juicy and fibre-free.' },
        { id: 'seed_giftbox', name: 'Eid Premium Gift Box', price: 1800, discountPrice: null, stock: 40, section: 'Gift Box', variety: 'Gift Box', season: 'Peak', grade: 'Premium', fixedWeight: 2, featured: true, images: ['/assets/placeholder-mango.png'], description: 'Curated premium gift box — perfect for Eid and special occasions.' },
      ];
      try {
        await Promise.all(seeds.map((s, i) => setDoc(doc(db, 'mangoes', s.id), { ...s, order: i + 1 }, { merge: true })));
        toast.success('🌱 Default products added to Firestore!');
        fetchData();
      } catch (err) { console.error('Seed failed:', err); }
    };
    seedDefaults();
  }, [loading, mangoes.length]);


  // Completion of God Mode Teleport redirect loop
  useEffect(() => {
    if (mangoes.length > 0) {
      const teleportId = localStorage.getItem('teleportEditId');
      if (teleportId) {
        const prod = mangoes.find(m => m.id === teleportId);
        if (prod) {
          handleEditProductClick(prod);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setActiveAdminTab('products');
          toast.success(`Teleported: Modifying ${prod.name}`);
        }
        localStorage.removeItem('teleportEditId');
      }
    }
  }, [mangoes]);

  const handleProdImageChange = (index, value) => {
    const next = [...prodImages];
    next[index] = value;
    setProdImages(next);
  };
  const addProdImageField = () => setProdImages([...prodImages, '']);
  const removeProdImageField = (index) => setProdImages(prodImages.filter((_, i) => i !== index));

  // --- CRUD ACTIONS METHODS ---
  // Product Save/Update
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice) {
      return toast.error('Name and Price are required.');
    }
    try {
      const pId = editProductId || generateUniqueId();
      const cleanImages = prodImages.map(img => img?.trim()).filter(Boolean);
      const finalImages = cleanImages.length > 0 ? cleanImages : [];
      const cleanHighlights = prodHighlights.filter(h => h?.trim() !== '');
      const cleanSteps = prodSteps.filter(s => s?.trim() !== '');
      const pData = {
        name: prodName,
        price: Number(prodPrice),
        discountPrice: prodDiscountPrice === '' ? null : Number(prodDiscountPrice),
        stock: Number(prodStock),
        category: prodCategories,
        variety: prodVariety,
        sku: prodSku || `VP-${prodCategories.length > 0 ? prodCategories[0].slice(0,3).toUpperCase() : 'MGO'}-${pId.slice(-3).toUpperCase()}`,
        minThreshold: Number(prodMinThreshold),
        season: prodSeason,
        images: finalImages,
        image: finalImages[0] || '',
        description: prodDescription || 'Fresh premium bagged mango from Rajshahi orchards.',
        featured: prodFeatured,
        fixedWeight: prodFixedWeight,
        weightOptions: weightOptions.map(opt => opt?.trim()).filter(Boolean),
        order: editProductId ? (mangoes.find(m => m.id === editProductId)?.order ?? mangoes.length + 1) : mangoes.length + 1,
        badge: prodBadge ? prodBadge.trim() : '',
        trustStrip: prodTrustStrip,
        deliveryInfo: prodDeliveryInfo,
        farmer: prodFarmer,
        specs: prodSpecs,
        highlights: cleanHighlights,
        steps: cleanSteps
      };
      
      await setDoc(doc(db, 'mangoes', pId), pData, { merge: true });
      toast.success(editProductId ? 'Product details updated!' : 'New product created successfully!');
      
      setShowProductModal(false);
      setEditProductId(null);
      clearProductForm();
      fetchData();
    } catch (err) {
      console.error('Product save failed:', err);
      toast.error('Failed to save product details.');
    }
  };

  function handleEditProductClick(p) {
    setEditProductId(p.id);
    setActiveProdFormTab('basic');
    setProdName(p.name || '');
    setProdPrice(p.price || 100);
    setProdDiscountPrice(p.discountPrice || '');
    setProdStock(p.stock || 50);
    setProdCategories(Array.isArray(p.category) ? p.category : [p.category || p.section || p.variety].filter(Boolean));
    setProdVariety(Array.isArray(p.variety) ? p.variety : [p.variety].filter(Boolean));
    setProdSku(p.sku || '');
    setProdMinThreshold(p.minThreshold || 10);
    setProdSeason(Array.isArray(p.season) ? p.season : [p.season].filter(Boolean));
    const loadedImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : (p.image ? [p.image] : ['']);
    setProdImages(loadedImages);
    setProdDescription(p.description || '');
    setProdFeatured(p.featured || false);
    setProdFixedWeight(Array.isArray(p.fixedWeight) ? p.fixedWeight : [p.fixedWeight].filter(Boolean));
    setWeightOptions(Array.isArray(p.weightOptions) ? p.weightOptions : []);
    
    setProdBadge(p.badge || '');

    setProdTrustStrip(p.trustStrip || [
      { title: 'Chemical-Free', sub: 'Guaranteed' },
      { title: 'Same-Day', sub: 'Dispatch' },
      { title: '100% Refund', sub: 'Guarantee' }
    ]);
    setProdDeliveryInfo(p.deliveryInfo || { dispatch: 'order before 12pm', metro: '৳60 delivery fee', packaging: 'no plastic' });
    setProdFarmer(p.farmer || { name: 'Abdul Karim — Lead Farmer', bio: 'Rajshahi Orchards · 15+ years growing premium mangoes', badge: 'Verified Farmer Partner' });
    setProdSpecs(p.specs || { origin: 'Rajshahi, Bangladesh', sweetness: '⭐⭐⭐⭐⭐ Very High', fiber: 'Fibreless', preservation: 'No chemicals. Tree-bagged.', shelfLife: '5–7 days at room temp', bestFor: 'Eating fresh, juicing, desserts' });
    setProdHighlights(p.highlights?.length ? p.highlights : [
      'Handpicked at peak ripeness for maximum sweetness and aroma', 
      'Tree-bagged from early growth — zero pesticides, zero artificial chemicals', 
      'Sorted and graded by hand — only A-grade fruit ships',
      'Eco-friendly packaging — no styrofoam, no single-use plastic',
      'Dispatched within hours of picking — freshness guaranteed'
    ]);
    setProdSteps(p.steps?.length ? p.steps : [
      'Mangoes are tree-bagged at young stage to prevent pesticide exposure',
      'Hand-picked at dawn when sugar content is highest',
      'Graded for size, colour, and aroma — only A-grade passes',
      'Packed in eco-friendly boxes and dispatched same morning'
    ]);
    setShowProductModal(true);
  }

  const handleDeleteProduct = async (pId, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'mangoes', pId));
        toast.success(`${name} removed successfully!`);
        fetchData();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete product.');
      }
    }
  };

  const clearProductForm = () => {
    setActiveProdFormTab('basic');
    setProdName('');
    setProdPrice(100);
    setProdDiscountPrice('');
    setProdStock(50);
    setProdCategories([]);
    setProdVariety([]);
    setProdSku('');
    setProdMinThreshold(10);
    setProdSeason([]);
    setProdImages(['']);
    setProdDescription('');
    setProdFeatured(false);
    setProdFixedWeight([]);
    setWeightOptions([]);
    
    setProdBadge('');

    setProdTrustStrip([
      { title: 'Chemical-Free', sub: 'Guaranteed' },
      { title: 'Same-Day', sub: 'Dispatch' },
      { title: '100% Refund', sub: 'Guarantee' }
    ]);
    setProdDeliveryInfo({ dispatch: 'order before 12pm', metro: '৳60 delivery fee', packaging: 'no plastic' });
    setProdFarmer({ name: 'Abdul Karim — Lead Farmer', bio: 'Rajshahi Orchards · 15+ years growing premium mangoes', badge: 'Verified Farmer Partner' });
    setProdSpecs({ origin: 'Rajshahi, Bangladesh', sweetness: '⭐⭐⭐⭐⭐ Very High', fiber: 'Fibreless', preservation: 'No chemicals. Tree-bagged.', shelfLife: '5–7 days at room temp', bestFor: 'Eating fresh, juicing, desserts' });
    setProdHighlights([
      'Handpicked at peak ripeness for maximum sweetness and aroma', 
      'Tree-bagged from early growth — zero pesticides, zero artificial chemicals', 
      'Sorted and graded by hand — only A-grade fruit ships',
      'Eco-friendly packaging — no styrofoam, no single-use plastic',
      'Dispatched within hours of picking — freshness guaranteed'
    ]);
    setProdSteps([
      'Mangoes are tree-bagged at young stage to prevent pesticide exposure',
      'Hand-picked at dawn when sugar content is highest',
      'Graded for size, colour, and aroma — only A-grade passes',
      'Packed in eco-friendly boxes and dispatched same morning'
    ]);
  };

  // Promo Creation / Update
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const upperCode = coupCode.toUpperCase();
      const cData = {
        code: upperCode,
        type: coupType,
        value: Number(coupValue),
        minOrder: Number(coupMinOrder),
        limit: Number(coupLimit),
        usedCount: editPromoId ? editPromoUsedCount : 0,
        expires: coupExpires || '2026-12-31',
        createdAt: editPromoId && editPromoCreatedAt ? editPromoCreatedAt : new Date()
      };
      
      if (editPromoId && editPromoId !== upperCode) {
        await deleteDoc(doc(db, 'promos', editPromoId));
      }

      await setDoc(doc(db, 'promos', upperCode), cData);
      toast.success(editPromoId ? `Promo Code ${upperCode} updated!` : `Promo Code ${upperCode} active!`);
      setShowCouponModal(false);
      openPromoModal(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save promo code.');
    }
  };

  const handleDeleteCoupon = async (cId) => {
    if (window.confirm(`Delete promo code ${cId}?`)) {
      try {
        await deleteDoc(doc(db, 'promos', cId));
        toast.success(`Promo code ${cId} deleted.`);
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleBlockUser = async (userId, currentBlockedStatus) => {
    try {
      const nextBlocked = !currentBlockedStatus;
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: nextBlocked
      });
      toast.success(nextBlocked ? 'User blocked successfully!' : 'User unblocked successfully!');
      fetchData();
    } catch (err) {
      console.error('Failed to toggle block status:', err);
      toast.error('Failed to update block status.');
    }
  };



  // Delivery Config Save
  const handleSaveStoreConfig = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), storeConfig, { merge: true });
      toast.success('Store baseline config saved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save baseline settings.');
    }
  };

  // General Config Save
  const handleSaveStoreGeneral = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
        storeName,
        contactEmail,
        floatingWhatsappPhone: floatingWhatsappPhone.trim()
      }, { merge: true });
      toast.success('General store configurations updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save general store configurations.');
    }
  };



  // Save custom UI text configurations
  const handleSaveUIConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
        marqueeItems,
        heroBadge1,
        heroBadge2,
        heroBadge3,
        heroTitleLine1,
        heroTitleLine2,
        heroTitleLine3,
        heroSubtitle,
        heroTrust1,
        heroTrust2,
        heroTrust3,
        promiseTitle,
        promiseFeature1Title,
        promiseFeature1Text,
        promiseFeature1Icon,
        promiseFeature2Title,
        promiseFeature2Text,
        promiseFeature2Icon,
        promiseFeature3Title,
        promiseFeature3Text,
        promiseFeature3Icon,
        promiseFeature4Title,
        promiseFeature4Text,
        promiseFeature4Icon,
        footerDesc,
        contactPhone,
        contactAddress,
        contactEmail,
        promoBanners,
      }, { merge: true });
      toast.success('🎉 Homepage & UI copy successfully published live!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish UI customizer configurations.');
    }
  };

  // Delete lead
  const handleDeleteLead = async (id) => {
    if (window.confirm("Are you sure you want to remove this subscriber/lead?")) {
      try {
        await deleteDoc(doc(db, 'leads', id));
        setLeads(prev => prev.filter(l => l.id !== id));
        toast.success('Subscriber/lead removed successfully.');
      } catch (err) {
        console.error(err);
        toast.error('Failed to remove subscriber/lead.');
      }
    }
  };

  const handleSaveLeadTemplates = async (e) => {
    e.preventDefault();
    try {
      const emailTemplate = e.target.elements.emailBody.value;
      const whatsappTemplate = e.target.elements.whatsappBody.value;

      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
        automatedLeadEmail: emailTemplate,
        automatedLeadWhatsapp: whatsappTemplate
      }, { merge: true });

      setStoreConfig(prev => ({
        ...prev,
        automatedLeadEmail: emailTemplate,
        automatedLeadWhatsapp: whatsappTemplate
      }));

      toast.success('Automated reply templates saved!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save templates.');
    }
  };

  // --- PACKAGING & DELIVERY CRUD ---
  const clearPackagingForm = () => {
    setEditPackagingId(null);
    setPkgLabel('');
    setPkgType('crate');
    setPkgQuality('normal');
    setPkgMinCapacity(20);
    setPkgMaxCapacity(25);
    setPkgPrice(150);
    setPkgActive(true);
  };

  const openPackagingModal = (pkg = null) => {
    if (pkg) {
      setEditPackagingId(pkg.id);
      setPkgLabel(pkg.label || '');
      setPkgType(pkg.type || 'crate');
      setPkgQuality(pkg.quality || 'normal');
      setPkgMinCapacity(pkg.minCapacity || 20);
      setPkgMaxCapacity(pkg.maxCapacity || 25);
      setPkgPrice(pkg.price || 150);
      setPkgActive(pkg.active !== false);
    } else {
      clearPackagingForm();
    }
    setShowPackagingModal(true);
  };

  const handleSavePackaging = async (e) => {
    e.preventDefault();
    if (!pkgLabel.trim()) return toast.error('Label is required');
    try {
      const newPkg = {
        id: editPackagingId || `pkg_${Date.now()}`,
        label: pkgLabel.trim(),
        type: pkgType,
        quality: pkgQuality,
        minCapacity: Number(pkgMinCapacity),
        maxCapacity: Number(pkgMaxCapacity),
        price: Number(pkgPrice),
        active: pkgActive
      };
      let updated;
      if (editPackagingId) {
        updated = packagingOptions.map(p => p.id === editPackagingId ? newPkg : p);
      } else {
        updated = [...packagingOptions, newPkg];
      }
      await setDoc(doc(db, 'mangoes', 'PACKAGING_OPTIONS'), { options: updated });
      setPackagingOptions(updated);
      setShowPackagingModal(false);
      clearPackagingForm();
      toast.success(editPackagingId ? 'Packaging option updated!' : 'Packaging option created!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save packaging option.');
    }
  };

  const handleDeletePackaging = async (id) => {
    if (!window.confirm('Delete this packaging option?')) return;
    try {
      const updated = packagingOptions.filter(p => p.id !== id);
      await setDoc(doc(db, 'mangoes', 'PACKAGING_OPTIONS'), { options: updated });
      setPackagingOptions(updated);
      toast.success('Packaging option deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete packaging option.');
    }
  };

  const handleTogglePackaging = async (id) => {
    try {
      const updated = packagingOptions.map(p => p.id === id ? { ...p, active: !p.active } : p);
      await setDoc(doc(db, 'mangoes', 'PACKAGING_OPTIONS'), { options: updated });
      setPackagingOptions(updated);
      toast.success('Packaging option toggled.');
    } catch (err) {
      console.error(err);
    }
  };

  const clearDeliveryForm = () => {
    setEditDeliveryId(null);
    setDlvLabel('');
    setDlvDescription('');
    setDlvPricingType('per_kg');
    setDlvPerKgRate(13);
    setDlvFirstKgPrice(125);
    setDlvExtraKgRate(22);
    setDlvActive(true);
  };

  const openDeliveryModal = (dlv = null) => {
    if (dlv) {
      setEditDeliveryId(dlv.id);
      setDlvLabel(dlv.label || '');
      setDlvDescription(dlv.description || '');
      setDlvPricingType(dlv.pricingType || 'per_kg');
      setDlvPerKgRate(dlv.perKgRate || 13);
      setDlvFirstKgPrice(dlv.firstKgPrice || 125);
      setDlvExtraKgRate(dlv.extraKgRate || 22);
      setDlvActive(dlv.active !== false);
    } else {
      clearDeliveryForm();
    }
    setShowDeliveryModal(true);
  };

  const handleSaveDelivery = async (e) => {
    e.preventDefault();
    if (!dlvLabel.trim()) return toast.error('Label is required');
    try {
      const newDlv = {
        id: editDeliveryId || `dlv_${Date.now()}`,
        label: dlvLabel.trim(),
        description: dlvDescription.trim(),
        pricingType: dlvPricingType,
        active: dlvActive
      };
      if (dlvPricingType === 'per_kg') {
        newDlv.perKgRate = Number(dlvPerKgRate);
      } else {
        newDlv.firstKgPrice = Number(dlvFirstKgPrice);
        newDlv.extraKgRate = Number(dlvExtraKgRate);
      }
      let updated;
      if (editDeliveryId) {
        updated = deliveryOptions.map(d => d.id === editDeliveryId ? newDlv : d);
      } else {
        updated = [...deliveryOptions, newDlv];
      }
      await setDoc(doc(db, 'mangoes', 'DELIVERY_OPTIONS'), { options: updated });
      setDeliveryOptions(updated);
      setShowDeliveryModal(false);
      clearDeliveryForm();
      toast.success(editDeliveryId ? 'Delivery method updated!' : 'Delivery method created!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save delivery method.');
    }
  };

  const handleDeleteDelivery = async (id) => {
    if (!window.confirm('Delete this delivery method?')) return;
    try {
      const updated = deliveryOptions.filter(d => d.id !== id);
      await setDoc(doc(db, 'mangoes', 'DELIVERY_OPTIONS'), { options: updated });
      setDeliveryOptions(updated);
      toast.success('Delivery method deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete delivery method.');
    }
  };

  const handleToggleDelivery = async (id) => {
    try {
      const updated = deliveryOptions.map(d => d.id === id ? { ...d, active: !d.active } : d);
      await setDoc(doc(db, 'mangoes', 'DELIVERY_OPTIONS'), { options: updated });
      setDeliveryOptions(updated);
      toast.success('Delivery method toggled.');
    } catch (err) {
      console.error(err);
    }
  };

  const formatLeadPhone = (phone) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    else if (!cleanPhone.startsWith('88') && cleanPhone.length === 10) cleanPhone = '880' + cleanPhone;
    return cleanPhone;
  };

  // Approve a review in Admin
  const handleApproveReview = async (productId, reviewId) => {
    try {
      const prodRef = doc(db, 'mangoes', productId);
      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) return;
      const updated = (prodSnap.data().reviewsList || []).map(r =>
        r.id === reviewId ? { ...r, status: 'approved' } : r
      );
      await updateDoc(prodRef, { reviewsList: updated });
      // Update local mangoes state so UI reflects immediately
      setMangoes(prev => prev.map(m =>
        m.id === productId ? { ...m, reviewsList: updated } : m
      ));
      toast.success('✅ Review approved and published!');
    } catch (err) {
      console.error('Failed to approve review:', err);
      toast.error('Failed to approve review.');
    }
  };

  // Review soft-delete with 5s undo
  const handleDeleteReview = (productId, reviewId, reviewObj) => {
    // Mark as trashed instantly in UI
    setTrashedReviews(prev => ({ ...prev, [reviewId]: { productId, review: reviewObj } }));

    // Show undo toast
    toast(
      (t) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontWeight: 600, fontSize: '.83rem' }}>
          🗑️ Review trashed
          <button
            onClick={() => {
              // Undo — remove from trash
              setTrashedReviews(prev => { const n = { ...prev }; delete n[reviewId]; return n; });
              clearTimeout(undoTimersRef.current[reviewId]);
              delete undoTimersRef.current[reviewId];
              toast.dismiss(t.id);
              toast.success('↩️ Deletion undone!');
            }}
            style={{ padding: '.25rem .7rem', borderRadius: 100, background: '#fff', border: '1.5px solid #e5e7eb', cursor: 'pointer', fontWeight: 700, fontSize: '.75rem', color: '#374151' }}
          >Undo</button>
        </span>
      ),
      { duration: 5000 }
    );

    // Commit deletion to Firestore after 5s if not undone
    undoTimersRef.current[reviewId] = setTimeout(async () => {
      try {
        const prodRef = doc(db, 'mangoes', productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
        const updated = (prodSnap.data().reviewsList || []).filter(r => r.id !== reviewId);
        await updateDoc(prodRef, { reviewsList: updated });
        }
        setTrashedReviews(prev => { const n = { ...prev }; delete n[reviewId]; return n; });
        delete undoTimersRef.current[reviewId];
        fetchData();
      } catch (err) {
        console.error('Failed to delete review:', err);
        toast.error('Failed to delete review.');
      }
    }, 5200);
  };


  if (authLoading || loading) {
    return (
      <div style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F4F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Entering Admin Panel…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/profile" replace />;

  // --- ANALYTICS COMPUTATIONS ---
  const activeOrders = orders.filter(o => o.status !== 'Cancelled');
  const totalRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalOrdersCount = orders.length;
  const customersCount = users.length;
  
  // Dynamic Analytics Overhaul
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const fulfillmentRate = totalOrdersCount > 0 ? ((deliveredOrders / totalOrdersCount) * 100).toFixed(1) : '0.0';
  
  const customerCounts = orders.reduce((acc, o) => {
    const key = o.customerEmail || o.customerPhone || o.userId;
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const uniqueOrderingCustomers = Object.keys(customerCounts).length;
  const repeatCustomersCount = Object.values(customerCounts).filter(count => count > 1).length;
  const repeatCustomersRate = uniqueOrderingCustomers > 0 ? ((repeatCustomersCount / uniqueOrderingCustomers) * 100).toFixed(0) : '0';

  const donutColors = ['#E8540A', '#F5A623', '#2A9445', '#7C3AED', '#2563EB', '#EC4899', '#14B8A6', '#8B5CF6', '#F43F5E', '#10B981'];
  const totalProductRevenue = analyticsRevenueByProduct.reduce((sum, v) => sum + v.revenue, 0);
  const displayProducts = analyticsRevenueByProduct.slice(0, 5);
  let currentOffset = 25;
  const dynamicDonutSegments = displayProducts.map((v, i) => {
    const percentage = totalProductRevenue > 0 ? (v.revenue / totalProductRevenue) * 100 : 0;
    const dashLength = percentage;
    const gapLength = 100 - percentage;
    const offset = currentOffset;
    currentOffset -= percentage;
    return {
      ...v,
      color: donutColors[i % donutColors.length],
      percentageStr: percentage.toFixed(0) + '%',
      dashArray: `${dashLength} ${gapLength}`,
      dashOffset: offset
    };
  });
  
  // Weekly Revenue Trend
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyRevenue = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    
    const dayTotal = activeOrders
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

  // --- CRUD SEARCH FILTERS CALCULATIONS ---
  // Products Filter
  const filteredProducts = mangoes.filter(p => {
    if (productSearch.trim() !== '') {
      const q = productSearch.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
    }
    if (productSectionFilter !== 'All Varieties') {
      if (p.section !== productSectionFilter) return false;
    }
    if (productStockFilter !== 'All Status') {
      if (productStockFilter === 'In Stock') return p.stock > 0;
      if (productStockFilter === 'Out of Stock') return !p.stock || p.stock <= 0;
    }
    return true;
  });



  // Customers Filter
  const filteredCustomers = users.filter(u => {
    if (customerSearch.trim() !== '') {
      const q = customerSearch.toLowerCase();
      const nameMatch = u.name?.toLowerCase().includes(q);
      const emailMatch = u.email?.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }
    return true;
  });

  // Flatten reviews across all catalog products dynamically
  const allProductReviews = [];
  mangoes.forEach(prod => {
    const reviewArr = prod.reviewsList || prod.reviews || [];
    if (Array.isArray(reviewArr)) {
      reviewArr.forEach(rev => {
        allProductReviews.push({
          ...rev,
          productId: prod.id,
          productName: prod.name
        });
      });
    }
  });
  const pendingReviewsCount = allProductReviews.filter(r => r.status === 'pending').length;

  const aFirstWord = storeName.split(' ')[0] || '';
  const aRestWord = storeName.split(' ').slice(1).join(' ') || '';

  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes marqueeSimulate {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="admin-layout">
      
      {/* 1. PRODUCT CREATION MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col animate-in scale-in duration-300" style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }}>
            {/* Modal Header */}
            <div style={{ background: '#121212', padding: '1rem 1.4rem', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg style={{ width: '20px', height: '20px', color: '#E8540A' }} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  {editProductId ? 'Edit Product Parameters' : 'Create New Catalog Item'}
                </h3>
              </div>
              <button 
                onClick={() => { setShowProductModal(false); setEditProductId(null); clearProductForm(); }} 
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Tab Row */}
            <div style={{ background: 'var(--bg-primary)', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button 
                type="button"
                onClick={() => setActiveProdFormTab('basic')}
                style={{ borderRadius: '100px', fontFamily: "'Sora', sans-serif", fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 1.1rem', border: activeProdFormTab === 'basic' ? '1.5px solid #E8540A' : '1.5px solid var(--border-color)', background: activeProdFormTab === 'basic' ? '#E8540A' : 'var(--bg-card)', color: activeProdFormTab === 'basic' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                1. Basic Details
              </button>
              <button 
                type="button"
                onClick={() => setActiveProdFormTab('rich')}
                style={{ borderRadius: '100px', fontFamily: "'Sora', sans-serif", fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 1.1rem', border: activeProdFormTab === 'rich' ? '1.5px solid #E8540A' : '1.5px solid var(--border-color)', background: activeProdFormTab === 'rich' ? '#E8540A' : 'var(--bg-card)', color: activeProdFormTab === 'rich' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                2. Rich Display Details
              </button>
              <button 
                type="button"
                onClick={() => setActiveProdFormTab('filters')}
                style={{ borderRadius: '100px', fontFamily: "'Sora', sans-serif", fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 1.1rem', border: activeProdFormTab === 'filters' ? '1.5px solid #E8540A' : '1.5px solid var(--border-color)', background: activeProdFormTab === 'filters' ? '#E8540A' : 'var(--bg-card)', color: activeProdFormTab === 'filters' ? '#FFFFFF' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                3. Classification & Filters
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSaveProduct} className="product-edit-form flex flex-col flex-grow overflow-hidden">
              <style>{`
                .product-edit-form .form-label {
                  font-family: 'Sora', sans-serif !important;
                  font-size: 0.72rem !important;
                  font-weight: 700 !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.06em !important;
                  color: var(--text-muted) !important;
                  margin-bottom: 0.4rem !important;
                  display: block;
                }
                .product-edit-form .form-input {
                  background: var(--input-bg) !important;
                  border: 1.5px solid var(--border-color) !important;
                  border-radius: 8px !important;
                  padding: 0.65rem 1rem !important;
                  font-family: 'Sora', sans-serif !important;
                  font-size: 0.875rem !important;
                  color: var(--text-primary) !important;
                  width: 100% !important;
                  box-sizing: border-box;
                  box-shadow: none !important;
                  outline: none !important;
                }
                .product-edit-form .form-input:focus {
                  border-color: #E8540A !important;
                }
              `}</style>
              <div className="overflow-y-auto flex-grow scrollbar-thin space-y-4" style={{ background: 'var(--bg-card)', padding: '1.2rem 1.4rem' }}>
                {/* TAB 1: BASIC DETAILS */}
                <div style={{ display: activeProdFormTab === 'basic' ? 'block' : 'none' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Product Name</label>
                    <input 
                      type="text" 
                      value={prodName} 
                      onChange={e => setProdName(e.target.value)} 
                      required 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="form-label">Standard Price (৳)</label>
                    <input 
                      type="number" 
                      value={prodPrice} 
                      onChange={e => setProdPrice(e.target.value)} 
                      required 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="form-label">Discount Price (৳, Optional)</label>
                    <input 
                      type="number" 
                      value={prodDiscountPrice} 
                      onChange={e => setProdDiscountPrice(e.target.value)} 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="form-label">Initial Stock Box Qty</label>
                    <input 
                      type="number" 
                      value={prodStock} 
                      onChange={e => setProdStock(e.target.value)} 
                      required 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="form-label">Weight / Size Options</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {weightOptions.map((opt, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const updated = [...weightOptions];
                              updated[idx] = e.target.value;
                              setWeightOptions(updated);
                            }}
                            placeholder="E.g. 3kg, 5kg Box, 10kg Premium Box"
                            className="form-input"
                            style={{
                              background: 'var(--input-bg)',
                              border: '1.5px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.65rem 1rem',
                              fontFamily: "'Sora', sans-serif",
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setWeightOptions(weightOptions.filter((_, i) => i !== idx))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#EF4444',
                              fontSize: '1.5rem',
                              lineHeight: 1,
                              cursor: 'pointer',
                              padding: '0 0.5rem'
                            }}
                            title="Remove Option"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setWeightOptions([...weightOptions, ''])}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '100px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Weight Option
                    </button>
                  </div>
                  <div>
                    <label className="form-label">SKU Code (Auto if blank)</label>
                    <input 
                      type="text" 
                      value={prodSku} 
                      onChange={e => setProdSku(e.target.value)} 
                      placeholder="VP-HMS-1D" 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="form-label">Min Threshold Stock</label>
                    <input 
                      type="number" 
                      value={prodMinThreshold} 
                      onChange={e => setProdMinThreshold(e.target.value)} 
                      className="form-input font-bold text-xs" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="form-label mb-2">Product Images (URLs)</label>
                    <div style={{ background: '#F7F7F7', border: '1.5px solid #EEEEEE', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {prodImages.map((img, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="url"
                            value={img}
                            onChange={e => handleProdImageChange(idx, e.target.value)}
                            placeholder="https://..."
                            className="form-input flex-1"
                          />
                          {prodImages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeProdImageField(idx)}
                              className="btn-outline shrink-0 px-3 text-xs"
                              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                              aria-label="Remove image URL"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addProdImageField}
                        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', padding: '0.5rem 1rem', cursor: 'pointer', marginTop: '0.25rem', alignSelf: 'flex-start' }}
                      >
                        + Add Another Image URL
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Detailed Description</label>
                    <textarea
                      value={prodDescription}
                      onChange={e => setProdDescription(e.target.value)}
                      className="form-input font-medium text-xs h-20 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-3" style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div
                        onClick={() => setProdFeatured(v => !v)}
                        style={{
                          width: 44, height: 24, borderRadius: 100, cursor: 'pointer',
                          background: prodFeatured ? '#E8540A' : '#EEEEEE',
                          position: 'relative', transition: 'background .2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: prodFeatured ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                        }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: '#E8540A', fontSize: '1rem', lineHeight: 1 }}>★</span> Featured on Home
                        </div>
                        <div className="text-xs" style={{ color: 'var(--gray4)' }}>Shows in the Featured Mangoes section</div>
                      </div>
                    </label>
                  </div>
                </div>
                </div>

                {/* TAB 3: CLASSIFICATION & FILTERS */}
                <div style={{ display: activeProdFormTab === 'filters' ? 'block' : 'none' }}>
                  <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-6">
                    <h4 className="text-xs font-black uppercase text-dark mb-6">🏷️ Classification & Global Filters</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {/* Category */}
                      <div>
                        <div className="text-[10px] font-bold mb-3 text-[var(--gray4)] uppercase tracking-wider">Categories</div>
                        <div className="flex flex-col gap-2 bg-[var(--gray1)] p-4 rounded-[14px] border-[1.5px] border-[var(--gray2)]">
                          {adminCategories?.map(c => (
                            <label key={c} className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                              <input type="checkbox" checked={prodCategories.includes(c)} onChange={() => setProdCategories(p => p.includes(c) ? p.filter(i => i !== c) : [...p, c])} style={{ transform: 'scale(1.1)' }} />
                              {c}
                            </label>
                          ))}
                          {(!adminCategories || adminCategories.length === 0) && <span className="text-xs text-[var(--gray4)]">No categories added</span>}
                        </div>
                      </div>

                      {/* Variety */}
                      <div>
                        <div className="text-[10px] font-bold mb-3 text-[var(--gray4)] uppercase tracking-wider">Variety</div>
                        <div className="flex flex-col gap-2 bg-[var(--gray1)] p-4 rounded-[14px] border-[1.5px] border-[var(--gray2)]">
                          {adminFilters.variety?.map(v => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                              <input type="checkbox" checked={prodVariety.includes(v)} onChange={() => setProdVariety(p => p.includes(v) ? p.filter(i => i !== v) : [...p, v])} style={{ transform: 'scale(1.1)' }} />
                              {v}
                            </label>
                          ))}
                          {(!adminFilters.variety || adminFilters.variety.length === 0) && <span className="text-xs text-[var(--gray4)]">No varieties added</span>}
                        </div>
                      </div>

                      {/* Season */}
                      <div>
                        <div className="text-[10px] font-bold mb-3 text-[var(--gray4)] uppercase tracking-wider">Season</div>
                        <div className="flex flex-col gap-2 bg-[var(--gray1)] p-4 rounded-[14px] border-[1.5px] border-[var(--gray2)]">
                          {adminFilters.season?.map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                              <input type="checkbox" checked={prodSeason.includes(s)} onChange={() => setProdSeason(p => p.includes(s) ? p.filter(i => i !== s) : [...p, s])} style={{ transform: 'scale(1.1)' }} />
                              {s}
                            </label>
                          ))}
                          {(!adminFilters.season || adminFilters.season.length === 0) && <span className="text-xs text-[var(--gray4)]">No seasons added</span>}
                        </div>
                      </div>

                      {/* Weight */}
                      <div>
                        <div className="text-[10px] font-bold mb-3 text-[var(--gray4)] uppercase tracking-wider">Weight Options</div>
                        <div className="flex flex-col gap-2 bg-[var(--gray1)] p-4 rounded-[14px] border-[1.5px] border-[var(--gray2)]">
                          {adminFilters.weight?.map(w => (
                            <label key={w} className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                              <input type="checkbox" checked={prodFixedWeight.includes(w)} onChange={() => setProdFixedWeight(p => p.includes(w) ? p.filter(i => i !== w) : [...p, w])} style={{ transform: 'scale(1.1)' }} />
                              {w}
                            </label>
                          ))}
                          {(!adminFilters.weight || adminFilters.weight.length === 0) && <span className="text-xs text-[var(--gray4)]">No weights added</span>}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* TAB 2: RICH DISPLAY DETAILS */}
                <div style={{ display: activeProdFormTab === 'rich' ? 'block' : 'none' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <h4 className="text-xs font-black uppercase text-dark mb-3">🏷️ Pricing & Badges</h4>
                        <div className="form-group">
                          <label className="form-label">Overlay Badge</label>
                          <input type="text" placeholder="e.g. Best Seller, Rare, Gift" value={prodBadge} onChange={e => setProdBadge(e.target.value)} className="form-input" />
                        </div>

                      </div>

                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <h4 className="ach-title text-xs mb-3">🚚 Delivery Info</h4>
                        <div className="space-y-3 mb-5">
                          <div className="form-group">
                            <label className="form-label">Dispatch Rule</label>
                            <input type="text" value={prodDeliveryInfo.dispatch} onChange={e => setProdDeliveryInfo({...prodDeliveryInfo, dispatch: e.target.value})} className="form-input" />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Packaging Info</label>
                            <input type="text" value={prodDeliveryInfo.packaging} onChange={e => setProdDeliveryInfo({...prodDeliveryInfo, packaging: e.target.value})} className="form-input" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <h4 className="ach-title text-xs mb-2">🛡️ Trust Strip</h4>
                        <div className="inline-block bg-[rgba(232,84,10,0.1)] text-[var(--primary)] text-[10px] font-bold px-3 py-1 rounded-full mb-3">3 Items Fixed</div>
                        {prodTrustStrip.map((ts, idx) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <input type="text" placeholder="Title" value={ts.title} onChange={e => {
                              const newTS = [...prodTrustStrip];
                              newTS[idx].title = e.target.value;
                              setProdTrustStrip(newTS);
                            }} className="form-input w-1/2" />
                            <input type="text" placeholder="Subtitle" value={ts.sub} onChange={e => {
                              const newTS = [...prodTrustStrip];
                              newTS[idx].sub = e.target.value;
                              setProdTrustStrip(newTS);
                            }} className="form-input w-1/2" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <h4 className="ach-title text-xs mb-3">📋 Specifications Table</h4>
                        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <div className="form-group">
                            <label className="form-label">Origin</label>
                            <input type="text" value={prodSpecs.origin} onChange={e => setProdSpecs({...prodSpecs, origin: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Sweetness</label>
                            <input type="text" value={prodSpecs.sweetness} onChange={e => setProdSpecs({...prodSpecs, sweetness: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Fiber</label>
                            <input type="text" value={prodSpecs.fiber} onChange={e => setProdSpecs({...prodSpecs, fiber: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Preservation</label>
                            <input type="text" value={prodSpecs.preservation} onChange={e => setProdSpecs({...prodSpecs, preservation: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Shelf Life</label>
                            <input type="text" value={prodSpecs.shelfLife} onChange={e => setProdSpecs({...prodSpecs, shelfLife: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Best For</label>
                            <input type="text" placeholder="e.g. Juicing" value={prodSpecs.bestFor} onChange={e => setProdSpecs({...prodSpecs, bestFor: e.target.value})} className="form-input" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <label className="form-label mb-2">Feature Highlights (Bullets)</label>
                        {prodHighlights.map((h, idx) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <input type="text" placeholder="Highlight bullet point" value={h} onChange={e => {
                              const newH = [...prodHighlights];
                              newH[idx] = e.target.value;
                              setProdHighlights(newH);
                            }} className="form-input flex-1" />
                            <button type="button" onClick={() => {
                              setProdHighlights(prodHighlights.filter((_, i) => i !== idx));
                            }} className="btn-outline px-3 text-xs" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setProdHighlights([...prodHighlights, ''])} className="btn-secondary text-xs mt-1">
                          + Add Highlight
                        </button>
                      </div>

                      <div className="bg-white dark:bg-[#222222] rounded-[14px] border-[1.5px] border-[var(--gray2)] p-4">
                        <label className="form-label mb-2">How We Grow Steps (Numbered)</label>
                        {prodSteps.map((s, idx) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <span className="w-6 h-8 flex items-center justify-center rounded text-xs font-bold shrink-0" style={{ background: 'var(--gray2)', color: 'var(--dark)' }}>{idx + 1}</span>
                            <input type="text" placeholder="Step description" value={s} onChange={e => {
                              const newS = [...prodSteps];
                              newS[idx] = e.target.value;
                              setProdSteps(newS);
                            }} className="form-input flex-1" />
                            <button type="button" onClick={() => {
                              setProdSteps(prodSteps.filter((_, i) => i !== idx));
                            }} className="btn-outline px-3 text-xs" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setProdSteps([...prodSteps, ''])} className="btn-secondary text-xs mt-1">
                          + Add Step
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div style={{ background: 'var(--bg-card)', padding: '1rem 1.4rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
                <button 
                  type="button" 
                  onClick={() => { setShowProductModal(false); setEditProductId(null); clearProductForm(); }} 
                  style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '100px', color: 'var(--text-primary)', fontWeight: 700, padding: '0.7rem 1.5rem', fontFamily: "'Sora', sans-serif", cursor: 'pointer' }}
                >
                  CANCEL
                </button>
                <button 
                  type="submit" 
                  style={{ background: '#E8540A', color: '#FFFFFF', borderRadius: '100px', fontWeight: 700, padding: '0.7rem 1.8rem', fontFamily: "'Sora', sans-serif", boxShadow: '0 6px 24px rgba(232,84,10,0.3)', border: 'none', cursor: 'pointer' }}
                >
                  SAVE PRODUCT DETAILS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. PROMO CREATION MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="max-w-sm w-full overflow-hidden flex flex-col animate-in scale-in duration-300" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '14px', boxShadow: '0 20px 60px var(--shadow-color)' }}>
            {/* Modal Header */}
            <div className="p-6 text-white flex justify-between items-center shrink-0 shadow-md" style={{ background: '#121212' }}>
              <div>
                <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">🎟️ {editPromoId ? 'Edit Promo Code' : 'Create Promo Code'}</h3>
                <p className="text-[10px] uppercase font-bold tracking-wider text-purple-100 mt-1">VIP Discounts & Campaigns</p>
              </div>
              <button 
                onClick={() => setShowCouponModal(false)} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleCreateCoupon} className="flex flex-col">
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
                <div className="form-group">
                  <label className="form-label">Promo Code (Uppercase)</label>
                  <input 
                    type="text" 
                    value={coupCode} 
                    onChange={e => setCoupCode(e.target.value)} 
                    placeholder="GOLD25" 
                    required 
                    className="form-input font-bold text-xs uppercase" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Discount Type</label>
                  <select 
                    value={coupType} 
                    onChange={e => setCoupType(e.target.value)} 
                    className="form-input font-bold text-xs cursor-pointer"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat BDT (৳)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Discount Value</label>
                  <input 
                    type="number" 
                    value={coupValue} 
                    onChange={e => setCoupValue(e.target.value)} 
                    required 
                    className="form-input font-bold text-xs" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Order Purchase (৳)</label>
                  <input 
                    type="number" 
                    value={coupMinOrder} 
                    onChange={e => setCoupMinOrder(e.target.value)} 
                    required 
                    className="form-input font-bold text-xs" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Maximum Usage Limit</label>
                  <input 
                    type="number" 
                    value={coupLimit} 
                    onChange={e => setCoupLimit(e.target.value)} 
                    required 
                    className="form-input font-bold text-xs" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input 
                    type="date" 
                    value={coupExpires} 
                    onChange={e => setCoupExpires(e.target.value)} 
                    required 
                    className="form-input font-bold text-xs" 
                  />
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCouponModal(false)} 
                  className="btn-secondary uppercase text-xs font-bold py-3 px-6 rounded-full shadow-sm transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary shiny-btn uppercase text-xs font-bold py-3 px-6 rounded-full shadow-lg shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {editPromoId ? 'Update Promo Code' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIEW ORDER DETAIL MODAL */}
      {showOrderDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="max-w-md w-full overflow-hidden flex flex-col animate-in scale-in duration-300" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '14px', boxShadow: '0 20px 60px var(--shadow-color)' }}>
            {/* Modal Header */}
            <div className="p-6 text-white flex justify-between items-center shrink-0 shadow-md" style={{ background: '#121212' }}>
              <div>
                <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">📋 Order Invoice Details</h3>
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-300 mt-1">Sales Transaction Log</p>
              </div>
              <button 
                onClick={() => { setShowOrderDetailModal(false); setSelectedOrder(null); }} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto max-h-[60vh] scrollbar-thin text-xs font-bold text-[var(--gray4)] font-['Sora']">
              <div className="pb-3 border-b border-[var(--gray2)] flex justify-between items-center">
                <span className="text-[var(--primary)] font-['Fraunces'] text-lg font-black">#{selectedOrder.id.slice(-6).toUpperCase()}</span>
                <span className="text-[10px] text-[var(--gray3)] font-semibold">{new Date(selectedOrder.createdAt?.seconds ? selectedOrder.createdAt.seconds * 1000 : selectedOrder.createdAt).toLocaleString()}</span>
              </div>
              
              <div className="bg-[var(--gray1)] p-4 rounded-[14px] border border-[var(--gray2)]">
                <p className="text-[9px] uppercase tracking-wider text-[var(--gray3)] mb-1 font-black">Billing Customer</p>
                <p className="text-[var(--dark)] text-sm font-black">{selectedOrder.deliveryName || selectedOrder.customerName || 'Guest User'}</p>
                <p className="text-[var(--gray4)] mt-0.5 font-semibold">{selectedOrder.customerEmail} • {selectedOrder.deliveryPhone}</p>
              </div>
              
              <div className="bg-[var(--gray1)] p-4 rounded-[14px] border border-[var(--gray2)]">
                <p className="text-[9px] uppercase tracking-wider text-[var(--gray3)] mb-1 font-black">Shipping Address</p>
                <p className="text-[var(--dark)] leading-relaxed font-semibold">{selectedOrder.deliveryAddress}</p>
                {selectedOrder.coords && (
                  <p className="text-[var(--primary)] mt-1.5 text-[10px] flex items-center gap-1">📍 Coordinate Logs: {selectedOrder.coords.latitude || selectedOrder.coords.lat}, {selectedOrder.coords.longitude || selectedOrder.coords.lng}</p>
                )}
              </div>
              
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--gray3)] mb-2 font-black">Booked Harvest Items</p>
                <div className="space-y-2 bg-[var(--gray1)] p-4 rounded-[14px] border border-[var(--gray2)]">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[var(--dark)] font-black">
                      <span>{item.name} {item.weight ? `(${item.weight}kg)` : ''} × {item.quantity}</span>
                      <span className="text-[var(--primary)]">৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t border-[var(--gray2)] flex justify-between items-center text-sm font-black text-[var(--dark)]">
                <span>Grand Total:</span>
                <span className="text-[var(--primary)] font-['Fraunces'] text-xl font-black">৳{selectedOrder.total}</span>
              </div>
              
              {selectedOrder.trackingId && (
                <div className="bg-[var(--blue-pale)] p-4 rounded-[14px] border border-[var(--blue)]/10">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--blue)] mb-1 font-black">Pathao Tracking URL</p>
                  <a href={`https://pathao.com/track/${selectedOrder.trackingId}`} target="_blank" rel="noreferrer" className="text-[var(--blue)] underline font-bold truncate block">https://pathao.com/track/{selectedOrder.trackingId}</a>
                </div>
              )}
            </div>
            
            {/* Modal Actions Footer */}
            <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', shrink: 0 }}>
              <button 
                onClick={() => { setShowOrderDetailModal(false); setSelectedOrder(null); }} 
                className="w-full btn-secondary uppercase text-xs font-bold py-3.5 px-6 rounded-full shadow-md transition-all duration-200 active:scale-95"
              >
                Close Detail
              </button>
            </div>
          </div>
        </div>
      )}





      {/* ADD/EDIT TRACKING LINK MODAL */}
      {trackingModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="max-w-sm w-full overflow-hidden flex flex-col" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '14px', boxShadow: '0 20px 60px var(--shadow-color)' }}>
            <div style={{ background: '#121212', padding: '1.25rem 1.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>📦 Tracking Link</h3>
              <button onClick={() => setTrackingModal({ isOpen: false, orderId: null, value: '' })} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, color: '#fff', width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', fontWeight: 900 }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <label className="form-label">Pathao / Steadfast URL</label>
              <input
                type="text"
                value={trackingModal.value}
                onChange={(e) => setTrackingModal({ ...trackingModal, value: e.target.value })}
                className="form-input"
                placeholder="e.g. https://pathao.com/track/..."
                autoFocus
              />
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
                <button onClick={() => setTrackingModal({ isOpen: false, orderId: null, value: '' })} style={{ flex: 1, padding: '.75rem', borderRadius: '100px', textTransform: 'uppercase', fontSize: '.78rem', fontWeight: 800, background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveTracking} className="btn-primary" style={{ flex: 1, padding: '.75rem', borderRadius: '100px', textTransform: 'uppercase', fontSize: '.78rem', fontWeight: 800, cursor: 'pointer' }}>Save Link</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 290 }} onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ADMIN SIDEBAR */}
      <aside className="admin-sidebar" style={isSidebarOpen ? { display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 300 } : {}}>
        <div className="admin-logo-area">
          <div className="admin-logo-text">{aFirstWord}<span>{aRestWord}</span></div>
          <div className="admin-role-badge">⚙️ Admin Console</div>
        </div>

        <div className="admin-nav-section">
          <span className="admin-nav-label">Main</span>
          {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'categories', icon: '📁', label: 'Categories' }, { id: 'filters', icon: '🎛️', label: 'Filters' }, { id: 'products', icon: '🥭', label: 'Products' }, { id: 'orders', icon: '📦', label: 'Orders', badge: unreadOrderCount > 0 ? unreadOrderCount : orders.length }, { id: 'customers', icon: '👥', label: 'Customers' }].map(item => (
            <button key={item.id} className={`admin-nav-item${activeAdminTab === item.id ? ' active' : ''}`} onClick={() => { setActiveAdminTab(item.id); setIsSidebarOpen(false); if (item.id === 'orders') { setUnreadOrderCount(0); setNewOrderAlert(prev => ({ ...prev, show: false })); } }}>
              <span className="ani-icon">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <span className="ani-badge">{item.badge}</span>}
            </button>
          ))}
        </div>

        <div className="admin-nav-section">
          <span className="admin-nav-label">Manage</span>
          {[{ id: 'coupons', icon: '🎟️', label: 'Promo Codes' }, { id: 'packaging', icon: '📦', label: 'Packaging & Delivery' }, { id: 'reviews', icon: '⭐', label: 'Reviews', badge: pendingReviewsCount }, { id: 'leads', icon: '📧', label: 'Leads', badge: leads.length }, { id: 'analytics', icon: '📈', label: 'Analytics' }, { id: 'customizer', icon: '🎨', label: 'UI Customizer' }].map(item => (
            <button key={item.id} className={`admin-nav-item${activeAdminTab === item.id ? ' active' : ''}`} onClick={() => { setActiveAdminTab(item.id); setIsSidebarOpen(false); }}>
              <span className="ani-icon">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <span className="ani-badge">{item.badge}</span>}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '.9rem', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <Link to="/profile" className="admin-nav-item" style={{ display: 'flex', alignItems: 'center', gap: '.7rem', color: 'rgba(255,255,255,.6)' }}>
            <span className="ani-icon">👤</span> My Profile
          </Link>
          <button className="admin-nav-item" style={{ width: '100%', textAlign: 'left', color: '#f87171' }} onClick={() => signOut(auth)}>
            <span className="ani-icon">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ADMIN MAIN CONTENT */}
      <main className="admin-main">
        
        {/* Admin Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', marginBottom: '1.5rem', background: '#fff', border: '1.5px solid var(--gray2)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="sidebar-mobile-toggle"
              style={{ padding: '8px', borderRadius: 10, border: '1.5px solid var(--gray2)', background: '#fff', cursor: 'pointer', fontSize: '1.1rem', display: 'none' }}
            >☰</button>
            <div>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray4)' }}>Admin Control Center</div>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--dark)', textTransform: 'capitalize' }}>{activeAdminTab} Panel</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--gray4)' }}>{user?.email}</span>
            <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '.25rem .65rem', borderRadius: 100, background: 'var(--primary-pale)', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>⚡ Live</span>
          </div>
        </div>

        {/* NEW ORDER NOTIFICATION BANNER */}
        <AnimatePresence>
          {newOrderAlert.show && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{
                marginBottom: '1.25rem',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1.5px solid rgba(232,84,10,0.4)',
                borderRadius: 16,
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: '0 8px 32px rgba(232,84,10,0.2)',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#E8540A,#FF7A35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  📦
                </div>
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: 800, color: '#fff', marginBottom: '.2rem' }}>
                    {newOrderAlert.count === 1 ? '1 New Order Received!' : `${newOrderAlert.count} New Orders Received!`}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {newOrderAlert.orders[0] && (
                      <>৳{newOrderAlert.orders[0].total || 0} &middot; {newOrderAlert.orders[0].customerName || newOrderAlert.orders[0].deliveryName || 'Customer'} &middot; {newOrderAlert.orders[0].deliveryAddress?.slice(0, 35) || 'N/A'}&hellip;</>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                <button
                  onClick={() => { setActiveAdminTab('orders'); setUnreadOrderCount(0); setNewOrderAlert({ show: false, orders: [], count: 0 }); }}
                  style={{ background: 'linear-gradient(135deg,#E8540A,#FF7A35)', color: '#fff', fontWeight: 700, fontSize: '.78rem', padding: '.45rem 1rem', borderRadius: 100, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}
                >
                  View Orders →
                </button>
                <button
                  onClick={() => setNewOrderAlert(prev => ({ ...prev, show: false }))}
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* TAB 0: DASHBOARD TAB */}
        {activeAdminTab === 'dashboard' && (
          <div className="admin-tab active" id="atab-dashboard">
            <div className="admin-header">
              <div>
                <div className="admin-title">📊 Dashboard Control Panel</div>
                <div style={{ fontSize: '.82rem', color: 'var(--gray4)' }}>Season 2026 · Realtime system console</div>
              </div>
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                <select className="aab-filter">
                  <option>This Week</option>
                  <option>This Month</option>
                  <option>This Season</option>
                </select>
                <button className="add-btn" onClick={() => {
                  const data = [
                    ['Total Revenue', `৳${totalRevenue}`],
                    ['Total Orders', orders.length],
                    ['Total Customers', users.length],
                    ['Products in Catalog', mangoes.length]
                  ];
                  exportToCSV('dashboard_summary.csv', data, ['Metric', 'Value']);
                  toast.success('Dashboard report exported!');
                }}>📥 Export</button>
              </div>
            </div>

            {/* Stats row */}
            <div className="admin-stats">
              <div className="admin-stat">
                <div className="as-icon orange">💰</div>
                <div>
                  <div className="as-label">Total Revenue</div>
                  <div className="as-val">৳{totalRevenue.toLocaleString()}</div>
                  <div className="as-trend up">↑ +14% vs last week</div>
                </div>
              </div>
              <div className="admin-stat">
                <div className="as-icon green">🛒</div>
                <div>
                  <div className="as-label">Total Orders</div>
                  <div className="as-val">{totalOrdersCount}</div>
                  <div className="as-trend up">↑ +{orders.filter(o => o.status === 'Pending').length} pending</div>
                </div>
              </div>
              <div className="admin-stat">
                <div className="as-icon blue">👥</div>
                <div>
                  <div className="as-label">Customers</div>
                  <div className="as-val">{customersCount}</div>
                  <div className="as-trend up">↑ +12 this month</div>
                </div>
              </div>
              <div className="admin-stat">
                <div className="as-icon purple">⭐</div>
                <div>
                  <div className="as-label">Avg. Rating</div>
                  <div className="as-val">4.9</div>
                  <div className="as-trend up">↑ 0.1 improved</div>
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="admin-charts-row">
              {/* Revenue Trend chart */}
              <div className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <div className="ach-title">📈 Revenue Trend</div>
                    <div className="ach-sub">Daily revenue this week (৳)</div>
                  </div>
                  <select className="ach-select"><option>This Week</option><option>Last Month</option></select>
                </div>
                <div className="p-6 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} stroke="#888" />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }} stroke="#888" />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee', fontSize: '11px', fontWeight: 'bold' }} formatter={(val) => [`৳${val}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Product Sales donut legend */}
              <div className="admin-card">
                <div className="admin-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="ach-title">🥭 Sales by Product</div>
                  <button 
                    type="button"
                    onClick={() => setExpandProductSales(true)}
                    style={{ background: 'var(--primary-pale)', color: 'var(--primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="View Detailed Breakdown"
                  >
                    ↗️
                  </button>
                </div>
                <div className="donut-wrap">
                  <svg className="donut-svg" viewBox="0 0 36 36" id="donutChart">
                    {dynamicDonutSegments.map((seg, idx) => (
                      <circle 
                        key={idx}
                        cx="18" cy="18" r="15.9" 
                        fill="none" 
                        stroke={seg.color} 
                        strokeWidth="3.8" 
                        strokeDasharray={seg.dashArray} 
                        strokeDashoffset={seg.dashOffset} 
                      />
                    ))}
                    <text x="18" y="19.5" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#1A1A1A" fontFamily="Fraunces,serif">{totalOrdersCount}</text>
                    <text x="18" y="24" textAnchor="middle" fontSize="2.5" fill="#888" fontFamily="Sora,sans-serif">orders</text>
                  </svg>
                  <div className="donut-legend">
                    {dynamicDonutSegments.length === 0 && <div className="text-xs text-center text-gray-400 font-bold p-4">No data</div>}
                    {dynamicDonutSegments.map((seg, idx) => (
                      <div className="dl-row" key={idx}>
                        <div className="dl-dot" style={{ background: seg.color }} />
                        <span className="dl-name">{seg.name}</span>
                        <span className="dl-val">{seg.percentageStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Settings Module */}
            <div className="admin-header" style={{ marginTop: '2.5rem' }}>
              <div className="admin-title">⚙️ Control Panel Settings</div>
            </div>
            <div className="settings-grid">

              
              {/* Store configurations */}
              <div className="admin-card">
                <div className="admin-card-head"><div className="ach-title">🏪 Store Configuration</div></div>
                <form onSubmit={handleSaveStoreGeneral} className="settings-form">
                  <div className="form-group">
                    <label className="form-label">Store Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={storeName} 
                      onChange={e => setStoreName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Email</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={contactEmail} 
                      onChange={e => setContactEmail(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Floating WhatsApp Number</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={floatingWhatsappPhone} 
                      onChange={e => setFloatingWhatsappPhone(e.target.value)}
                      required 
                    />
                  </div>

                  <button type="submit" className="btn-primary shiny-btn !rounded-full shadow-lg shadow-orange-500/10 font-bold uppercase tracking-wider text-[10px] px-6 py-2.5">Save Changes</button>
                </form>
              </div>

              {/* Notification Toggles */}
              <div className="admin-card">
                <div className="admin-card-head"><div className="ach-title">🔔 Notification Switches</div></div>
                <div style={{ padding: '1rem 1.5rem' }}>
                  <div className="toggle-row">
                    <div><div className="toggle-label">New Order Alerts</div><div className="toggle-desc">Email notifications on every new booking</div></div>
                    <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label>
                  </div>
                  <div className="toggle-row">
                    <div><div className="toggle-label">Low Stock Alerts</div><div className="toggle-desc">Notification when stock drops below threshold limit</div></div>
                    <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label>
                  </div>
                  <div className="toggle-row">
                    <div><div className="toggle-label">Daily Sales Digest</div><div className="toggle-desc">Auto sales summary report emailed at 8:00am</div></div>
                    <label className="toggle-switch"><input type="checkbox" /><span className="toggle-slider" /></label>
                  </div>
                </div>
              </div>

              {/* Delivery setup notice */}
              <div className="admin-card settings-full">
                <div className="admin-card-head"><div className="ach-title">🚚 Delivery & Packaging</div></div>
                <div style={{ padding: '1rem 1.5rem' }}>
                  <p style={{ fontSize: '.85rem', color: 'var(--gray4)', margin: 0 }}>Delivery methods and packaging options are now managed from the <strong>📦 Packaging & Delivery</strong> tab in the sidebar.</p>
                  <button type="button" className="btn-primary shiny-btn !rounded-full shadow-lg shadow-orange-500/10 font-bold uppercase tracking-wider text-[10px] px-6 py-2.5" style={{ marginTop: '1rem' }} onClick={() => setActiveAdminTab('packaging')}>Go to Packaging & Delivery →</button>
                </div>
              </div>

            
            </div>
          </div>
        )}

        {/* TAB: PACKAGING & DELIVERY */}
        {activeAdminTab === 'packaging' && (
          <div className="admin-tab active" id="atab-packaging" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
            <div className="admin-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
              <div>
                <div className="admin-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: "'Fraunces', serif", fontWeight: 900 }}>
                  <span>📦</span> Packaging & Delivery Settings
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Configure customer packing constraints and courier pricing calculations.</div>
              </div>
            </div>

            {/* === PACKAGING OPTIONS SECTION === */}
            <div style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🪵 Packaging Configurations
                </h3>
                <button className="add-btn shiny-btn !rounded-full shadow-lg shadow-orange-500/10 font-bold uppercase tracking-wider text-[10px] px-5 py-2" onClick={() => openPackagingModal(null)}>+ Add Packaging</button>
              </div>

              {packagingOptions.length === 0 ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', fontWeight: 600, margin: 0 }}>No packaging options configured yet. Get started by clicking "+ Add Packaging".</p>
                </div>
              ) : (
                <div className="premium-radio-grid">
                  {packagingOptions.map(pkg => (
                    <div 
                      key={pkg.id} 
                      className="admin-card" 
                      style={{ 
                        opacity: pkg.active ? 1 : 0.6, 
                        transition: 'all .25s var(--ease)',
                        transform: 'none',
                        boxShadow: '0 4px 16px var(--shadow-color)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px var(--shadow-color)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px var(--shadow-color)'; }}
                    >
                      <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: pkg.type === 'crate' ? '#FEF3C7' : '#DBEAFE', color: pkg.type === 'crate' ? '#92400E' : '#1E40AF', padding: '.2rem .6rem', borderRadius: '100px' }}>{pkg.type}</span>
                            <span style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--bg-primary)', color: 'var(--text-muted)', padding: '.2rem .6rem', borderRadius: '100px', border: '1px solid var(--border-color)' }}>{pkg.quality}</span>
                          </div>
                          <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                            <input type="checkbox" checked={pkg.active} onChange={() => handleTogglePackaging(pkg.id)} />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                        
                        <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0 0 .5rem 0' }}>{pkg.label}</h4>
                        
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', padding: '0.6rem 0.8rem', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.04em' }}>Capacity</span>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{pkg.minCapacity}–{pkg.maxCapacity} kg</strong>
                          </div>
                          <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                          <div>
                            <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.04em' }}>Price Per Box</span>
                            <strong style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>৳{pkg.price}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          <button 
                            className="order-action-btn" 
                            style={{ flex: 1, justifyContent: 'center' }} 
                            onClick={() => openPackagingModal(pkg)}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="order-action-btn"
                            style={{ flex: 1, justifyContent: 'center', background: 'var(--red-pale)', color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.15)' }} 
                            onClick={() => handleDeletePackaging(pkg.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* === DELIVERY METHODS SECTION === */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🚚 Courier & Delivery Services
                </h3>
                <button className="add-btn shiny-btn !rounded-full shadow-lg shadow-orange-500/10 font-bold uppercase tracking-wider text-[10px] px-5 py-2" onClick={() => openDeliveryModal(null)}>+ Add Courier</button>
              </div>

              {deliveryOptions.length === 0 ? (
                <div className="admin-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', fontWeight: 600, margin: 0 }}>No courier methods configured yet. Add your first courier service!</p>
                </div>
              ) : (
                <div className="premium-radio-grid">
                  {deliveryOptions.map(dlv => (
                    <div 
                      key={dlv.id} 
                      className="admin-card" 
                      style={{ 
                        opacity: dlv.active ? 1 : 0.6, 
                        transition: 'all .25s var(--ease)',
                        transform: 'none',
                        boxShadow: '0 4px 16px var(--shadow-color)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px var(--shadow-color)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px var(--shadow-color)'; }}
                    >
                      <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: dlv.pricingType === 'per_kg' ? '#D1FAE5' : '#EDE9FE', color: dlv.pricingType === 'per_kg' ? '#065F46' : '#5B21B6', padding: '.2rem .6rem', borderRadius: '100px' }}>
                            {dlv.pricingType === 'per_kg' ? 'Per KG Rate' : 'Base + Extra KG'}
                          </span>
                          <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                            <input type="checkbox" checked={dlv.active} onChange={() => handleToggleDelivery(dlv.id)} />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                        
                        <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0 0 .25rem 0' }}>{dlv.label}</h4>
                        {dlv.description && <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', margin: '0 0 .75rem 0', lineHeight: 1.35 }}>{dlv.description}</p>}
                        
                        <div style={{ fontSize: '.8rem', color: 'var(--text-primary)', marginBottom: '1rem', background: 'var(--bg-primary)', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          {dlv.pricingType === 'per_kg' ? (
                            <span><strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Pricing Formula:</strong> ৳{dlv.perKgRate}/kg weight</span>
                          ) : (
                            <span><strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Pricing Formula:</strong> ৳{dlv.firstKgPrice} (1st kg) + ৳{dlv.extraKgRate}/extra kg</span>
                          )}
                        </div>

                        <div style={{ fontSize: '.75rem', color: '#E8540A', fontWeight: 800, marginBottom: '1.25rem', background: 'rgba(232,84,10,0.04)', border: '1px solid rgba(232,84,10,0.1)', padding: '.5rem .8rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          💡 40kg order cost: <strong>৳{dlv.pricingType === 'per_kg' ? (dlv.perKgRate * 40) : (dlv.firstKgPrice + dlv.extraKgRate * 39)}</strong>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          <button 
                            className="order-action-btn" 
                            style={{ flex: 1, justifyContent: 'center' }} 
                            onClick={() => openDeliveryModal(dlv)}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="order-action-btn" 
                            style={{ flex: 1, justifyContent: 'center', background: 'var(--red-pale)', color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.15)' }} 
                            onClick={() => handleDeleteDelivery(dlv.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PACKAGING MODAL */}
            {showPackagingModal && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 backdrop-blur-modal" onClick={() => setShowPackagingModal(false)}>
                <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto animate-fadeIn" style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ background: '#121212', padding: '1.2rem 1.5rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {editPackagingId ? '✏️ Edit Packaging Option' : '📦 Add Packaging Option'}
                    </h3>
                    <button onClick={() => setShowPackagingModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
                  </div>
                  <form onSubmit={handleSavePackaging} className="settings-form" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Label / Name</label>
                      <input type="text" className="checkout-input-field" value={pkgLabel} onChange={e => setPkgLabel(e.target.value)} placeholder="e.g. Normal Crate" required />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Type</label>
                        <select className="checkout-input-field" value={pkgType} onChange={e => setPkgType(e.target.value)}>
                          <option value="crate">Crate</option>
                          <option value="carton">Carton</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Quality</label>
                        <select className="checkout-input-field" value={pkgQuality} onChange={e => setPkgQuality(e.target.value)}>
                          <option value="normal">Normal</option>
                          <option value="premium">Premium / Good</option>
                        </select>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Min Capacity (kg)</label>
                        <input type="number" className="checkout-input-field" value={pkgMinCapacity} onChange={e => setPkgMinCapacity(e.target.value)} min="1" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Max Capacity (kg)</label>
                        <input type="number" className="checkout-input-field" value={pkgMaxCapacity} onChange={e => setPkgMaxCapacity(e.target.value)} min="1" required />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Price per Unit (৳)</label>
                      <input type="number" className="checkout-input-field" value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} min="0" required />
                    </div>
                    
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-primary)', padding: '0.8rem 1.1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label className="form-label" style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Enable / Active status</label>
                      <label className="toggle-switch" style={{ marginLeft: 'auto' }}>
                        <input type="checkbox" checked={pkgActive} onChange={e => setPkgActive(e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    
                    <button type="submit" className="pulsing-confirm-btn" style={{ marginTop: '.5rem', padding: '0.8rem 1.5rem', fontSize: '0.85rem' }}>
                      {editPackagingId ? 'Update Option' : 'Create Option'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* DELIVERY MODAL */}
            {showDeliveryModal && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 backdrop-blur-modal" onClick={() => setShowDeliveryModal(false)}>
                <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto animate-fadeIn" style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ background: '#121212', padding: '1.2rem 1.5rem', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {editDeliveryId ? '✏️ Edit Courier Method' : '🚚 Add Courier Method'}
                    </h3>
                    <button onClick={() => setShowDeliveryModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
                  </div>
                  <form onSubmit={handleSaveDelivery} className="settings-form" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Label / Name</label>
                      <input type="text" className="checkout-input-field" value={dlvLabel} onChange={e => setDlvLabel(e.target.value)} placeholder="e.g. Sundarban Courier" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Description</label>
                      <input type="text" className="checkout-input-field" value={dlvDescription} onChange={e => setDlvDescription(e.target.value)} placeholder="e.g. Reliable & affordable" />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Pricing Type</label>
                      <select className="checkout-input-field" value={dlvPricingType} onChange={e => setDlvPricingType(e.target.value)}>
                        <option value="per_kg">Per KG (flat rate per kg)</option>
                        <option value="first_kg_plus">First KG + Extra (e.g. ৳125 first + ৳22/kg)</option>
                      </select>
                    </div>
                    
                    {dlvPricingType === 'per_kg' ? (
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Rate Per KG (৳)</label>
                        <input type="number" className="checkout-input-field" value={dlvPerKgRate} onChange={e => setDlvPerKgRate(e.target.value)} min="0" required />
                        <div style={{ fontSize: '.75rem', color: '#E8540A', fontWeight: 700, marginTop: '.4rem', paddingLeft: '.5rem' }}>
                          💡 40 kg order cost: ৳{Number(dlvPerKgRate) * 40}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>First KG Price (৳)</label>
                            <input type="number" className="checkout-input-field" value={dlvFirstKgPrice} onChange={e => setDlvFirstKgPrice(e.target.value)} min="0" required />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'block' }}>Extra KG Rate (৳)</label>
                            <input type="number" className="checkout-input-field" value={dlvExtraKgRate} onChange={e => setDlvExtraKgRate(e.target.value)} min="0" required />
                          </div>
                        </div>
                        <div style={{ fontSize: '.75rem', color: '#E8540A', fontWeight: 700, paddingLeft: '.5rem' }}>
                          💡 40 kg order cost: ৳{Number(dlvFirstKgPrice) + Number(dlvExtraKgRate) * 39}
                        </div>
                      </div>
                    )}
                    
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-primary)', padding: '0.8rem 1.1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label className="form-label" style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Enable / Active status</label>
                      <label className="toggle-switch" style={{ marginLeft: 'auto' }}>
                        <input type="checkbox" checked={dlvActive} onChange={e => setDlvActive(e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    
                    <button type="submit" className="pulsing-confirm-btn" style={{ marginTop: '.5rem', padding: '0.8rem 1.5rem', fontSize: '0.85rem' }}>
                      {editDeliveryId ? 'Update Courier' : 'Create Courier'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: ANALYTICS TAB */}
        {activeAdminTab === 'analytics' && (
          <div className="admin-tab active" id="atab-analytics">
            <div className="admin-header"><div className="admin-title">📈 Analytics</div></div>
            <div className="mini-stat-row">
              <div className="mini-stat"><div className="ms-label">Avg. Order Value</div><div className="ms-val">৳{(totalRevenue / (totalOrdersCount || 1)).toFixed(0)}</div></div>
              <div className="mini-stat"><div className="ms-label">Fulfillment Rate</div><div className="ms-val">{fulfillmentRate}%</div></div>
              <div className="mini-stat"><div className="ms-label">Repeat Customers</div><div className="ms-val">{repeatCustomersRate}%</div></div>
            </div>
            
            <div className="analytics-row">
              <div className="admin-card" style={{ padding: '1.5rem' }}>
                <div className="admin-card-head" style={{ borderBottom: 'none', padding: '0 0 1rem 0' }}>
                  <div className="ach-title">📍 Orders by City</div>
                </div>
                <div className="space-y-4">
                  {analyticsLoading ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">Calculating...</div>
                  ) : analyticsOrdersByCity.length === 0 ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">No data available</div>
                  ) : (
                    analyticsOrdersByCity.map(c => (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="font-bold text-xs text-gray-700 w-24 shrink-0 truncate" title={c.city}>{c.city}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-primary h-full transition-all duration-500" style={{ width: c.fill }} />
                        </div>
                        <span className="font-black text-xs text-gray-500 shrink-0 w-16 text-right">{c.val} orders</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="admin-card" style={{ padding: '1.5rem' }}>
                <div className="admin-card-head" style={{ borderBottom: 'none', padding: '0 0 1rem 0' }}>
                  <div className="ach-title">🥭 Revenue by Product</div>
                </div>
                <div className="space-y-4">
                  {analyticsLoading ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">Calculating...</div>
                  ) : analyticsRevenueByProduct.length === 0 ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">No data available</div>
                  ) : (
                    analyticsRevenueByProduct.slice(0, 5).map((v) => (
                      <div key={v.name} className="flex items-center gap-3">
                        <span className="font-bold text-xs text-gray-700 w-24 shrink-0 truncate" title={v.name}>{v.name}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-green-light h-full transition-all duration-500" style={{ width: v.fill }} />
                        </div>
                        <span className="font-black text-xs text-gray-500 shrink-0 w-20 text-right">৳{v.revenue.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <div><div className="ach-title">📅 Monthly Revenue</div><div className="ach-sub">Season 2026 breakdown (৳)</div></div>
              </div>
              <div className="p-6 h-[180px]">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-full text-xs font-bold text-gray-400">Calculating...</div>
                ) : analyticsMonthlyRevenue.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs font-bold text-gray-400">No data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsMonthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} stroke="#888" />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }} stroke="#888" />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eee', fontSize: '11px', fontWeight: 'bold' }} formatter={(val) => [`৳${val.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--green-light)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === 'categories' && (
          <CategoriesTab />
        )}

        {activeAdminTab === 'filters' && (
          <FiltersTab />
        )}

        {activeAdminTab === 'products' && (
          <div className="admin-tab active" id="atab-products">
            <div className="admin-header">
              <div className="admin-title">🥭 Products Catalog</div>
              <button className="add-btn" onClick={() => { clearProductForm(); setShowProductModal(true); }}>+ Add Product</button>
            </div>
            
            <div className="admin-card">
              <div className="admin-action-bar">
                <div className="aab-left">
                  <div className="aab-search">
                    <span className="aab-search-icon">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search products..." 
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="aab-filter"
                    value={productSectionFilter}
                    onChange={e => setProductSectionFilter(e.target.value)}
                  >
                    <option>All Varieties</option>
                    <option>Himsagar</option>
                    <option>Langra</option>
                    <option>Fazli</option>
                    <option>Gopalbhog</option>
                    <option>Amrapali</option>
                    <option>Gift Box</option>
                  </select>
                  <select 
                    className="aab-filter"
                    value={productStockFilter}
                    onChange={e => setProductStockFilter(e.target.value)}
                  >
                    <option>All Status</option>
                    <option>In Stock</option>
                    <option>Out of Stock</option>
                  </select>
                </div>
                <div className="aab-right">
                  <button className="add-btn" style={{ background: 'var(--green)' }} onClick={() => {
                    const data = filteredProducts.map(m => [m.id, m.name, m.variety || 'N/A', m.price, m.stock]);
                    exportToCSV('products_catalogue.csv', data, ['ID', 'Name', 'Variety', 'Price', 'Stock']);
                    toast.success('CSV catalogue exported!');
                  }}>📥 Export</button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" className="at-check" /></th>
                      <th>Product</th>
                      <th>Variety</th>
                      <th>Price</th>
                      <th>Stock Qty</th>
                      <th>Season</th>
                      <th>Featured</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id}>
                        <td><input type="checkbox" className="at-check" /></td>
                        <td>
                          <div className="at-product-cell">
                            <div className="at-product-emoji bg-gray1">
                              {(p.images?.[0] || p.image) ? (
                                <img src={p.images?.[0] || p.image} alt={p.name} className="w-full h-full object-cover rounded-brand-sm" />
                              ) : (
                                '🥭'
                              )}
                            </div>
                            <div>
                              <div className="at-product-name">{p.name}</div>
                              <div className="at-product-var text-[10px] text-gray3">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-bold text-xs">{p.section}</td>
                        <td className="font-display font-extrabold text-sm text-primary">
                          ৳{p.discountPrice || p.price}
                          {p.discountPrice && <span className="unit text-xs text-gray3 line-through ml-1.5">৳{p.price}</span>}
                        </td>
                        <td>
                          {editingStock?.productId === p.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={editingStock.value}
                                onChange={e => setEditingStock(s => ({ ...s, value: e.target.value }))}
                                onKeyDown={async e => {
                                  if (e.key === 'Enter') {
                                    await setDoc(doc(db, 'mangoes', p.id), { stock: Number(editingStock.value) }, { merge: true });
                                    toast.success(`Stock updated: ${editingStock.value} boxes`);
                                    setEditingStock(null);
                                    fetchData();
                                  } else if (e.key === 'Escape') { setEditingStock(null); }
                                }}
                                onBlur={async () => {
                                  await setDoc(doc(db, 'mangoes', p.id), { stock: Number(editingStock.value) }, { merge: true });
                                  toast.success(`Stock updated: ${editingStock.value} boxes`);
                                  setEditingStock(null);
                                  fetchData();
                                }}
                                style={{ width: 70, padding: '.3rem .5rem', borderRadius: 8, border: '1.5px solid var(--primary)', fontSize: '.83rem', fontWeight: 700, outline: 'none' }}
                              />
                              <span style={{ fontSize: '.72rem', color: 'var(--gray4)' }}>boxes</span>
                            </div>
                          ) : (
                            <button
                              title="Click to edit stock"
                              onClick={() => setEditingStock({ productId: p.id, value: p.stock || 0 })}
                              style={{
                                padding: '.3rem .75rem', borderRadius: 100, border: '1.5px solid',
                                fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                                borderColor: p.stock > 0 ? '#16A34A' : '#DC2626',
                                background: p.stock > 0 ? '#F0FDF4' : '#FEF2F2',
                                color: p.stock > 0 ? '#15803D' : '#B91C1C',
                              }}
                            >
                              {p.stock > 0 ? `✓ ${p.stock} in stock` : '✕ Out of Stock'}
                            </button>
                          )}
                        </td>
                        <td style={{ fontSize: '.8rem', fontWeight: 600 }}>{p.season || 'Peak'}</td>
                        <td>
                          <button
                            title={p.featured ? 'Remove from Featured' : 'Set as Featured'}
                            onClick={async () => {
                              await setDoc(doc(db, 'mangoes', p.id), { featured: !p.featured }, { merge: true });
                              toast.success(p.featured ? `${p.name} removed from Featured` : `${p.name} is now Featured ⭐`);
                              fetchData();
                            }}
                            style={{ padding: '.3rem .65rem', borderRadius: 100, border: '1.5px solid', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all .2s', borderColor: p.featured ? '#F5A623' : 'var(--gray2)', background: p.featured ? '#FFF8EC' : '#fff', color: p.featured ? '#B45309' : 'var(--gray4)' }}
                          >
                            {p.featured ? '⭐ Featured' : '☆ Set Featured'}
                          </button>
                        </td>
                        <td>
                          <div className="at-actions">
                            <button onClick={() => handleEditProductClick(p)} className="at-action-btn" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteProduct(p.id, p.name)} className="at-action-btn danger" title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INVENTORY TRACKER TAB */}
        {activeAdminTab === 'inventory' && (
          <div className="admin-tab active" id="atab-inventory">
            <div className="admin-header"><div className="admin-title">📦 Inventory</div></div>
            <div className="admin-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="admin-stat">
                <div className="as-icon green">✅</div>
                <div>
                  <div className="as-label">In Stock Items</div>
                  <div className="as-val">{mangoes.filter(p => p.stock > (p.minThreshold || 10)).length}</div>
                </div>
              </div>
              <div className="admin-stat">
                <div className="as-icon orange">⚠️</div>
                <div>
                  <div className="as-label">Low Stock Items</div>
                  <div className="as-val">{mangoes.filter(p => p.stock > 0 && p.stock <= (p.minThreshold || 10)).length}</div>
                </div>
              </div>
              <div className="admin-stat" style={{ background: 'var(--red-pale)', borderColor: 'rgba(220,38,38,.1)' }}>
                <div className="as-icon" style={{ background: 'transparent', color: 'var(--red)' }}>❌</div>
                <div>
                  <div className="as-label">Out of Stock</div>
                  <div className="as-val">{mangoes.filter(p => !p.stock || p.stock <= 0).length}</div>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <div className="ach-title">📊 Stock Threshold Levels</div>
                <button className="add-btn" onClick={() => setActiveAdminTab('products')}>+ Update Stock</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Current Stock</th>
                      <th>Stock Level Bar</th>
                      <th>Min. Threshold</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mangoes.map(p => {
                      const threshold = p.minThreshold || 10;
                      const ratio = Math.min(100, Math.max(0, (p.stock / threshold) * 100));
                      let barClass = 'at-stock-fill';
                      let statusText = 'Good';
                      let statusBadge = 'status-delivered';
                      if (p.stock <= 0) {
                        barClass = 'at-stock-fill critical';
                        statusText = 'OOS';
                        statusBadge = 'status-cancelled';
                      } else if (p.stock <= threshold) {
                        barClass = 'at-stock-fill low';
                        statusText = 'Low';
                        statusBadge = 'status-transit';
                      }

                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="at-product-cell">
                              <div className="at-product-emoji bg-gray1">🥭</div>
                              <div className="at-product-name">{p.name}</div>
                            </div>
                          </td>
                          <td className="text-xs font-semibold text-gray4">{p.sku}</td>
                          <td className="font-bold text-xs">{p.stock} boxes</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div className="at-stock-bar">
                                <div className={barClass} style={{ width: `${ratio}%` }} />
                              </div>
                              <span className="text-[10px] text-gray4 font-black">{ratio.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="font-bold text-xs text-gray3">{threshold}</td>
                          <td>
                            <span className={`order-status ${statusBadge}`}>{statusText}</span>
                          </td>
                          <td>
                            <button onClick={() => handleEditProductClick(p)} className="at-action-btn" title="Edit stock">✏️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROMO CODES & OFFERS TAB */}
        {activeAdminTab === 'coupons' && (
          <div className="admin-tab active" id="atab-coupons">
            <div className="admin-header">
              <div className="admin-title">🎟️ Promo Codes & Offers</div>
              <button className="add-btn" onClick={() => openPromoModal(null)}>+ Create Promo Code</button>
            </div>
            
            <div className="admin-card">
              <div className="coupon-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Promo Code</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Min. Order</th>
                      <th>Usage Count</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map(c => {
                      const expiresDate = new Date(c.expires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                      const isExpired = new Date(c.expires) < new Date();
                      
                      return (
                        <tr key={c.id}>
                          <td><strong style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '.95rem' }}>{c.code}</strong></td>
                          <td className="text-xs font-bold">{c.type === 'percent' ? '% Discount' : 'Flat Discount'}</td>
                          <td className="font-bold text-xs">{c.type === 'percent' ? `${c.value}% off` : `৳${c.value} off`}</td>
                          <td className="text-xs font-black">৳{c.minOrder}</td>
                          <td className="text-xs text-gray4 font-bold">{c.usedCount || 0} / {c.limit || 100}</td>
                          <td className="text-xs font-semibold text-gray4">{expiresDate}</td>
                          <td>
                            {isExpired ? (
                              <span className="coupon-status cs-expired">● Expired</span>
                            ) : (
                              <span className="coupon-status cs-active">● Active</span>
                            )}
                          </td>
                          <td>
                            <div className="at-actions">
                              <button onClick={() => openPromoModal(c)} className="at-action-btn" title="Edit Promo Code">✏️</button>
                              <button onClick={() => handleDeleteCoupon(c.id)} className="at-action-btn danger" title="Delete Promo Code">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SALES ORDERS TAB */}
        {activeAdminTab === 'orders' && (
          <div className="admin-tab active" id="atab-orders">
            <style>{`
              @media print {
                @page { margin: 0; }
                body { background: white; }
                .print-hide { display: none !important; }
              }
              .order-card {
                background: var(--bg-card);
                border: 1.5px solid var(--border-color);
                border-radius: 14px;
                overflow: hidden;
                transition: box-shadow .2s, border-color .2s;
                box-shadow: 0 1px 4px var(--shadow-color);
              }
              .order-card:hover {
                box-shadow: 0 4px 16px var(--shadow-color);
              }
              .order-card.selected {
                border-color: #E8540A;
                box-shadow: 0 0 0 3px rgba(232,84,10,.12);
              }
              .order-card.cancelled {
                border-color: #FECACA;
              }
              .order-card.manual {
                background: var(--bg-card);
              }
              .status-pill {
                display: inline-flex;
                align-items: center;
                gap: .3rem;
                padding: .2rem .7rem;
                border-radius: 100px;
                font-size: .68rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .06em;
                font-family: var(--ff);
              }
              .status-pill.pending   { background: #FFF3E0; color: #D97706; }
              .status-pill.confirmed { background: #EFF6FF; color: #2563EB; }
              .status-pill.shipped   { background: #F5F3FF; color: #7C3AED; }
              .status-pill.delivered { background: #F0FDF4; color: #16A34A; }
              .status-pill.done      { background: #F0FDF4; color: #16A34A; }
              .status-pill.cancelled { background: #FEF2F2; color: #DC2626; }
              .order-action-pill {
                display: inline-flex;
                align-items: center;
                gap: .35rem;
                padding: .45rem 1rem;
                border-radius: 100px;
                font-size: .72rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .05em;
                cursor: pointer;
                border: 1.5px solid var(--border-color);
                background: var(--bg-card);
                color: var(--text-primary);
                transition: all .18s;
                font-family: var(--ff);
              }
              .order-action-pill:hover {
                background: var(--bg-primary);
                color: var(--text-primary);
                border-color: var(--border-color);
              }
              .order-action-pill.primary {
                background: #E8540A;
                color: #fff;
                border-color: #E8540A;
              }
              .order-action-pill.primary:hover {
                background: #121212;
                border-color: #121212;
              }
              .order-action-pill.green {
                background: #F0FDF4;
                color: #16A34A;
                border-color: #BBF7D0;
              }
              .order-action-pill.green:hover {
                background: #16A34A;
                color: #fff;
                border-color: #16A34A;
              }
              .order-action-pill.red {
                background: #FEF2F2;
                color: #DC2626;
                border-color: #FECACA;
              }
              .order-action-pill.red:hover {
                background: #DC2626;
                color: #fff;
                border-color: #DC2626;
              }
              .order-action-pill.wa {
                background: #25D366;
                color: #fff;
                border-color: #25D366;
              }
              .order-action-pill.wa:hover {
                background: #128C7E;
                border-color: #128C7E;
              }
              .order-section-label {
                font-family: var(--ff);
                font-size: .65rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .1em;
                color: var(--text-muted);
                margin-bottom: .5rem;
              }
              .order-modal-backdrop {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 400;
                display: flex; align-items: center; justify-content: center;
                padding: 1rem;
                backdrop-filter: blur(4px);
              }
              .order-modal {
                background: var(--bg-card);
                border-radius: 14px;
                border: 1.5px solid var(--border-color);
                overflow: hidden;
                box-shadow: 0 24px 64px var(--shadow-color);
                width: 100%;
              }
              .order-modal-header {
                padding: 1.25rem 1.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #121212;
                border-bottom: 1.5px solid var(--border-color);
              }
              .order-modal-title {
                font-family: var(--ff-display);
                font-weight: 900;
                font-size: 1.05rem;
                color: #FFFFFF;
                letter-spacing: -.01em;
              }
              .order-modal-close {
                width: 32px; height: 32px;
                border-radius: 100px;
                border: none;
                background: rgba(255,255,255,0.1);
                color: #FFFFFF;
                cursor: pointer;
                font-weight: 800;
                font-size: .9rem;
                display: flex align-items: center; justify-content: center;
                transition: all .18s;
              }
              .order-modal-close:hover {
                background: rgba(255,255,255,0.2);
                color: #fff;
              }
              .order-modal-body { padding: 1.5rem; background: var(--bg-card); }
              .order-modal-footer {
                padding: 1rem 1.5rem;
                background: var(--bg-card);
                border-top: 1.5px solid var(--border-color);
                display: flex;
                gap: .75rem;
              }
              .order-input {
                width: 100%;
                padding: .75rem 1rem;
                border: 1.5px solid var(--border-color);
                border-radius: 10px;
                font-family: var(--ff);
                font-size: .85rem;
                font-weight: 600;
                color: var(--text-primary);
                background: var(--input-bg);
                outline: none;
                transition: border-color .18s, background .18s;
              }
              .order-input:focus {
                border-color: #E8540A;
                background: var(--input-bg);
              }
              .order-input-label {
                display: block;
                font-family: var(--ff);
                font-size: .65rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .1em;
                color: var(--text-muted);
                margin-bottom: .45rem;
              }
              .order-receipt-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-family: var(--ff);
                font-size: .8rem;
                font-weight: 600;
                padding: .35rem 0;
              }
              .order-expand-panel {
                background: #F7F7F7;
                border-top: 1.5px solid #EEEEEE;
                padding: 1.25rem 1.5rem;
              }
            `}</style>

            <div className="print-hide space-y-5">

              {/* ── HEADER ─────────────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 14, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px var(--shadow-color)' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0, letterSpacing: '-.02em' }}>
                    {showTrash ? '🗑 Trash Bin' : '🛒 Order Management'}
                  </h2>
                  <p style={{ fontFamily: 'var(--ff)', fontSize: '.78rem', color: 'var(--text-muted)', fontWeight: 600, margin: '.2rem 0 0' }}>
                    {showTrash ? 'Restore or permanently delete trashed orders.' : `${orders.filter(o => !o.deleted).length} active orders`}
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', alignItems: 'center' }}>
                  {showTrash ? (
                    <button
                      onClick={() => { setShowTrash(false); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                      style={{ display:'inline-flex',alignItems:'center',gap:'.4rem',padding:'.55rem 1.2rem',borderRadius:100,border:'1.5px solid #EEEEEE',background:'#121212',color:'#fff',fontFamily:'var(--ff)',fontSize:'.75rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.05em',cursor:'pointer' }}
                    >
                      ← Back to Orders
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => window.print()}
                        style={{ display:'inline-flex',alignItems:'center',gap:'.4rem',padding:'.55rem 1.2rem',borderRadius:100,border:'1.5px solid #EEEEEE',background:'#F7F7F7',color:'#555',fontFamily:'var(--ff)',fontSize:'.75rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.05em',cursor:'pointer',transition:'all .18s' }}
                        onMouseOver={e=>{ e.currentTarget.style.background='#121212'; e.currentTarget.style.color='#fff'; }}
                        onMouseOut={e=>{ e.currentTarget.style.background='#F7F7F7'; e.currentTarget.style.color='#555'; }}
                      >
                        🖨️ Print All
                      </button>
                      <button
                        onClick={() => {
                          const activeOrders = orders.filter(o => !o.deleted);
                          if (!activeOrders.length) return;
                          const headers = ['Order ID','Customer','Phone','Address','Items','Subtotal','Delivery Fee','Total','Status','Date'];
                          const rows = activeOrders.map(o => [
                            o.id, o.deliveryName||o.customerName||o.customerEmail||'Unknown',
                            o.deliveryPhone||o.customerPhone||'N/A',
                            `"${(o.deliveryAddress||'N/A').replace(/"/g,'""')}"`,
                            `"${(o.items||[]).map(i=>`${i.quantity||1}x ${i.name||'Item'}`).join(', ')}"`,
                            o.subtotal||0, o.deliveryFee||0, o.total||0,
                            o.status||'Pending',
                            o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'N/A'
                          ]);
                          const csv = [headers.join(','),...rows.map(r=>r.join(','))].join('\n');
                          const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href=url; a.download=`orders_${new Date().toISOString().slice(0,10)}.csv`; a.click();
                          URL.revokeObjectURL(url);
                          toast.success('CSV exported!');
                        }}
                        style={{ display:'inline-flex',alignItems:'center',gap:'.4rem',padding:'.55rem 1.2rem',borderRadius:100,border:'1.5px solid #BBF7D0',background:'#F0FDF4',color:'#16A34A',fontFamily:'var(--ff)',fontSize:'.75rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.05em',cursor:'pointer',transition:'all .18s' }}
                        onMouseOver={e=>{ e.currentTarget.style.background='#16A34A'; e.currentTarget.style.color='#fff'; }}
                        onMouseOut={e=>{ e.currentTarget.style.background='#F0FDF4'; e.currentTarget.style.color='#16A34A'; }}
                      >
                        📥 Export CSV
                      </button>
                      <button
                        onClick={() => { setShowTrash(true); setSelectedOrders(new Set()); setExpandedOrder(null); }}
                        style={{ position:'relative',display:'inline-flex',alignItems:'center',gap:'.4rem',padding:'.55rem 1.2rem',borderRadius:100,border:'1.5px solid #EEEEEE',background:'#F7F7F7',color:'#888',fontFamily:'var(--ff)',fontSize:'.75rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.05em',cursor:'pointer',transition:'all .18s' }}
                        onMouseOver={e=>{ e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.color='#DC2626'; e.currentTarget.style.borderColor='#FECACA'; }}
                        onMouseOut={e=>{ e.currentTarget.style.background='#F7F7F7'; e.currentTarget.style.color='#888'; e.currentTarget.style.borderColor='#EEEEEE'; }}
                        title="Open Trash Bin"
                      >
                        🗑 Trash
                        {orders.filter(o => o.deleted).length > 0 && (
                          <span style={{ position:'absolute',top:-6,right:-6,background:'#DC2626',color:'#fff',fontSize:'.6rem',fontWeight:900,width:18,height:18,borderRadius:100,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 6px rgba(220,38,38,.4)' }}>
                            {orders.filter(o => o.deleted).length}
                          </span>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── STATUS FILTER PILLS ──────────────────────────────── */}
              <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'All',       value: 'All Status', icon: '📋', color: '#6B7280', pale: '#F3F4F6' },
                  { label: 'Pending',   value: 'Pending',    icon: '⏳', color: '#D97706', pale: '#FFF3E0' },
                  { label: 'Confirmed', value: 'Confirmed',  icon: '⚙️', color: '#2563EB', pale: '#EFF6FF' },
                  { label: 'Shipped',   value: 'Shipped',    icon: '🚚', color: '#7C3AED', pale: '#F5F3FF' },
                  { label: 'Delivered', value: 'Delivered',  icon: '✅', color: '#16A34A', pale: '#F0FDF4' },
                  { label: 'Cancelled', value: 'Cancelled',  icon: '✕',  color: '#DC2626', pale: '#FEF2F2' },
                ].map(tab => {
                  const pool = orders.filter(o => showTrash ? o.deleted : !o.deleted);
                  const count = tab.value === 'All Status' ? pool.length : pool.filter(o => o.status === tab.value).length;
                  const isActive = orderStatusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => { setOrderStatusFilter(tab.value); setOrdersPage(1); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '.4rem',
                        padding: '.45rem 1rem', borderRadius: 100,
                        fontFamily: 'var(--ff)', fontSize: '.75rem', fontWeight: 800,
                        cursor: 'pointer', transition: 'all .18s',
                        border: isActive ? `1.5px solid ${tab.color}` : '1.5px solid #EEEEEE',
                        background: isActive ? tab.color : '#fff',
                        color: isActive ? '#fff' : '#888',
                        boxShadow: isActive ? `0 4px 12px ${tab.color}30` : 'none',
                      }}
                    >
                      <span style={{ fontSize: '.8rem' }}>{tab.icon}</span>
                      {tab.label}
                      <span style={{
                        fontSize: '.62rem', fontWeight: 900, padding: '.1rem .4rem', borderRadius: 100,
                        background: isActive ? 'rgba(255,255,255,.25)' : '#F7F7F7',
                        color: isActive ? '#fff' : '#BBBBBB',
                        minWidth: 18, textAlign: 'center',
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── SEARCH + BULK ACTIONS ────────────────────────────── */}
              <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px var(--shadow-color)' }}>
                {selectedOrders.size > 0 && (
                  <div style={{ padding: '.85rem 1.25rem', background: 'rgba(232,84,10,.06)', borderBottom: '1.5px solid rgba(232,84,10,.15)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                      <span style={{ fontFamily: 'var(--ff)', fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', color: '#E8540A' }}>Bulk Actions</span>
                      <span style={{ background: '#E8540A', color: '#fff', fontFamily: 'var(--ff)', fontSize: '.68rem', fontWeight: 900, padding: '.15rem .6rem', borderRadius: 100 }}>{selectedOrders.size} selected</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {['Done','Shipped','Delivered','Cancelled'].map(s => (
                        <button key={s} onClick={() => handleBatchStatus(s)} disabled={batchUpdating} className="order-action-pill" style={s==='Cancelled'?{background:'#FEF2F2',color:'#DC2626',borderColor:'#FECACA'}:{}}>{s==='Cancelled'?'✕ ':''}{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ padding: '.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '.6rem', background: 'var(--input-bg)', border: '1.5px solid var(--border-color)', borderRadius: 100, padding: '.5rem 1rem', transition: 'border-color .18s' }}>
                    <span style={{ fontSize: '.9rem' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Search by order ID, name, or phone…"
                      value={orderSearch}
                      onChange={e => { setOrderSearch(e.target.value); setOrdersPage(1); }}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--ff)', fontSize: '.82rem', fontWeight: 600, color: 'var(--text-primary)', width: '100%' }}
                    />
                    {orderSearch && (
                      <button onClick={() => setOrderSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBBBBB', fontSize: '.9rem', fontWeight: 900 }}>✕</button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── FLOATING BATCH BAR ───────────────────────────────── */}
              <AnimatePresence>
                {selectedOrders.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    style={{ position:'fixed',bottom:32,left:'50%',transform:'translateX(-50%)',zIndex:50,background:'rgba(18,18,18,.92)',backdropFilter:'blur(16px)',color:'#fff',borderRadius:100,padding:'.6rem 1.25rem',boxShadow:'0 8px 32px rgba(0,0,0,.28)',display:'flex',alignItems:'center',gap:'1rem',border:'1px solid rgba(255,255,255,.1)',maxWidth:'95vw',overflowX:'auto' }}
                  >
                    <span style={{ fontFamily:'var(--ff)',fontWeight:900,fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.1em',background:'#E8540A',padding:'.2rem .7rem',borderRadius:100,shrink:0 }}>{selectedOrders.size}</span>
                    {['Done','Shipped','Delivered'].map(s => (
                      <button key={s} onClick={() => handleBatchStatus(s)} disabled={batchUpdating} style={{ fontFamily:'var(--ff)',fontWeight:800,fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.05em',color:'rgba(255,255,255,.7)',background:'transparent',border:'none',cursor:'pointer',padding:'.35rem .7rem',borderRadius:100,transition:'all .15s',flexShrink:0 }}
                        onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,.15)'; e.currentTarget.style.color='#fff'; }}
                        onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,.7)'; }}
                      >{s}</button>
                    ))}
                    <div style={{ width:1,height:20,background:'rgba(255,255,255,.15)',flexShrink:0 }}></div>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Move ${selectedOrders.size} order(s) to trash?`)) return;
                        setBatchUpdating(true);
                        await Promise.all([...selectedOrders].map(id => updateDoc(doc(db,'orders',id),{deleted:true})));
                        setOrders(orders.map(o => selectedOrders.has(o.id) ? {...o,deleted:true} : o));
                        toast.success(`${selectedOrders.size} order(s) moved to trash.`);
                        setSelectedOrders(new Set());
                        setBatchUpdating(false);
                      }}
                      disabled={batchUpdating}
                      style={{ fontFamily:'var(--ff)',fontWeight:800,fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.05em',color:'#FCA5A5',background:'transparent',border:'none',cursor:'pointer',padding:'.35rem .7rem',borderRadius:100,transition:'all .15s',flexShrink:0 }}
                    >🗑 Trash</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── ORDER CARDS ──────────────────────────────────────── */}
              {(() => {
                const displayOrders = orders
                  .filter(o => showTrash ? o.deleted : !o.deleted)
                  .filter(o => {
                    if (orderSearch.trim()) {
                      const q = orderSearch.toLowerCase();
                      if (!o.id.toLowerCase().includes(q) &&
                          !(o.deliveryName||o.customerName||'').toLowerCase().includes(q) &&
                          !(o.customerEmail||'').toLowerCase().includes(q) &&
                          !(o.deliveryPhone||'').includes(q)) return false;
                    }
                    if (orderStatusFilter !== 'All Status' && o.status !== orderStatusFilter) return false;
                    return true;
                  });

                if (displayOrders.length === 0) return (
                  <div style={{ textAlign:'center',padding:'4rem 1rem',background:'var(--bg-card)',border:'1.5px dashed var(--border-color)',borderRadius:14 }}>
                    <div style={{ fontSize:'2.5rem',marginBottom:'.75rem' }}>📭</div>
                    <p style={{ fontFamily:'var(--ff)',fontSize:'.85rem',fontWeight:700,color:'#BBBBBB' }}>
                      {showTrash ? 'Trash is empty.' : `No ${orderStatusFilter !== 'All Status' ? orderStatusFilter.toLowerCase()+' ' : ''}orders found.`}
                    </p>
                  </div>
                );

                const statusMeta = {
                  Pending:   { cls: 'pending',   icon: '⏳' },
                  Confirmed: { cls: 'confirmed', icon: '⚙️' },
                  Shipped:   { cls: 'shipped',   icon: '🚚' },
                  Delivered: { cls: 'delivered', icon: '✅' },
                  Done:      { cls: 'done',      icon: '✔' },
                  Cancelled: { cls: 'cancelled', icon: '✕' },
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                    {/* Select all row */}
                    <div style={{ display:'flex',alignItems:'center',gap:'.6rem',padding:'0 .25rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedOrders.size === displayOrders.length && displayOrders.length > 0}
                        onChange={() => {
                          if (selectedOrders.size === displayOrders.length) setSelectedOrders(new Set());
                          else setSelectedOrders(new Set(displayOrders.map(o => o.id)));
                        }}
                        style={{ width:16,height:16,accentColor:'#E8540A',cursor:'pointer' }}
                      />
                      <span style={{ fontFamily:'var(--ff)',fontSize:'.68rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',color:'#BBBBBB' }}>
                        Select All ({displayOrders.length})
                      </span>
                    </div>

                    {displayOrders.map(order => {
                      const sm = statusMeta[order.status] || { cls: 'pending', icon: '⏳' };
                      const isExpanded = expandedOrder === order.id;
                      const isSelected = selectedOrders.has(order.id);
                      const orderDate = order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
                        : new Date(order.createdAt?.seconds ? order.createdAt.seconds*1000 : order.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

                      return (
                        <div key={order.id} className={`order-card${isSelected?' selected':''}${order.status==='Cancelled'?' cancelled':''}${order.isManual?' manual':''}`}>

                          {/* Cancelled banner */}
                          {order.status === 'Cancelled' && (
                            <div style={{ background:'#DC2626',color:'#fff',fontFamily:'var(--ff)',fontWeight:800,fontSize:'.68rem',textTransform:'uppercase',letterSpacing:'.08em',padding:'.4rem 1.25rem' }}>
                              ✕ Order Cancelled {order.cancelReason ? `• ${order.cancelReason}` : ''}
                            </div>
                          )}

                          {/* Main row */}
                          <div style={{ padding:'1.1rem 1.25rem',display:'flex',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => { e.stopPropagation(); toggleSelectOrder(order.id); }}
                              onClick={e => e.stopPropagation()}
                              style={{ width:16,height:16,accentColor:'#E8540A',cursor:'pointer',flexShrink:0,marginTop:4 }}
                            />

                            <div style={{ flex:1,cursor:'pointer',minWidth:0 }} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap',marginBottom:'.35rem' }}>
                                <span style={{ fontFamily:'monospace',fontWeight:800,fontSize:'.7rem',color:'#BBBBBB',letterSpacing:'.05em' }}>#{order.id?.slice(-6).toUpperCase()}</span>
                                <span style={{ fontFamily:'var(--ff)',fontSize:'.7rem',color:'#BBBBBB',fontWeight:600 }}>{orderDate}</span>
                                <span className={`status-pill ${sm.cls}`}>{sm.icon} {order.status}</span>
                                {order.isManual && <span style={{ background:'#EFF6FF',color:'#2563EB',fontFamily:'var(--ff)',fontSize:'.62rem',fontWeight:900,padding:'.15rem .55rem',borderRadius:100,textTransform:'uppercase',letterSpacing:'.06em' }}>Offline Sale</span>}
                                {order.trackingLink && <span style={{ background:'#F5F3FF',color:'#7C3AED',fontFamily:'var(--ff)',fontSize:'.62rem',fontWeight:900,padding:'.15rem .55rem',borderRadius:100,textTransform:'uppercase',letterSpacing:'.06em' }}>📦 Tracked</span>}
                              </div>

                              <h3 style={{ fontFamily:'var(--ff-display)',fontWeight:900,fontSize:'1.05rem',color:'#121212',margin:'0 0 .3rem',letterSpacing:'-.01em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                                {order.deliveryName || order.customerName || order.customerEmail || 'Unknown Customer'}
                              </h3>

                              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' }}>
                                <span style={{ fontFamily:'var(--ff-display)',fontWeight:800,fontSize:'.95rem',color:'#E8540A' }}>
                                  ৳{order.total || 0}
                                </span>
                                {order.deliveryPhone && (
                                  <span style={{ fontFamily:'var(--ff)',fontSize:'.75rem',color:'#888',fontWeight:600 }}>{order.deliveryPhone}</span>
                                )}
                                <span style={{ fontFamily:'var(--ff)',fontSize:'.72rem',color:'#BBBBBB' }}>•</span>
                                <span style={{ fontFamily:'var(--ff)',fontSize:'.75rem',color:'#888',fontWeight:600 }}>
                                  Status:
                                </span>
                                <select
                                  value={order.status || 'Pending'}
                                  onChange={e => handleUpdateStatus(order.id, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontFamily:'var(--ff)',fontWeight:800,fontSize:'.75rem',
                                    background:'transparent',border:'none',outline:'none',cursor:'pointer',
                                    color: (order.status==='Done'||order.status==='Delivered') ? '#16A34A' : order.status==='Cancelled' ? '#DC2626' : '#E8540A',
                                    borderBottom: '1.5px solid transparent',
                                    transition: 'border-color .18s',
                                    padding: '0 .15rem',
                                  }}
                                  onMouseOver={e=>e.target.style.borderBottomColor='#EEEEEE'}
                                  onMouseOut={e=>e.target.style.borderBottomColor='transparent'}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Confirmed">Confirmed</option>
                                  <option value="Shipped">Shipped</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Done">Done</option>
                                  <option value="Cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>

                            <div style={{ display:'flex',alignItems:'center',gap:'.6rem',flexShrink:0 }}>
                              {!showTrash && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                                  style={{ background:'none',border:'none',cursor:'pointer',color:'#FECACA',transition:'color .18s',padding:'.35rem',borderRadius:8 }}
                                  onMouseOver={e=>e.currentTarget.style.color='#DC2626'}
                                  onMouseOut={e=>e.currentTarget.style.color='#FECACA'}
                                  title="Move to Trash"
                                >
                                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              )}
                              {showTrash && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleRestoreOrder(order.id); }}
                                  style={{ background:'none',border:'none',cursor:'pointer',color:'#BBF7D0',transition:'color .18s',padding:'.35rem',borderRadius:8 }}
                                  onMouseOver={e=>e.currentTarget.style.color='#16A34A'}
                                  onMouseOut={e=>e.currentTarget.style.color='#BBF7D0'}
                                  title="Restore"
                                >
                                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"/></svg>
                                </button>
                              )}
                              <button
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                style={{ display:'inline-flex',alignItems:'center',gap:'.3rem',padding:'.4rem .85rem',borderRadius:100,border:'1.5px solid #EEEEEE',background:'#F7F7F7',color:'#888',fontFamily:'var(--ff)',fontSize:'.68rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.07em',cursor:'pointer',transition:'all .18s' }}
                                onMouseOver={e=>{ e.currentTarget.style.background='#121212'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#121212'; }}
                                onMouseOut={e=>{ e.currentTarget.style.background='#F7F7F7'; e.currentTarget.style.color='#888'; e.currentTarget.style.borderColor='#EEEEEE'; }}
                              >
                                {isExpanded ? '▲ Close' : '▼ Details'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded panel */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className="order-expand-panel">
                                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginBottom:'1.25rem' }} className="md:grid-cols-2 grid-cols-1">

                                    {/* Delivery Info */}
                                    <div>
                                      <div className="order-section-label">📍 Delivery Info</div>
                                      <div style={{ background:'var(--bg-card)',border:'1.5px solid var(--border-color)',borderRadius:10,padding:'1rem',display:'flex',flexDirection:'column',gap:'.5rem' }}>
                                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                                          <span style={{ fontFamily:'var(--ff)',fontSize:'.75rem',color:'var(--text-muted)',fontWeight:700 }}>Phone</span>
                                          <span style={{ fontFamily:'var(--ff)',fontWeight:800,fontSize:'.82rem',color:'#2563EB' }}>{order.deliveryPhone || 'N/A'}</span>
                                        </div>
                                        <div style={{ height:1,background:'var(--border-color)' }}></div>
                                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem' }}>
                                          <span style={{ fontFamily:'var(--ff)',fontSize:'.75rem',color:'var(--text-muted)',fontWeight:700,flexShrink:0 }}>Address</span>
                                          <div style={{ display:'flex',alignItems:'flex-start',gap:'.35rem' }}>
                                            <span style={{ fontFamily:'var(--ff)',fontWeight:700,fontSize:'.8rem',color:'var(--text-primary)',textAlign:'right',whiteSpace:'pre-line',lineHeight:1.5 }}>{order.deliveryAddress || 'N/A'}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleOpenEditOrderSteps(order);
                                                setEditOrderStepsActiveTab('shipping');
                                              }}
                                              style={{ background:'none',border:'none',cursor:'pointer',color:'#BBBBBB',padding:'.15rem',borderRadius:6,flexShrink:0,transition:'color .18s' }}
                                              onMouseOver={e=>e.currentTarget.style.color='#E8540A'}
                                              onMouseOut={e=>e.currentTarget.style.color='#BBBBBB'}
                                              title="Edit Address"
                                            >
                                              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                            </button>
                                          </div>
                                        </div>
                                        {order.deliveryPostcode && (
                                          <>
                                            <div style={{ height:1,background:'var(--border-color)' }}></div>
                                            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem' }}>
                                              <span style={{ fontFamily:'var(--ff)',fontSize:'.75rem',color:'var(--text-muted)',fontWeight:700,flexShrink:0 }}>Postal Code</span>
                                              <span style={{ fontFamily:'var(--ff)',fontWeight:700,fontSize:'.8rem',color:'var(--text-primary)',textAlign:'right' }}>{order.deliveryPostcode}</span>
                                            </div>
                                          </>
                                        )}
                                        {order.deliveryCoords && (
                                          <a href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`} target="_blank" rel="noreferrer"
                                            style={{ display:'inline-flex',alignItems:'center',gap:'.3rem',background:'rgba(232,84,10,.08)',color:'#E8540A',border:'1.5px solid rgba(232,84,10,.2)',borderRadius:100,padding:'.25rem .7rem',fontFamily:'var(--ff)',fontSize:'.65rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',textDecoration:'none',transition:'all .18s' }}
                                          >
                                            📍 View on Map
                                          </a>
                                        )}
                                        {order.trackingLink && (
                                          <a href={order.trackingLink.startsWith('http')?order.trackingLink:`https://${order.trackingLink}`} target="_blank" rel="noreferrer"
                                            style={{ display:'inline-flex',alignItems:'center',gap:'.3rem',background:'rgba(124,58,237,.08)',color:'#7C3AED',border:'1.5px solid rgba(124,58,237,.2)',borderRadius:100,padding:'.25rem .7rem',fontFamily:'var(--ff)',fontSize:'.65rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',textDecoration:'none' }}
                                          >
                                            🔗 View Tracking
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    {/* Items + Receipt */}
                                    <div>
                                      <div className="order-section-label">🛍 Items & Receipt</div>
                                      <div style={{ background:'var(--bg-card)',border:'1.5px solid var(--border-color)',borderRadius:10,padding:'1rem' }}>
                                        <ul style={{ listStyle:'none',padding:0,margin:'0 0 .75rem' }}>
                                          {order.items?.map((item, idx) => (
                                            <li key={idx} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'var(--ff)',fontWeight:700,fontSize:'.8rem',color:'var(--text-primary)',padding:'.3rem 0',borderBottom:'1px dashed var(--border-color)' }}>
                                              <span>{item.quantity||1}× {item.name||'Item'} {item.weight?`(${item.weight}kg)`:''}</span>
                                              <span style={{ fontWeight:800,color:'#E8540A' }}>৳{((item.discountPrice||item.price||0)*(item.quantity||1))}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        <div style={{ borderTop:'1.5px solid var(--border-color)',paddingTop:'.6rem' }}>
                                          <div className="order-receipt-row" style={{ color:'var(--text-muted)' }}>
                                            <span>Subtotal</span>
                                            <span>৳{order.subtotal||Math.max(0,(order.total||0)-(order.deliveryFee||0)+(order.discount||0))}</span>
                                          </div>
                                          <div className="order-receipt-row" style={{ color:'#2563EB' }}>
                                            <span>Delivery Fee {order.totalWeight?`(${order.totalWeight}kg)`:''}</span>
                                            <span>৳{order.deliveryFee||0}</span>
                                          </div>
                                          {(order.discount>0||(order.promoUsed&&order.promoUsed!=='None')) && (
                                            <div className="order-receipt-row" style={{ color:'#E8540A' }}>
                                              <span>Discount {order.promoUsed&&order.promoUsed!=='None'?`(${order.promoUsed})`:''}</span>
                                              <span>-৳{order.discount||0}</span>
                                            </div>
                                          )}
                                          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'var(--ff-display)',fontWeight:900,fontSize:'.95rem',color:'var(--text-primary)',paddingTop:'.5rem',borderTop:'2px dashed var(--border-color)',marginTop:'.35rem' }}>
                                            <span style={{ display:'flex',alignItems:'center',gap:'.35rem' }}>
                                              Total
                                              <button
                                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleOpenEditOrderSteps(order); setEditOrderStepsActiveTab('delivery'); }}
                                                style={{ background:'none',border:'none',cursor:'pointer',color:'#BBBBBB',padding:'.1rem',transition:'color .18s' }}
                                                onMouseOver={e=>e.currentTarget.style.color='#E8540A'}
                                                onMouseOut={e=>e.currentTarget.style.color='#BBBBBB'}
                                              >
                                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                              </button>
                                            </span>
                                            <span style={{ color:'#E8540A' }}>৳{order.total||0}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action buttons */}
                                  <div style={{ display:'flex',flexWrap:'wrap',gap:'.5rem',paddingTop:'.85rem',borderTop:'1.5px solid #EEEEEE' }}>
                                    {order.deliveryPhone && order.status !== 'Cancelled' && (
                                      <a href={createWhatsAppLink(order)} target="_blank" rel="noreferrer" className="order-action-pill wa">
                                        <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.299 1.263.478 1.694.611.712.22 1.36.189 1.872.114.576-.084 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                        WA Confirm
                                      </a>
                                    )}
                                    {order.status !== 'Done' && order.status !== 'Cancelled' && (
                                      <button onClick={() => handleUpdateStatus(order.id,'Done')} className="order-action-pill primary">✔ Mark Done</button>
                                    )}
                                    <button onClick={() => handlePrintSingleOrder(order.id)} className="order-action-pill">🖨️ Print Receipt</button>
                                    {order.status !== 'Cancelled' && (
                                      <button onClick={() => handleAddTracking(order.id)} className="order-action-pill" style={order.trackingLink?{background:'#EFF6FF',color:'#2563EB',borderColor:'#BFDBFE'}:{}}>
                                        {order.trackingLink ? '📦 Edit Tracking' : '📦 Add Tracking'}
                                      </button>
                                    )}
                                    {order.trackingLink && (
                                      <a href={order.trackingLink.startsWith('http')?order.trackingLink:`https://${order.trackingLink}`} target="_blank" rel="noreferrer"
                                        style={{ fontFamily:'var(--ff)',fontSize:'.72rem',fontWeight:800,color:'#7C3AED',textDecoration:'underline',alignSelf:'center' }}
                                      >View Link</a>
                                    )}
                                    {order.status !== 'Cancelled' && (
                                      <button onClick={() => handleOpenEditOrderSteps(order)} className="order-action-pill primary" style={{ background: '#E8540A', borderColor: '#E8540A' }}>✏️ Edit Order</button>
                                    )}
                                    {showTrash ? (
                                      <>
                                        <button onClick={() => handleRestoreOrder(order.id)} className="order-action-pill green" style={{ marginLeft:'auto' }}>↩ Restore</button>
                                        <button onClick={() => handlePermanentDelete(order.id)} className="order-action-pill red">🗑 Delete Forever</button>
                                      </>
                                    ) : (
                                      <button onClick={() => handleDeleteOrder(order.id)} className="order-action-pill red" style={{ marginLeft:'auto' }}>Move to Trash</button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── MODALS ───────────────────────────────────────────── */}

              {/* Confirm Modal */}
              {confirmModal.isOpen && (
                <div className="order-modal-backdrop">
                  <div className="order-modal" style={{ maxWidth: 380 }}>
                    <div className="order-modal-header">
                      <h3 className="order-modal-title">{confirmModal.title}</h3>
                      <button className="order-modal-close" onClick={() => setConfirmModal({...confirmModal,isOpen:false})}>✕</button>
                    </div>
                    <div className="order-modal-body">
                      <p style={{ fontFamily:'var(--ff)',fontSize:'.82rem',fontWeight:600,color:'#888',lineHeight:1.65,margin:0 }}>{confirmModal.message}</p>
                    </div>
                    <div className="order-modal-footer">
                      <button className="order-action-pill" style={{ flex:1,justifyContent:'center' }} onClick={() => setConfirmModal({...confirmModal,isOpen:false})}>Cancel</button>
                      <button className="order-action-pill red" style={{ flex:1,justifyContent:'center' }} onClick={() => { confirmModal.action(); setConfirmModal({...confirmModal,isOpen:false}); }}>Confirm</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Prompt Modal (Add Tracking) */}
              <AnimatePresence>
                {promptModal.isOpen && (
                  <div className="order-modal-backdrop">
                    <motion.div className="order-modal" style={{ maxWidth: 380 }} initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.96}}>
                      <div className="order-modal-header">
                        <h3 className="order-modal-title">{promptModal.title}</h3>
                        <button className="order-modal-close" onClick={() => setPromptModal({...promptModal,isOpen:false})}>✕</button>
                      </div>
                      <div className="order-modal-body">
                        <input
                          type="text"
                          placeholder={promptModal.placeholder}
                          value={promptModal.value}
                          onChange={e => setPromptModal({...promptModal,value:e.target.value})}
                          className="order-input"
                          autoFocus
                        />
                      </div>
                      <div className="order-modal-footer">
                        <button className="order-action-pill" style={{ flex:1,justifyContent:'center' }} onClick={() => setPromptModal({...promptModal,isOpen:false})}>Cancel</button>
                        <button className="order-action-pill primary" style={{ flex:1,justifyContent:'center' }} onClick={() => { promptModal.action(promptModal.value); setPromptModal({...promptModal,isOpen:false}); }}>Save</button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>



              {/* Edit Order Steps Modal */}
              <AnimatePresence>
                {editOrderStepsModal.isOpen && (
                  <div className="order-modal-backdrop">
                    <motion.div 
                      className="order-modal" 
                      style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
                      initial={{ opacity: 0, scale: 0.96 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.96 }}
                    >
                      <div className="order-modal-header">
                        <h3 className="order-modal-title">✏️ Edit Order Flow (Order #{editOrderStepsModal.orderId?.slice(-6).toUpperCase()})</h3>
                        <button className="order-modal-close" onClick={() => setEditOrderStepsModal({ isOpen: false, orderId: null })}>✕</button>
                      </div>

                      {/* Tab bar */}
                      <div style={{ display: 'flex', background: 'var(--gray1)', borderBottom: '1.5px solid var(--border-color)', padding: '0.5rem 1.25rem 0', gap: '0.25rem', overflowX: 'auto' }}>
                        {[
                          { id: 'items', label: '🛒 Step 1: Items' },
                          { id: 'packaging', label: '📦 Step 2: Packaging' },
                          { id: 'delivery', label: '🚚 Step 3: Courier' },
                          { id: 'shipping', label: '📍 Step 4: Shipping Info' }
                        ].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setEditOrderStepsActiveTab(t.id)}
                            style={{
                              padding: '0.6rem 1.1rem',
                              fontFamily: 'var(--ff)',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: editOrderStepsActiveTab === t.id ? 'var(--bg-card)' : 'transparent',
                              color: editOrderStepsActiveTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                              border: '1.5px solid var(--border-color)',
                              borderBottom: editOrderStepsActiveTab === t.id ? '1.5px solid var(--bg-card)' : '1.5px solid var(--border-color)',
                              borderTopLeftRadius: '10px',
                              borderTopRightRadius: '10px',
                              cursor: 'pointer',
                              marginBottom: editOrderStepsActiveTab === t.id ? '-1.5px' : '0',
                              zIndex: editOrderStepsActiveTab === t.id ? 2 : 1,
                              whiteSpace: 'nowrap',
                              transition: 'all 0.18s'
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Scrollable Body */}
                      <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="scrollbar-thin">
                        
                        {/* TAB 1: ITEMS */}
                        {editOrderStepsActiveTab === 'items' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="order-section-label">🛒 Items in Order</div>
                            
                            {/* Inventory add row */}
                            <div style={{ background: 'var(--gray1)', padding: '1rem', borderRadius: '12px', border: '1.5px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div style={{ flex: 2, minWidth: '180px' }}>
                                <label className="order-input-label">Select Product to Add</label>
                                <select 
                                  value={addItemProductId} 
                                  onChange={e => setAddItemProductId(e.target.value)}
                                  className="order-input"
                                >
                                  <option value="">-- Choose Product --</option>
                                  {mangoes.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (৳{p.discountPrice || p.price})</option>
                                  ))}
                                </select>
                              </div>

                              {selectedProductForAdd && selectedProductForAdd.weightOptions && selectedProductForAdd.weightOptions.length > 0 && (
                                <div style={{ flex: 1, minWidth: '100px' }}>
                                  <label className="order-input-label">Weight</label>
                                  <select 
                                    value={addItemWeight} 
                                    onChange={e => setAddItemWeight(e.target.value)}
                                    className="order-input"
                                  >
                                    {selectedProductForAdd.weightOptions.map(w => (
                                      <option key={w} value={w}>{w}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div style={{ width: '80px' }}>
                                <label className="order-input-label">Quantity</label>
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={addItemQuantity} 
                                  onChange={e => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="order-input text-center"
                                />
                              </div>

                              <button 
                                type="button" 
                                onClick={handleAddItemToOrder}
                                className="order-action-pill primary"
                                style={{ height: '38px', padding: '0 1.25rem' }}
                              >
                                ➕ Add
                              </button>
                            </div>

                            {/* Items table */}
                            {editOrderItems.length === 0 ? (
                              <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--gray1)', border: '1.5px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                No items in this order. Add products above.
                              </div>
                            ) : (
                              <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--gray1)', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                      <th style={{ padding: '0.75rem 1rem' }}>Product</th>
                                      <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Weight Option</th>
                                      <th style={{ padding: '0.75rem 1rem', width: '100px', textAlign: 'center' }}>Quantity</th>
                                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '100px' }}>Price</th>
                                      <th style={{ padding: '0.75rem 1rem', width: '60px', textAlign: 'center' }}>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {editOrderItems.map((item, idx) => {
                                      const prod = mangoes.find(p => p.id === item.id);
                                      const wOpts = prod?.weightOptions || [];
                                      return (
                                        <tr key={idx} style={{ borderBottom: idx < editOrderItems.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{item.name}</td>
                                          <td style={{ padding: '0.75rem 1rem' }}>
                                            {wOpts.length > 0 ? (
                                              <select 
                                                value={item.selectedWeight || ''} 
                                                onChange={e => handleUpdateItemWeight(idx, e.target.value)}
                                                className="order-input"
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                              >
                                                {wOpts.map(w => (
                                                  <option key={w} value={w}>{w}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.selectedWeight || 'Fixed Weight'}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <input 
                                              type="number" 
                                              min="1" 
                                              value={item.quantity} 
                                              onChange={e => handleUpdateItemQty(idx, e.target.value)}
                                              className="order-input text-center"
                                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '60px', margin: '0 auto' }}
                                            />
                                          </td>
                                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                                            ৳{((item.discountPrice || item.price || 0) * (Number(item.quantity) || 0)).toLocaleString()}
                                          </td>
                                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <button 
                                              type="button" 
                                              onClick={() => handleRemoveItem(idx)}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '1rem', padding: '0.2rem' }}
                                              title="Remove Item"
                                            >
                                              ✕
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 2: PACKAGING */}
                        {editOrderStepsActiveTab === 'packaging' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="order-section-label">📦 Packaging Options (Weight: {editedTotalWeight.toFixed(2)} kg)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.85rem' }}>
                              <div 
                                onClick={() => setEditOrderPackagingId('')}
                                className={`premium-radio-card ${!editOrderPackagingId ? 'selected' : ''}`}
                                style={{ padding: '1rem', display: 'flex', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', border: !editOrderPackagingId ? '2px solid var(--primary)' : '1.5px solid var(--border-color)', borderRadius: '12px' }}
                              >
                                <div className="premium-radio-circle" style={{ borderColor: !editOrderPackagingId ? 'var(--primary)' : 'var(--border-color)', backgroundColor: !editOrderPackagingId ? 'var(--primary)' : 'transparent' }}></div>
                                <div>
                                  <p style={{ fontWeight: 800, fontSize: '.82rem', margin: 0 }}>📦 No Packaging</p>
                                  <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>No packaging charges</p>
                                </div>
                              </div>

                              {packagingOptions.map(pkg => {
                                const isSelected = editOrderPackagingId === pkg.id;
                                const units = Math.ceil(editedTotalWeight / pkg.maxCapacity);
                                const cost = units * pkg.price;
                                return (
                                  <div 
                                    key={pkg.id}
                                    onClick={() => setEditOrderPackagingId(pkg.id)}
                                    className={`premium-radio-card ${isSelected ? 'selected' : ''}`}
                                    style={{ padding: '1rem', display: 'flex', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border-color)', borderRadius: '12px' }}
                                  >
                                    <div className="premium-radio-circle" style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)', backgroundColor: isSelected ? 'var(--primary)' : 'transparent' }}></div>
                                    <div>
                                      <p style={{ fontWeight: 800, fontSize: '.82rem', margin: 0 }}>{pkg.label}</p>
                                      <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>৳{pkg.price}/unit · Holds {pkg.minCapacity}-{pkg.maxCapacity}kg</p>
                                      {editedTotalWeight > 0 && (
                                        <p style={{ fontSize: '.72rem', color: '#E8540A', fontWeight: 800, margin: '0.25rem 0 0' }}>
                                          {units} unit{units > 1 ? 's' : ''} • ৳{cost}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* TAB 3: COURIER DELIVERY */}
                        {editOrderStepsActiveTab === 'delivery' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="order-section-label">🚚 Courier / Delivery (Weight: {editedTotalWeight.toFixed(2)} kg)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                              <div 
                                onClick={() => setEditOrderDeliveryId('')}
                                className={`premium-radio-card ${!editOrderDeliveryId ? 'selected' : ''}`}
                                style={{ padding: '1rem', display: 'flex', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', border: !editOrderDeliveryId ? '2px solid var(--primary)' : '1.5px solid var(--border-color)', borderRadius: '12px' }}
                              >
                                <div className="premium-radio-circle" style={{ borderColor: !editOrderDeliveryId ? 'var(--primary)' : 'var(--border-color)', backgroundColor: !editOrderDeliveryId ? 'var(--primary)' : 'transparent' }}></div>
                                <div>
                                  <p style={{ fontWeight: 800, fontSize: '.82rem', margin: 0 }}>🚚 Custom / Store Pickup</p>
                                  <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Fee entered manually below</p>
                                </div>
                              </div>

                              {deliveryOptions.map(dlv => {
                                const isSelected = editOrderDeliveryId === dlv.id;
                                const fee = dlv.pricingType === 'per_kg'
                                  ? dlv.perKgRate * editedTotalWeight
                                  : dlv.firstKgPrice + (dlv.extraKgRate * Math.max(0, editedTotalWeight - 1));
                                return (
                                  <div 
                                    key={dlv.id}
                                    onClick={() => setEditOrderDeliveryId(dlv.id)}
                                    className={`premium-radio-card ${isSelected ? 'selected' : ''}`}
                                    style={{ padding: '1rem', display: 'flex', gap: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border-color)', borderRadius: '12px' }}
                                  >
                                    <div className="premium-radio-circle" style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)', backgroundColor: isSelected ? 'var(--primary)' : 'transparent' }}></div>
                                    <div>
                                      <p style={{ fontWeight: 800, fontSize: '.82rem', margin: 0 }}>{dlv.label}</p>
                                      <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                                        {dlv.pricingType === 'per_kg' ? `৳${dlv.perKgRate}/kg` : `৳${dlv.firstKgPrice} + ৳${dlv.extraKgRate}/extra kg`}
                                      </p>
                                      {editedTotalWeight > 0 && (
                                        <p style={{ fontSize: '.72rem', color: '#E8540A', fontWeight: 800, margin: '0.25rem 0 0' }}>
                                          Calculated Fee: ৳{fee.toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ background: 'var(--gray1)', padding: '1.25rem', borderRadius: '12px', border: '1.5px solid var(--border-color)' }}>
                              <label className="order-input-label">Delivery Fee Override (৳)</label>
                              <input 
                                type="number" 
                                value={editOrderDeliveryFee} 
                                onChange={e => setEditOrderDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                                className="order-input"
                                style={{ maxWidth: '200px' }}
                              />
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
                                Modify the delivery fee manually. Pre-populated automatically based on courier select.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* TAB 4: SHIPPING INFO */}
                        {editOrderStepsActiveTab === 'shipping' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="order-section-label">📍 Recipient Details</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                              <div>
                                <label className="order-input-label">Recipient Name</label>
                                <input 
                                  type="text" 
                                  value={editOrderRecipientName} 
                                  onChange={e => setEditOrderRecipientName(e.target.value)}
                                  className="order-input"
                                  placeholder="E.g. Adnan Rahman"
                                  required
                                />
                              </div>
                              <div>
                                <label className="order-input-label">Recipient Phone Number</label>
                                <input 
                                  type="text" 
                                  value={editOrderRecipientPhone} 
                                  onChange={e => setEditOrderRecipientPhone(e.target.value)}
                                  className="order-input"
                                  placeholder="E.g. 01712345678"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="order-input-label" style={{ marginBottom: 0 }}>Full Shipping Address</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <button type="button" onClick={() => setShowMapModal(true)} style={{ color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', outline: 'none', padding: 0 }}>🗺️ Pin on Map</button>
                                  {editOrderCoords && (
                                    <a 
                                      href={`https://www.google.com/maps?q=${editOrderCoords.lat},${editOrderCoords.lng}`} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(232,84,10,0.08)', color: '#E8540A', border: '1.5px solid rgba(232,84,10,0.2)', borderRadius: '100px', padding: '0.15rem 0.5rem', fontFamily: 'var(--ff)', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none' }}
                                    >
                                      📍 View on Map
                                    </a>
                                  )}
                                </div>
                              </div>
                              <textarea 
                                value={editOrderAddress} 
                                onChange={e => { setEditOrderAddress(e.target.value); setEditOrderCoords(null); }} 
                                className="order-input"
                                style={{ minHeight: '80px', resize: 'vertical' }}
                                placeholder="House, Road, Area, City..."
                                required
                              />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                              <div>
                                <label className="order-input-label">Postal Code</label>
                                <input 
                                  type="text" 
                                  value={editOrderPostcode} 
                                  onChange={e => setEditOrderPostcode(e.target.value)}
                                  className="order-input"
                                  placeholder="Postal Code"
                                />
                              </div>
                              <div>
                                <label className="order-input-label">Latitude</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={editOrderCoords?.lat ?? ''} 
                                  onChange={e => handleCoordsChange('lat', e.target.value)}
                                  className="order-input"
                                  placeholder="Latitude"
                                />
                              </div>
                              <div>
                                <label className="order-input-label">Longitude</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={editOrderCoords?.lng ?? ''} 
                                  onChange={e => handleCoordsChange('lng', e.target.value)}
                                  className="order-input"
                                  placeholder="Longitude"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Summary & Save footer */}
                      <div className="order-modal-footer" style={{ flexDirection: 'column', gap: '1rem', background: 'var(--gray1)' }}>
                        {/* Cost summary breakdown */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', fontSize: '0.78rem', fontWeight: 700, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Subtotal: <strong style={{ color: 'var(--text-primary)' }}>৳{editedSubtotal.toLocaleString()}</strong></span>
                            {editedPackagingCostInfo.cost > 0 && (
                              <span style={{ color: 'var(--text-muted)' }}>Packaging ({editedPackagingCostInfo.label} ×{editedPackagingCostInfo.units}): <strong style={{ color: 'var(--text-primary)' }}>৳{editedPackagingCostInfo.cost.toLocaleString()}</strong></span>
                            )}
                            <span style={{ color: 'var(--text-muted)' }}>Delivery: <strong style={{ color: 'var(--text-primary)' }}>৳{editOrderDeliveryFee.toLocaleString()}</strong></span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Discount Override:</span>
                              <input 
                                type="number" 
                                value={editOrderDiscount} 
                                onChange={e => setEditOrderDiscount(Math.max(0, Number(e.target.value) || 0))}
                                className="order-input text-right"
                                style={{ width: '80px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              />
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Promo:</span>
                              <input 
                                type="text" 
                                value={editOrderPromoUsed} 
                                onChange={e => setEditOrderPromoUsed(e.target.value)}
                                className="order-input"
                                style={{ width: '100px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Grand total & save buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Grand Total</span>
                            <div style={{ color: '#E8540A', fontFamily: 'var(--ff-display)', fontWeight: 900, fontSize: '1.4rem', marginTop: '0.1rem' }}>
                              ৳{editedTotal.toLocaleString()}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button 
                              type="button" 
                              onClick={() => setEditOrderStepsModal({ isOpen: false, orderId: null })}
                              className="order-action-pill"
                              style={{ padding: '0.6rem 1.5rem', fontSize: '0.8rem' }}
                            >
                              Cancel
                            </button>
                            <button 
                              type="button" 
                              onClick={handleSaveOrderSteps}
                              className="order-action-pill primary"
                              style={{ padding: '0.6rem 1.75rem', fontSize: '0.8rem' }}
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* MAP PIN MODAL */}
              {showMapModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ background: 'var(--bg-card)', borderRadius: '20px', width: '90%', maxWidth: '600px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }}>
                    <div style={{ background: '#121212', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        📍 Pin Shipping Location
                      </h3>
                      <button onClick={() => setShowMapModal(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', padding: 0 }}>✕</button>
                    </div>
                    <div style={{ padding: '0', position: 'relative' }}>
                      <div id="leaflet-map-container" style={{ width: '100%', height: '380px' }}></div>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', fontSize: '2rem' }}>📍</div>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                      <div style={{ margin: '0 0 1.25rem 0' }}>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>Drag the map to position the pin at the exact shipping location. The address coordinates will automatically update.</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button onClick={() => setShowMapModal(false)} className="order-action-pill" style={{ width: 'auto', background: 'transparent', fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleConfirmMapPin} className="order-action-pill primary" style={{ fontWeight: 700, padding: '0.6rem 1.5rem', fontSize: '0.82rem' }}>Confirm Location</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>{/* END print-hide */}

            {/* ── PRINTABLE PACKING SLIPS ─────────────────────────── */}
            <div style={{ display:'none' }} className="print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-[9999] print:p-8">
              <style>{`@media print { .print\\:block { display: block !important; } .print\\:hidden, .print-hide { display: none !important; } }`}</style>
              {(() => {
                const allOrders = orders.filter(o => !o.deleted);
                const printOrders = selectedOrders.size > 0 ? allOrders.filter(o => selectedOrders.has(o.id)) : allOrders;
                return printOrders.map(order => (
                  <div key={`print-${order.id}`} style={{ padding:32,border:'4px solid #000',borderRadius:16,marginBottom:48,pageBreakInside:'avoid',breakInside:'avoid' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'8px solid #000',paddingBottom:16,marginBottom:24 }}>
                      <div>
                        <div style={{ fontSize:36,fontWeight:900,textTransform:'uppercase',letterSpacing:'-0.02em',fontFamily:'Georgia,serif' }}>VERTEX PICKS</div>
                        <div style={{ fontSize:14,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.2em' }}>Premium Delivery</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:28,fontWeight:900,textTransform:'uppercase' }}>Order #{order.id?.slice(-6)}</div>
                        <div style={{ fontSize:13,fontWeight:600,color:'#666' }}>
                          {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt?.seconds?order.createdAt.seconds*1000:order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,marginBottom:32 }}>
                      <div>
                        <div style={{ fontSize:11,fontWeight:900,textTransform:'uppercase',letterSpacing:'.15em',color:'#888',borderBottom:'2px solid #eee',paddingBottom:6,marginBottom:12 }}>Ship To</div>
                        <div style={{ fontSize:22,fontWeight:900,marginBottom:4 }}>{order.deliveryName||order.customerName||order.customerEmail||'Valued Customer'}</div>
                        <div style={{ fontSize:18,fontWeight:800,letterSpacing:'.05em',marginBottom:8 }}>{order.deliveryPhone||'N/A'}</div>
                        <div style={{ fontSize:15,fontWeight:600,lineHeight:1.5,whiteSpace:'pre-line' }}>{order.deliveryAddress||'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11,fontWeight:900,textTransform:'uppercase',letterSpacing:'.15em',color:'#888',borderBottom:'2px solid #eee',paddingBottom:6,marginBottom:12 }}>Order Details</div>
                        <div style={{ fontSize:15,fontWeight:600,marginBottom:6 }}>Weight: <strong style={{ fontSize:20 }}>{order.totalWeight||'N/A'} kg</strong></div>
                        <div style={{ fontSize:15,fontWeight:600 }}>Status: <strong style={{ textTransform:'uppercase' }}>{order.status||'Pending'}</strong></div>
                        {order.isManual&&<div style={{ fontSize:16,fontWeight:900,border:'2px solid #000',display:'inline-block',padding:'4px 12px',marginTop:10,textTransform:'uppercase',letterSpacing:'.1em' }}>Offline Sale</div>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11,fontWeight:900,textTransform:'uppercase',letterSpacing:'.15em',color:'#888',borderBottom:'2px solid #eee',paddingBottom:6,marginBottom:16 }}>Items Included</div>
                      {order.items?.map((item,idx)=>(
                        <div key={idx} style={{ display:'flex',justifyContent:'space-between',fontSize:18,fontWeight:600,borderBottom:'1px dashed #ddd',paddingBottom:12,marginBottom:12 }}>
                          <span>{item.quantity||1}× {item.name||'Item'} {item.weight?`(${item.weight}kg)`:''}</span>
                          <span>৳{((item.discountPrice||item.price||0)*(item.quantity||1))}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'8px solid #000',paddingTop:16,marginTop:8 }}>
                      <span style={{ fontSize:18,fontWeight:900,textTransform:'uppercase',letterSpacing:'.05em' }}>Amount To Collect</span>
                      <span style={{ fontSize:48,fontWeight:900,letterSpacing:'-.02em' }}>৳{order.total||0}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

          </div>
        )}


        {/* TAB 6: REGISTERED CUSTOMERS TAB */}
        {activeAdminTab === 'customers' && (
          <div className="admin-tab active" id="atab-customers">
            <div className="admin-header"><div className="admin-title">👥 Customers</div></div>
            
            {/* Top Customers stats cards */}
            <div className="customer-grid">
              {filteredCustomers.slice(0, 3).map((u) => (
                <div key={u.id} className="cust-card">
                  <div className="cust-card-head">
                    <div className="cust-avatar">{u.name?.charAt(0).toUpperCase() || 'U'}</div>
                    <div>
                      <div className="cust-name">{u.name || 'Connoisseur'}</div>
                      <div className="cust-email">{u.email}</div>
                    </div>
                  </div>
                  <div className="cust-stats">
                    <div className="cs-item"><strong>{orders.filter(o => o.customerEmail === u.email).length}</strong>Orders</div>
                    <div className="cs-item"><strong>৳{orders.filter(o => o.customerEmail === u.email && o.status === 'Delivered').reduce((sum, o) => sum + Number(o.total || 0), 0).toLocaleString()}</strong>Spent</div>
                    <div className="cs-item"><strong>5.0</strong>Rating</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-card">
              <div className="admin-action-bar">
                <div className="aab-left">
                  <div className="aab-search">
                    <span className="aab-search-icon">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search customers..." 
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="aab-right">
                  <button className="add-btn" onClick={() => {
                    const data = filteredCustomers.map(u => {
                      const uOrders = orders.filter(o => o.customerEmail === u.email);
                      const uTotal = uOrders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + Number(o.total || 0), 0);
                      return [u.name || 'Anonymous', u.phone || 'N/A', 'Dhaka', uOrders.length, uTotal];
                    });
                    exportToCSV('customers_list.csv', data, ['Name', 'Phone', 'City', 'Total Orders', 'Total Spent']);
                    toast.success('Customer list exported!');
                  }}>📥 Export</button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>City</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Last Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(u => {
                      const uOrders = orders.filter(o => o.customerEmail === u.email);
                      const uTotal = uOrders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + Number(o.total || 0), 0);
                      const lastOrderDate = uOrders.length > 0 ? new Date(uOrders[0].createdAt?.seconds ? uOrders[0].createdAt.seconds * 1000 : uOrders[0].createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never';
                      
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="at-product-cell">
                              <div className="cust-avatar" style={{ width: '34px', height: '34px', fontSize: '.8rem' }}>{u.name?.charAt(0).toUpperCase() || 'U'}</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{u.name || 'Connoisseur'}</div>
                                <div style={{ fontSize: '.72rem', color: 'var(--gray4)' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs font-bold">{u.phone || 'Guest'}</td>
                          <td className="text-xs font-semibold text-gray4">Dhaka</td>
                          <td className="text-xs font-black">{uOrders.length}</td>
                          <td className="font-display font-extrabold text-sm text-primary">৳{uTotal.toLocaleString()}</td>
                          <td className="text-xs font-semibold text-gray3">{lastOrderDate}</td>
                          <td>
                            {uTotal > 10000 ? (
                              <span className="badge badge-gold">🥭 VIP Gold</span>
                            ) : (
                              <span className="badge badge-green">🌟 Premium</span>
                            )}
                          </td>
                          <td>
                            <div className="at-actions">
                              <button onClick={() => setSelectedCustomerDetails({ ...u, uOrders, uTotal })} className="at-action-btn" title="View Profile">👁️</button>
                              <button onClick={() => handleToggleBlockUser(u.id, u.isBlocked)} className={`at-action-btn ${u.isBlocked ? '' : 'danger'}`} title={u.isBlocked ? 'Unblock User' : 'Block User'}>{u.isBlocked ? '✅' : '🚫'}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: CUSTOMER REVIEWS MODERATION TAB */}
        {activeAdminTab === 'reviews' && (
          <div className="admin-tab active" id="atab-reviews">
            <div className="admin-header">
              <div className="admin-title">⭐ Customer Reviews Moderation</div>
              <div style={{ fontSize: '.8rem', color: 'var(--gray4)', fontWeight: 600 }}>
                {allProductReviews.filter(r => !trashedReviews[r.id] && r.status === 'approved').length} published
                &nbsp;&middot;&nbsp;
                <span style={{ color: pendingReviewsCount > 0 ? '#D97706' : 'var(--gray4)' }}>{pendingReviewsCount} pending approval</span>
                {Object.keys(trashedReviews).length > 0 && (
                  <span style={{ marginLeft: '.75rem', color: '#DC2626' }}>· {Object.keys(trashedReviews).length} pending deletion</span>
                )}
              </div>
            </div>
            <div className="admin-card">
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Rating</th>
                      <th>Review Message</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProductReviews.length > 0 ? (
                      allProductReviews.map(rev => {
                        const isTrashed = !!trashedReviews[rev.id];
                        return (
                          <tr key={rev.id} style={isTrashed ? { opacity: 0.4, background: '#FEF2F2', transition: 'all .3s' } : { transition: 'all .3s' }}>
                            <td style={{ fontWeight: 700, fontSize: '.83rem' }}>{rev.name}</td>
                            <td style={{ fontWeight: 700, fontSize: '.83rem' }}>{rev.productName}</td>
                            <td>
                              <span style={{ color: 'var(--gold)' }}>
                                {'★'.repeat(Math.min(5, Math.max(1, rev.rating))) + '☆'.repeat(Math.max(0, 5 - rev.rating))}
                              </span>
                            </td>
                            <td style={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '.83rem' }} title={rev.text}>
                              "{rev.text}"
                            </td>
                            <td style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--gray4)' }}>{rev.date}</td>
                            <td>
                              {isTrashed
                                ? <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '.2rem .55rem', borderRadius: 100, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>🗑️ Trashed</span>
                                : rev.status === 'pending'
                                  ? <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '.2rem .55rem', borderRadius: 100, background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>⏳ Pending</span>
                                  : <span className="badge badge-green">✅ Published</span>
                              }
                            </td>
                            <td>
                              <div className="at-actions">
                                {isTrashed ? (
                                  <button
                                    className="at-action-btn"
                                    title="Undo deletion"
                                    onClick={() => {
                                      setTrashedReviews(prev => { const n = { ...prev }; delete n[rev.id]; return n; });
                                      clearTimeout(undoTimersRef.current[rev.id]);
                                      delete undoTimersRef.current[rev.id];
                                      toast.success('↩️ Deletion undone!');
                                    }}
                                    style={{ background: '#FEF9C3', borderColor: '#FCD34D', color: '#92400E' }}
                                  >
                                    ↩️
                                  </button>
                                ) : (
                                  <>
                                    {rev.status === 'pending' && !isTrashed && (
                                      <button
                                        onClick={() => handleApproveReview(rev.productId, rev.id)}
                                        className="at-action-btn"
                                        title="Approve review — publishes it publicly"
                                        style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }}
                                      >
                                        ✅
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteReview(rev.productId, rev.id, rev)}
                                      className="at-action-btn danger"
                                      title="Trash review (5s undo)"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--gray4)', padding: '2.5rem', fontWeight: 600 }}>
                          No reviews received for catalog products yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* TAB 7.5: NEWSLETTER LEADS TAB */}
        {activeAdminTab === 'leads' && (
          <div className="admin-tab active" id="atab-leads">
            <div className="admin-header">
              <div className="admin-title">📧 Newsletter Subscribers & Leads</div>
              <div style={{ fontSize: '.8rem', color: 'var(--gray4)', fontWeight: 600 }}>
                {leads.length} subscribers registered
              </div>
            </div>

            {/* Automated Message Templates Form */}
            <div className="admin-card" style={{ marginBottom: '2rem' }}>
              <div className="admin-card-head">
                <div className="ach-title">🤖 Automated Reply Templates</div>
              </div>
              <form onSubmit={handleSaveLeadTemplates} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>📧 Email Body (Bangla)</label>
                  <textarea 
                    name="emailBody"
                    rows="6" 
                    className="form-input" 
                    style={{ resize: 'vertical' }}
                    defaultValue={storeConfig.automatedLeadEmail || ''}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>💬 WhatsApp Message (Bangla)</label>
                  <textarea 
                    name="whatsappBody"
                    rows="4" 
                    className="form-input" 
                    style={{ resize: 'vertical' }}
                    defaultValue={storeConfig.automatedLeadWhatsapp || ''}
                  />
                </div>
                <div>
                  <button type="submit" className="btn-primary">Save Templates</button>
                </div>
              </form>
            </div>

            <div className="admin-card">
              <div className="admin-action-bar">
                <div className="aab-left">
                  <div className="aab-search">
                    <span className="aab-search-icon">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search email or phone..." 
                      value={leadsSearch}
                      onChange={e => setLeadsSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="aab-right">
                  <button 
                    className="add-btn" 
                    onClick={() => {
                      if (leads.length === 0) {
                        toast.error("No subscribers to export!");
                        return;
                      }
                      const emails = leads.map(l => l.email || l.whatsapp || l.emailOrPhone).filter(Boolean).join('\n');
                      navigator.clipboard.writeText(emails);
                      toast.success('📋 Copied all subscriber emails/phones to clipboard!');
                    }}
                  >
                    📋 Copy All
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Subscriber Contact</th>
                      <th>Date Subscribed</th>
                      <th style={{ width: '220px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = leads.filter(l => {
                        const searchTarget = (l.email || '') + ' ' + (l.whatsapp || '') + ' ' + (l.emailOrPhone || '');
                        return searchTarget.toLowerCase().includes(leadsSearch.toLowerCase());
                      });
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', color: 'var(--gray4)', padding: '2.5rem', fontWeight: 600 }}>
                              {leads.length === 0 ? "No newsletter subscribers registered yet." : "No matching subscribers found."}
                            </td>
                          </tr>
                        );
                      }
                      return filtered.map((l) => {
                        // Compatibility variables
                        const hasEmail = l.email || (l.emailOrPhone && l.emailOrPhone.includes('@'));
                        const hasWhatsapp = l.whatsapp || (l.emailOrPhone && !l.emailOrPhone.includes('@'));
                        
                        const displayEmail = l.email || (l.emailOrPhone && l.emailOrPhone.includes('@') ? l.emailOrPhone : null);
                        const displayWhatsapp = l.whatsapp || (l.emailOrPhone && !l.emailOrPhone.includes('@') ? l.emailOrPhone : null);

                        return (
                        <tr key={l.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                              {displayEmail && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                                  <span style={{ fontSize: '1.2rem' }}>📧</span>
                                  <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--dark)' }}>{displayEmail}</span>
                                </div>
                              )}
                              {displayWhatsapp && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                                  <span style={{ fontSize: '1.2rem' }}>📱</span>
                                  <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--dark)' }}>{displayWhatsapp}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '.83rem', fontWeight: 600, color: 'var(--gray4)' }}>
                            {l.createdAt ? new Date(l.createdAt).toLocaleString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </td>
                          <td>
                            <div className="at-actions" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
                              {hasEmail && (
                                <a
                                  href={`mailto:${displayEmail}?subject=${encodeURIComponent('Vertex Picks - আর্লি অ্যাক্সেসে স্বাগতম! 🥭')}&body=${encodeURIComponent(storeConfig.automatedLeadEmail)}`}
                                  target="_blank" rel="noreferrer"
                                  className="at-action-btn"
                                  style={{ background: 'var(--gray1)', border: '1.5px solid var(--gray2)', color: 'var(--dark)', fontWeight: 700, fontSize: '.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.4rem' }}
                                  title="Send Email"
                                >
                                  📧 Reply Email
                                </a>
                              )}
                              {hasWhatsapp && (
                                <a
                                  href={`https://wa.me/${formatLeadPhone(displayWhatsapp)}?text=${encodeURIComponent(storeConfig.automatedLeadWhatsapp)}`}
                                  target="_blank" rel="noreferrer"
                                  className="at-action-btn"
                                  style={{ background: '#25D36615', border: '1.5px solid #25D36630', color: '#128C7E', fontWeight: 700, fontSize: '.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '.4rem' }}
                                  title="Send WhatsApp"
                                >
                                  💬 WhatsApp
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteLead(l.id)}
                                className="at-action-btn danger"
                                title="Remove subscriber"
                                style={{ padding: '.5rem', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7.8: UI CUSTOMIZER TAB */}
        {activeAdminTab === 'customizer' && (
          <div className="admin-tab active" id="atab-customizer">
            <div className="admin-header">
              <div>
                <div className="admin-title">🎨 Dynamic Homepage & UI Customizer</div>
                <div style={{ fontSize: '.82rem', color: 'var(--gray4)' }}>Real-time website text control & dynamic orchestration</div>
              </div>
              <button 
                onClick={handleSaveUIConfig} 
                className="btn-primary shiny-btn !rounded-full shadow-lg shadow-orange-500/20 font-bold uppercase tracking-wider text-[10px] px-8 py-3.5"
              >
                💾 Publish Live updates
              </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              
              {/* LEFT COLUMN: EDIT CONTROLS */}
              <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                

                {/* 1. MARQUEE BADGES CARD */}
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                  <div className="admin-card-head" style={{ padding: '0 0 1rem 0', borderBottom: '1.5px solid var(--gray2)' }}>
                    <div>
                      <div className="ach-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>📢 Marquee Scrolling Badges</div>
                      <div className="ach-sub">These badge items scroll continuously in the banner bar under categories.</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                    <input 
                      type="text" 
                      placeholder="Add scrolling text (e.g. 🎁 Special Eid boxes!)" 
                      className="form-input" 
                      value={newMarqueeText} 
                      onChange={e => setNewMarqueeText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newMarqueeText.trim()) {
                            setMarqueeItems([...marqueeItems, newMarqueeText.trim()]);
                            setNewMarqueeText('');
                            toast.success('Badge added to live preview list!');
                          }
                        }
                      }}
                      style={{ fontSize: '.8rem', fontWeight: 600, padding: '10px 14px', borderRadius: '12px' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        if (newMarqueeText.trim()) {
                          setMarqueeItems([...marqueeItems, newMarqueeText.trim()]);
                          setNewMarqueeText('');
                          toast.success('Badge added to live preview list!');
                        } else {
                          toast.error('Please type something first!');
                        }
                      }}
                      className="btn-primary" 
                      style={{ borderRadius: '12px', padding: '10px 18px', fontWeight: 800, fontSize: '.75rem', textTransform: 'uppercase', flexShrink: 0 }}
                    >
                      + Add
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    {marqueeItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '.6rem 1rem', 
                          background: 'var(--gray1)', 
                          border: '1.5px solid var(--gray2)', 
                          borderRadius: '12px',
                          fontSize: '.8rem',
                          fontWeight: 700,
                          color: 'var(--dark)'
                        }}
                      >
                        {editingMarqueeIndex === idx ? (
                          <input 
                            type="text" 
                            className="form-input" 
                            value={editingMarqueeText} 
                            onChange={(e) => setEditingMarqueeText(e.target.value)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (!editingMarqueeText.trim()) return toast.error('Cannot be empty');
                                const updated = [...marqueeItems];
                                updated[idx] = editingMarqueeText.trim();
                                setMarqueeItems(updated);
                                setEditingMarqueeIndex(null);
                                toast.success('Badge updated!');
                              }
                            }}
                            autoFocus
                            style={{ padding: '.4rem .6rem', fontSize: '.8rem', margin: 0, flex: 1, marginRight: '.5rem' }}
                          />
                        ) : (
                          <span>{item}</span>
                        )}

                        <div style={{ display: 'flex', gap: '.5rem' }}>
                          {editingMarqueeIndex === idx ? (
                            <button 
                              type="button" 
                              onClick={() => {
                                if (!editingMarqueeText.trim()) return toast.error('Cannot be empty');
                                const updated = [...marqueeItems];
                                updated[idx] = editingMarqueeText.trim();
                                setMarqueeItems(updated);
                                setEditingMarqueeIndex(null);
                                toast.success('Badge updated!');
                              }}
                              style={{ padding: '.3rem .6rem', fontSize: '.75rem', background: 'var(--green)', color: '#fff', borderRadius: 4, fontWeight: 'bold' }}
                            >
                              Save
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingMarqueeIndex(idx);
                                setEditingMarqueeText(item);
                              }}
                              style={{ padding: '.3rem .6rem', fontSize: '.75rem', background: 'var(--gray2)', color: 'var(--dark)', borderRadius: 4, fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={() => {
                              const updated = marqueeItems.filter((_, i) => i !== idx);
                              setMarqueeItems(updated);
                              if (editingMarqueeIndex === idx) setEditingMarqueeIndex(null);
                              toast.success('Badge removed!');
                            }}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ef4444', 
                              fontSize: '1rem', 
                              cursor: 'pointer',
                              padding: '0 .25rem',
                              fontWeight: 'bold'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {marqueeItems.length === 0 && (
                      <p style={{ fontSize: '.78rem', color: 'var(--gray4)', fontWeight: 600, textAlign: 'center', padding: '1rem' }}>No scrolling badges listed. Add some above!</p>
                    )}
                  </div>
                </div>

                {/* PROMO BANNERS EDIT CARD */}
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                  <div className="admin-card-head" style={{ padding: '0 0 1rem 0', borderBottom: '1.5px solid var(--gray2)' }}>
                    <div>
                      <div className="ach-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>🏷️ Promotional Banners</div>
                      <div className="ach-sub">Manage the colorful promotion cards displayed on the homepage.</div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        const newBanner = {
                          id: Date.now().toString(),
                          label: 'New Promo',
                          title: 'Special<br />Offer',
                          btnText: 'Shop Now →',
                          btnLink: '/shop',
                          emoji: '✨',
                          color1: '#2563EB',
                          color2: '#1D4ED8'
                        };
                        setPromoBanners([...promoBanners, newBanner]);
                      }}
                      className="btn-primary" 
                      style={{ borderRadius: '12px', padding: '8px 14px', fontWeight: 800, fontSize: '.75rem', textTransform: 'uppercase' }}
                    >
                      + Add Banner
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {promoBanners.map((banner, idx) => (
                      <div key={banner.id || idx} style={{ border: '1px solid var(--gray2)', borderRadius: '16px', padding: '1rem', background: 'var(--bg-secondary)', position: 'relative' }}>
                        <button 
                          type="button"
                          onClick={() => setPromoBanners(promoBanners.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: '.5rem', right: '.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}
                          title="Remove Banner"
                        >
                          ✕
                        </button>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', paddingRight: '2rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '.75rem' }}>Label (Small text)</label>
                            <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 12px' }} value={banner.label} onChange={e => { const up = [...promoBanners]; up[idx].label = e.target.value; setPromoBanners(up); }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '.75rem' }}>Title (Use &lt;br/&gt; for new line)</label>
                            <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 12px' }} value={banner.title} onChange={e => { const up = [...promoBanners]; up[idx].title = e.target.value; setPromoBanners(up); }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '.75rem' }}>Button Text</label>
                            <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 12px' }} value={banner.btnText} onChange={e => { const up = [...promoBanners]; up[idx].btnText = e.target.value; setPromoBanners(up); }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '.75rem' }}>Button Link</label>
                            <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 12px' }} value={banner.btnLink} onChange={e => { const up = [...promoBanners]; up[idx].btnLink = e.target.value; setPromoBanners(up); }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '.75rem' }}>Emoji</label>
                            <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 12px' }} value={banner.emoji} onChange={e => { const up = [...promoBanners]; up[idx].emoji = e.target.value; setPromoBanners(up); }} />
                          </div>
                          
                          <div style={{ display: 'flex', gap: '.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <label className="form-label" style={{ fontSize: '.75rem' }}>Gradient Start</label>
                              <div style={{ display: 'flex', gap: '.25rem' }}>
                                <input type="color" value={banner.color1} onChange={e => { const up = [...promoBanners]; up[idx].color1 = e.target.value; setPromoBanners(up); }} style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                                <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 8px', flex: 1 }} value={banner.color1} onChange={e => { const up = [...promoBanners]; up[idx].color1 = e.target.value; setPromoBanners(up); }} />
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="form-label" style={{ fontSize: '.75rem' }}>Gradient End</label>
                              <div style={{ display: 'flex', gap: '.25rem' }}>
                                <input type="color" value={banner.color2} onChange={e => { const up = [...promoBanners]; up[idx].color2 = e.target.value; setPromoBanners(up); }} style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                                <input className="form-input" style={{ fontSize: '.8rem', padding: '8px 8px', flex: 1 }} value={banner.color2} onChange={e => { const up = [...promoBanners]; up[idx].color2 = e.target.value; setPromoBanners(up); }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px dashed var(--gray2)', paddingTop: '1rem' }}>
                          <span style={{ fontSize: '.7rem', color: 'var(--gray4)', fontWeight: 600, display: 'block', marginBottom: '.5rem', textTransform: 'uppercase' }}>Live Preview:</span>
                          <div className="banner-card" style={{ background: `linear-gradient(135deg, ${banner.color1}, ${banner.color2})`, margin: 0, height: '140px', color: '#fff' }}>
                            <div className="bc-label">{banner.label}</div>
                            <div className="bc-title" dangerouslySetInnerHTML={{ __html: banner.title }} />
                            <div className="bc-btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '.7rem', padding: '.3rem .8rem' }}>{banner.btnText}</div>
                            <div className="bc-emoji" style={{ fontSize: '4rem' }}>{banner.emoji}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {promoBanners.length === 0 && (
                      <p style={{ fontSize: '.78rem', color: 'var(--gray4)', fontWeight: 600, textAlign: 'center', padding: '1rem' }}>No promotional banners added.</p>
                    )}
                  </div>
                </div>

                {/* 2. HERO COPY EDIT CARD */}
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                  <div className="admin-card-head" style={{ padding: '0 0 1rem 0', borderBottom: '1.5px solid var(--gray2)' }}>
                    <div>
                      <div className="ach-title" style={{ fontSize: '1rem' }}>🥭 Hero Banner Copywriter</div>
                      <div className="ach-sub">Modify top badge rows, major headers, descriptions, and trust counts.</div>
                    </div>
                  </div>
                  
                  <div className="settings-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Badge row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.75rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Badge 1 (Orange)</label>
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroBadge1} onChange={e => setHeroBadge1(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Badge 2 (Green)</label>
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroBadge2} onChange={e => setHeroBadge2(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Badge 3 (Gold)</label>
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroBadge3} onChange={e => setHeroBadge3(e.target.value)} />
                      </div>
                    </div>

                    {/* Headline lines */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Hero Headline (Use &lt;em&gt;text&lt;/em&gt; for elegant emphasis styling)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                        <input type="text" className="form-input !rounded-[12px] font-bold" placeholder="Line 1" value={heroTitleLine1} onChange={e => setHeroTitleLine1(e.target.value)} />
                        <input type="text" className="form-input !rounded-[12px] font-bold" placeholder="Line 2" value={heroTitleLine2} onChange={e => setHeroTitleLine2(e.target.value)} />
                        <input type="text" className="form-input !rounded-[12px] font-bold" placeholder="Line 3" value={heroTitleLine3} onChange={e => setHeroTitleLine3(e.target.value)} />
                      </div>
                    </div>

                    {/* Hero Subtitle */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Hero Subheading Text</label>
                      <textarea rows={3} className="form-input !rounded-[12px] font-semibold" value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} style={{ resize: 'vertical' }} />
                    </div>

                    {/* Trust row */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Hero Trust Indicators (Supports &lt;strong&gt;text&lt;/strong&gt;)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroTrust1} onChange={e => setHeroTrust1(e.target.value)} />
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroTrust2} onChange={e => setHeroTrust2(e.target.value)} />
                        <input type="text" className="form-input !rounded-[12px] font-bold" value={heroTrust3} onChange={e => setHeroTrust3(e.target.value)} />
                      </div>
                    </div>

                  </div>
                </div>

                {/* 3. PROMISE CARDS EDIT CARD */}
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                  <div className="admin-card-head" style={{ padding: '0 0 1rem 0', borderBottom: '1.5px solid var(--gray2)' }}>
                    <div>
                      <div className="ach-title" style={{ fontSize: '1rem' }}>🏅 Brand Promise Features</div>
                      <div className="ach-sub">Modify key brand trust cards displayed above footer.</div>
                    </div>
                  </div>
                  
                  <div className="settings-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Promise Section Heading</label>
                      <input type="text" className="form-input !rounded-[12px] font-bold" value={promiseTitle} onChange={e => setPromiseTitle(e.target.value)} />
                    </div>

                    {/* Feature Card 1 */}
                    <div style={{ padding: '1rem', background: 'var(--gray1)', borderRadius: '16px', border: '1.5px solid var(--gray2)' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '.6rem' }}>🌱 Promise Card #1</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '.75rem', marginBottom: '.5rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Icon</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold text-center" value={promiseFeature1Icon} onChange={e => setPromiseFeature1Icon(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Title</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold" value={promiseFeature1Title} onChange={e => setPromiseFeature1Title(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Description Text</label>
                        <textarea rows={2} className="form-input !rounded-[12px] font-semibold" value={promiseFeature1Text} onChange={e => setPromiseFeature1Text(e.target.value)} style={{ resize: 'none' }} />
                      </div>
                    </div>

                    {/* Feature Card 2 */}
                    <div style={{ padding: '1rem', background: 'var(--gray1)', borderRadius: '16px', border: '1.5px solid var(--gray2)' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '.6rem' }}>⚡ Promise Card #2</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '.75rem', marginBottom: '.5rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Icon</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold text-center" value={promiseFeature2Icon} onChange={e => setPromiseFeature2Icon(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Title</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold" value={promiseFeature2Title} onChange={e => setPromiseFeature2Title(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Description Text</label>
                        <textarea rows={2} className="form-input !rounded-[12px] font-semibold" value={promiseFeature2Text} onChange={e => setPromiseFeature2Text(e.target.value)} style={{ resize: 'none' }} />
                      </div>
                    </div>

                    {/* Feature Card 3 */}
                    <div style={{ padding: '1rem', background: 'var(--gray1)', borderRadius: '16px', border: '1.5px solid var(--gray2)' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '.6rem' }}>🏅 Promise Card #3</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '.75rem', marginBottom: '.5rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Icon</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold text-center" value={promiseFeature3Icon} onChange={e => setPromiseFeature3Icon(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Title</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold" value={promiseFeature3Title} onChange={e => setPromiseFeature3Title(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Description Text</label>
                        <textarea rows={2} className="form-input !rounded-[12px] font-semibold" value={promiseFeature3Text} onChange={e => setPromiseFeature3Text(e.target.value)} style={{ resize: 'none' }} />
                      </div>
                    </div>

                    {/* Feature Card 4 */}
                    <div style={{ padding: '1rem', background: 'var(--gray1)', borderRadius: '16px', border: '1.5px solid var(--gray2)' }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '.6rem' }}>🔄 Promise Card #4</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '.75rem', marginBottom: '.5rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Icon</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold text-center" value={promiseFeature4Icon} onChange={e => setPromiseFeature4Icon(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Title</label>
                          <input type="text" className="form-input !rounded-[12px] font-bold" value={promiseFeature4Title} onChange={e => setPromiseFeature4Title(e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '.65rem', fontWeight: 800 }}>Card Description Text</label>
                        <textarea rows={2} className="form-input !rounded-[12px] font-semibold" value={promiseFeature4Text} onChange={e => setPromiseFeature4Text(e.target.value)} style={{ resize: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. WEBSITE FOOTER DETAILS CARD */}
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                  <div className="admin-card-head" style={{ padding: '0 0 1rem 0', borderBottom: '1.5px solid var(--gray2)' }}>
                    <div>
                      <div className="ach-title" style={{ fontSize: '1rem' }}>🏡 Website Footer Details</div>
                      <div className="ach-sub">Modify brand description and orchard contact information shown at page bottom.</div>
                    </div>
                  </div>
                  
                  <div className="settings-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Brand Description</label>
                      <textarea 
                        className="form-input !rounded-[12px] font-semibold" 
                        rows={3}
                        value={footerDesc} 
                        onChange={e => setFooterDesc(e.target.value)}
                        required 
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Contact Phone Number</label>
                      <input 
                        type="text" 
                        className="form-input !rounded-[12px] font-bold" 
                        value={contactPhone} 
                        onChange={e => setContactPhone(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Contact Email Address</label>
                      <input 
                        type="email" 
                        className="form-input !rounded-[12px] font-bold" 
                        value={contactEmail} 
                        onChange={e => setContactEmail(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 800, fontSize: '.7rem', color: 'var(--gray4)' }}>Address Location</label>
                      <input 
                        type="text" 
                        className="form-input !rounded-[12px] font-bold" 
                        value={contactAddress} 
                        onChange={e => setContactAddress(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                </div>

                <div style={{ paddingBottom: '3rem' }}>
                  <button 
                    onClick={handleSaveUIConfig} 
                    className="w-full btn-primary shiny-btn !rounded-full shadow-lg shadow-orange-500/20 font-bold uppercase tracking-wider text-xs py-4 animate-pulse"
                  >
                    💾 Publish Custom Homepage Layout Copy
                  </button>
                </div>

              </div>

              {/* RIGHT COLUMN: LIVE BROWSER PREVIEW */}
              <div style={{ flex: '1 1 450px', position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 800, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                  <span>🖥️</span> Interactive Desktop Live Preview
                </div>
                
                {/* Mock Browser Wrapper */}
                <div style={{ 
                  border: '1.5px solid var(--gray2)', 
                  borderRadius: '20px', 
                  background: 'var(--bg-card)', 
                  overflow: 'hidden', 
                  boxShadow: '0 20px 40px -15px var(--shadow-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '750px'
                }}>
                  {/* Browser Address Bar Area */}
                  <div style={{ 
                    background: 'var(--gray1)', 
                    borderBottom: '1.5px solid var(--gray2)', 
                    padding: '.75rem 1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    userSelect: 'none'
                  }}>
                    <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef4444' }} />
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#f59e0b' }} />
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10b981' }} />
                    </div>
                    
                    <div style={{ 
                      background: 'var(--input-bg)', 
                      border: '1.5px solid var(--border-color)', 
                      borderRadius: '10px', 
                      padding: '.3rem .8rem', 
                      fontSize: '.68rem', 
                      fontWeight: 700, 
                      color: 'var(--text-muted)', 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '.4rem',
                      boxShadow: 'inset 0 1px 2px var(--shadow-color)'
                    }}>
                      <span style={{ fontSize: '.8rem' }}>🔒</span>
                      <span style={{ color: 'var(--dark)', opacity: 0.8 }}>https://</span>
                      <span style={{ color: 'var(--dark)' }}>vertexpicks.com</span>
                    </div>
                  </div>
                  
                  {/* Web App Shell Container (Scrollable Website Body) */}
                  <div style={{ 
                    overflowY: 'auto', 
                    flexGrow: 1, 
                    background: 'var(--bg-primary)', 
                    fontFamily: '"Sora", sans-serif',
                    fontSize: '12px'
                  }} className="scrollbar-thin">
                    


                    {/* Micro Navigation */}
                    <div style={{ 
                      padding: '.8rem 1.25rem', 
                      borderBottom: '1px solid var(--border-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)'
                    }}>
                      <div style={{ fontWeight: 900, fontSize: '.8rem', color: 'var(--dark)', fontFamily: '"Fraunces", serif' }}>
                        Vertex<span style={{ color: 'var(--primary)' }}>Picks</span>
                      </div>
                      <div style={{ display: 'flex', gap: '.75rem', fontSize: '.65rem', fontWeight: 700, color: 'var(--gray4)' }}>
                        <span>Shop</span>
                        <span>Our Promise</span>
                        <span>Reviews</span>
                      </div>
                      <div style={{ fontSize: '.8rem' }}>🛒</div>
                    </div>
                    
                    {/* Miniature Scrolling Ticker Bar */}
                    <div style={{ 
                      background: 'var(--primary)', 
                      color: '#ffffff', 
                      padding: '.45rem .5rem', 
                      fontSize: '.58rem', 
                      fontWeight: 700, 
                      overflow: 'hidden', 
                      whiteSpace: 'nowrap',
                      position: 'relative'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        gap: '1rem',
                        animation: 'marqueeSimulate 20s linear infinite'
                      }}>
                        {marqueeItems.length > 0 ? (
                          [...marqueeItems, ...marqueeItems].map((text, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
                              {text} <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>No scrolling items added</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Miniature Hero Section */}
                    <div style={{ 
                      padding: '2rem 1.25rem 1.5rem', 
                      background: 'var(--hero-gradient)', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.8rem',
                      borderBottom: '1.5px solid var(--border-color)'
                    }}>
                      
                      {/* Badge Row */}
                      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                        {heroBadge1 && <span style={{ fontSize: '.55rem', fontWeight: 800, background: 'var(--primary-pale)', color: 'var(--primary)', padding: '.2rem .5rem', borderRadius: '100px' }}>{heroBadge1}</span>}
                        {heroBadge2 && <span style={{ fontSize: '.55rem', fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '.2rem .5rem', borderRadius: '100px' }}>{heroBadge2}</span>}
                        {heroBadge3 && <span style={{ fontSize: '.55rem', fontWeight: 800, background: '#fef3c7', color: '#b45309', padding: '.2rem .5rem', borderRadius: '100px' }}>{heroBadge3}</span>}
                      </div>
                      
                      {/* Hero Title */}
                      <h1 style={{ 
                        fontSize: '1.4rem', 
                        fontWeight: 900, 
                        color: 'var(--dark)', 
                        fontFamily: '"Fraunces", serif',
                        lineHeight: 1.2,
                        margin: 0
                      }}>
                        {heroTitleLine1 && (heroTitleLine1.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTitleLine1) }} /> : heroTitleLine1)}
                        {heroTitleLine2 && <><br />{heroTitleLine2.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTitleLine2) }} /> : heroTitleLine2}</>}
                        {heroTitleLine3 && <><br />{heroTitleLine3.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTitleLine3) }} /> : heroTitleLine3}</>}
                      </h1>
                      
                      {/* Hero Subtitle */}
                      <p style={{ 
                        fontSize: '.68rem', 
                        color: 'var(--gray4)', 
                        lineHeight: 1.5,
                        margin: 0,
                        fontWeight: 500
                      }}>
                        {heroSubtitle}
                      </p>
                      
                      {/* Micro Call to Actions */}
                      <div style={{ display: 'flex', gap: '.6rem', marginTop: '.2rem' }}>
                        <span style={{ fontSize: '.6rem', fontWeight: 800, background: 'var(--primary)', color: '#ffffff', padding: '.45rem .9rem', borderRadius: '100px', boxShadow: '0 4px 10px rgba(232,84,10,0.15)' }}>🛒 Shop Mangoes</span>
                        <span style={{ fontSize: '.6rem', fontWeight: 800, border: '1.5px solid var(--gray2)', color: 'var(--dark)', padding: '.45rem .9rem', borderRadius: '100px', background: 'var(--bg-card)' }}>✦ Our Promise</span>
                      </div>
                      
                      {/* Trust Row */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '.3rem', 
                        marginTop: '.4rem',
                        paddingTop: '.75rem',
                        borderTop: '1px solid var(--gray2)'
                      }}>
                        {heroTrust1 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTrust1) }} />}
                        {heroTrust2 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTrust2) }} />}
                        {heroTrust3 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: sanitizeHTML(heroTrust3) }} />}
                      </div>
                    </div>
                    
                    {/* Miniature Category Pills */}
                    <div style={{ 
                      padding: '.75rem 1.25rem', 
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      gap: '.4rem',
                      overflowX: 'auto',
                      borderBottom: '1px solid var(--gray2)'
                    }} className="scrollbar-none">
                      <span style={{ flexShrink: 0, fontSize: '.58rem', fontWeight: 800, background: 'var(--primary)', color: '#fff', padding: '.3rem .6rem', borderRadius: '100px' }}>All Varieties</span>
                      <span style={{ flexShrink: 0, fontSize: '.58rem', fontWeight: 700, background: 'var(--gray1)', color: 'var(--gray4)', padding: '.3rem .6rem', borderRadius: '100px', border: '1px solid var(--gray2)' }}>Himsagar</span>
                      <span style={{ flexShrink: 0, fontSize: '.58rem', fontWeight: 700, background: 'var(--gray1)', color: 'var(--gray4)', padding: '.3rem .6rem', borderRadius: '100px', border: '1px solid var(--gray2)' }}>Langra</span>
                      <span style={{ flexShrink: 0, fontSize: '.58rem', fontWeight: 700, background: 'var(--gray1)', color: 'var(--gray4)', padding: '.3rem .6rem', borderRadius: '100px', border: '1px solid var(--gray2)' }}>Fazli</span>
                    </div>

                    {/* Miniature Promise Section */}
                    <div style={{ 
                      padding: '1.5rem 1.25rem 2rem', 
                      background: 'var(--gray1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ 
                        fontSize: '.85rem', 
                        fontWeight: 900, 
                        color: 'var(--dark)', 
                        fontFamily: '"Fraunces", serif',
                        textAlign: 'center'
                      }}>
                        {promiseTitle && (promiseTitle.includes('<span>') ? <span dangerouslySetInnerHTML={{ __html: promiseTitle }} /> : promiseTitle)}
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)', 
                        gap: '.75rem' 
                      }}>
                        {/* Promise Card 1 */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature1Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature1Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature1Text}</span>
                        </div>
                        {/* Promise Card 2 */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature2Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature2Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature2Text}</span>
                        </div>
                        {/* Promise Card 3 */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature3Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature3Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature3Text}</span>
                        </div>
                        {/* Promise Card 4 */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature4Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature4Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature4Text}</span>
                        </div>
                      </div>
                    </div>

                    {/* Miniature Footer Section */}
                    <div style={{ 
                      padding: '1.5rem 1.25rem', 
                      background: '#1E1E1E', 
                      color: 'rgba(255,255,255,0.6)', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.8rem',
                      fontSize: '.58rem'
                    }}>
                      <div style={{ fontWeight: 900, fontSize: '.75rem', color: '#ffffff', fontFamily: '"Fraunces", serif' }}>
                        Vertex<span style={{ color: 'var(--primary)' }}>Picks</span>
                      </div>
                      <div style={{ lineHeight: 1.4, fontWeight: 500 }}>
                        {footerDesc}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '.6rem' }}>
                        <div>📞 {contactPhone}</div>
                        <div>📧 {contactEmail}</div>
                        <div>📍 {contactAddress}</div>
                      </div>
                      <div style={{ fontSize: '.5rem', opacity: 0.5, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>© 2026 Vertex Picks.</span>
                        <span>Made in Rajshahi 🥭</span>
                      </div>
                    </div>
                    
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}



      </main>
        {/* CRM Customer Modal */}
        {selectedCustomerDetails && (
          <div className="modal-overlay" onClick={() => setSelectedCustomerDetails(null)}>
            <div className="modal-content !max-w-xl" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>👤 Customer Profile</h2>
                <button className="modal-close" onClick={() => setSelectedCustomerDetails(null)}>×</button>
              </div>
              <div className="modal-body p-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--gray2)]">
                  <div className="w-16 h-16 rounded-full bg-[var(--primary-pale)] text-[var(--primary)] flex items-center justify-center text-2xl font-black shrink-0">
                    {selectedCustomerDetails.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--dark)] m-0">{selectedCustomerDetails.name || 'Connoisseur'}</h3>
                    <p className="text-sm font-semibold text-[var(--gray4)] m-0">{selectedCustomerDetails.email}</p>
                    <p className="text-sm font-semibold text-[var(--blue)] m-0">{selectedCustomerDetails.phone || 'No phone recorded'}</p>
                  </div>
                  {selectedCustomerDetails.isBlocked && (
                    <div className="ml-auto bg-red-100 text-red-600 px-3 py-1 rounded font-bold text-xs uppercase tracking-wider">
                      Blocked
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[var(--gray1)] p-4 rounded-brand border border-[var(--gray2)] text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1">Lifetime Value</div>
                    <div className="text-2xl font-black text-[var(--primary)]">৳{selectedCustomerDetails.uTotal?.toLocaleString()}</div>
                  </div>
                  <div className="bg-[var(--gray1)] p-4 rounded-brand border border-[var(--gray2)] text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1">Total Orders</div>
                    <div className="text-2xl font-black text-[var(--dark)]">{selectedCustomerDetails.uOrders?.length || 0}</div>
                  </div>
                </div>

                <div className="font-black text-xs uppercase tracking-widest text-[var(--gray4)] mb-3">Order History</div>
                {selectedCustomerDetails.uOrders?.length > 0 ? (
                  <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {selectedCustomerDetails.uOrders.map(o => (
                      <div key={o.id} className="p-3 border border-[var(--gray2)] rounded-md flex justify-between items-center text-sm">
                        <div>
                          <span className="font-bold text-[var(--dark)]">#{o.id.slice(-6).toUpperCase()}</span>
                          <span className="ml-2 text-xs font-medium text-[var(--gray4)]">{new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="font-bold">৳{o.total}</div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${o.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {o.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[var(--gray4)] font-semibold text-sm">No orders placed yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Product Sales Modal */}
        {expandProductSales && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setExpandProductSales(false)}>
            <div className="max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in scale-in duration-300" style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 60px var(--shadow-color)' }} onClick={e => e.stopPropagation()}>
              <div style={{ background: '#121212', padding: '1rem 1.4rem', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#FFFFFF', fontSize: '1.1rem', margin: 0 }}>
                  🥭 Detailed Sales by Product
                </h3>
                <button onClick={() => setExpandProductSales(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="p-3 border-b border-gray-200">Product Name</th>
                        <th className="p-3 border-b border-gray-200">Total Revenue</th>
                        <th className="p-3 border-b border-gray-200">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsRevenueByProduct.map((p, idx) => {
                        const totalProductRevenue = analyticsRevenueByProduct.reduce((sum, v) => sum + v.revenue, 0);
                        const percentage = totalProductRevenue > 0 ? (p.revenue / totalProductRevenue) * 100 : 0;
                        return (
                          <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="p-3"><strong className="text-gray-800">{p.name}</strong></td>
                            <td className="p-3 font-black text-primary">৳{p.revenue.toLocaleString()}</td>
                            <td className="p-3 font-bold text-gray-500">{percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
