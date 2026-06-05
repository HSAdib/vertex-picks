import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CategoriesTab from '../components/admin/CategoriesTab';

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

  // Firestore Data Collections
  const [mangoes, setMangoes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [promos, setPromos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);

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
    } catch (err) {
      toast.error('Failed to update orders.');
    }
    setBatchUpdating(false);
  };

  const getCustomWhatsAppLink = (order) => {
    const phone = order.deliveryPhone || order.customerPhone || '';
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;
    else if (!cleanPhone.startsWith('88') && cleanPhone.length === 10) cleanPhone = '880' + cleanPhone;
    const itemsList = (order.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ');
    const orderIdShort = order.id.slice(-6).toUpperCase();
    const customerName = order.deliveryName || order.customerName || 'Valued Customer';
    const message = `Dear ${customerName},

This is a formal update from Vertex Picks regarding your recent order (#${orderIdShort}).

Order Summary:
- Items: ${itemsList}
- Total Amount: ৳${order.total || 0}
- Delivery Address: ${order.deliveryAddress || 'N/A'}
- Current Status: ${order.status || 'Pending'}

If you require any modifications to your delivery details or have further inquiries, please reply to this message.

Thank you for choosing Vertex Picks.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const [leadsSearch, setLeadsSearch] = useState('');
  const [storeConfig, setStoreConfig] = useState({ baseDeliveryFee: 110, perKgFee: 21 });
  const [storeName, setStoreName] = useState('Vertex Picks');
  const [contactEmail, setContactEmail] = useState('hello@vertexpicks.com');
  const [footerDesc, setFooterDesc] = useState('Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.');
  const [contactPhone, setContactPhone] = useState('+880 1581-221084');
  const [contactAddress, setContactAddress] = useState('Rajshahi, Bangladesh');
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(1500);
  const [dashboardView, setDashboardView] = useState('overview');

  // Homepage Customizer states
  const [marqueeItems, setMarqueeItems] = useState([
    '🚚 Free delivery on ৳1,500+',
    '🌿 100% tree-bagged & chemical-free',
    '⚡ Same-day dispatch before 12pm',
    '🎁 Eid gift boxes available',
    '🔄 Full refund if not satisfied',
    '⭐ 4.9/5 rating from 500+ customers'
  ]);
  const [newMarqueeText, setNewMarqueeText] = useState('');

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


  // Dynamic Delivery Zones States
  const [deliveryZones, setDeliveryZones] = useState([
    { zone: 'Dhaka Metro', areas: 'Mirpur, Gulshan, Banani, Uttara, Dhanmondi', fee: 60, time: 'Same Day' },
    { zone: 'Dhaka Suburbs', areas: 'Savar, Gazipur, Narayanganj', fee: 100, time: 'Next Day' },
    { zone: 'Chattogram', areas: 'Chittagong City, Halishahar, Agrabad', fee: 120, time: '1–2 Days' },
    { zone: 'Sylhet', areas: 'Sylhet City, Sunamganj', fee: 150, time: '1–2 Days' },
    { zone: 'Rajshahi Local', areas: 'Rajshahi City — Free Pickup', fee: 0, time: 'Same Day' }
  ]);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneAreas, setZoneAreas] = useState('');
  const [zoneFee, setZoneFee] = useState(60);
  const [zoneTime, setZoneTime] = useState('Same Day');
  const [editZoneIndex, setEditZoneIndex] = useState(null);

  // --- CRUD SEARCH / FILTER STATES ---
  const [productSearch, setProductSearch] = useState('');
  const [productSectionFilter, setProductSectionFilter] = useState('All Varieties');
  const [productStockFilter, setProductStockFilter] = useState('All Status');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All Status');
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 10;

  // Reviews soft-delete (trash + undo)
  const [trashedReviews, setTrashedReviews] = useState({}); // { reviewId: { review, timer } }
  const undoTimersRef = { current: {} };

  // Inline stock editing
  const [editingStock, setEditingStock] = useState(null); // { productId, value }

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);

  // Analytics Live States
  const [analyticsOrdersByCity, setAnalyticsOrdersByCity] = useState([]);
  const [analyticsRevenueByVariety, setAnalyticsRevenueByVariety] = useState([]);
  const [analyticsMonthlyRevenue, setAnalyticsMonthlyRevenue] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (!orders || orders.length === 0) {
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    const cityMap = {};
    const varietyMap = {};
    const monthMap = {};
    
    orders.filter(o => o.status !== 'Cancelled').forEach(o => {
      const city = o.deliveryAddress?.city || 'Dhaka';
      cityMap[city] = (cityMap[city] || 0) + 1;
      
      (o.items || []).forEach(item => {
        const variety = item.variety || item.section || 'Unknown';
        const itemRevenue = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        varietyMap[variety] = (varietyMap[variety] || 0) + itemRevenue;
      });
      
      if (o.createdAt) {
        const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt);
        const month = d.toLocaleString('en-US', { month: 'short' });
        monthMap[month] = (monthMap[month] || 0) + (Number(o.total) || 0);
      }
    });

    const totalValidOrders = Object.values(cityMap).reduce((a, b) => a + b, 0) || 1;
    setAnalyticsOrdersByCity(Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, val: count, fill: `${((count / totalValidOrders) * 100).toFixed(0)}%` }))
    );

    const sortedVars = Object.entries(varietyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVar = sortedVars.length > 0 ? sortedVars[0][1] : 1;
    setAnalyticsRevenueByVariety(sortedVars.map(([name, revenue]) => ({ name, revenue, fill: `${((revenue / maxVar) * 100).toFixed(0)}%` })));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedMonths = Object.entries(monthMap).sort((a, b) => monthNames.indexOf(a[0]) - monthNames.indexOf(b[0]));
    setAnalyticsMonthlyRevenue(sortedMonths.map(([name, revenue]) => ({ name, revenue })));

    setAnalyticsLoading(false);
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
  const [prodSection, setProdSection] = useState('Himsagar');
  const [prodSku, setProdSku] = useState('');
  const [prodMinThreshold, setProdMinThreshold] = useState(10);
  const [prodSeason, setProdSeason] = useState('Peak');
  const [prodGrade, setProdGrade] = useState('Premium');
  const [prodImages, setProdImages] = useState(['']);
  const [prodDescription, setProdDescription] = useState('');
  const [prodFeatured, setProdFeatured] = useState(false);
  const [prodFixedWeight, setProdFixedWeight] = useState(1);
  const [prodBadge, setProdBadge] = useState('');
  const [prodPacks, setProdPacks] = useState([{ name: '1 Box', price: '' }]);
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

  // 2. Add Coupon Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState('percent');
  const [coupValue, setCoupValue] = useState(10);
  const [coupMinOrder, setCoupMinOrder] = useState(500);
  const [coupLimit, setCoupLimit] = useState(100);
  const [coupExpires, setCoupExpires] = useState('');

  // 3. View Order Details Modal
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 4. Update Order Status Modal
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState(null);
  const [newStatus, setNewStatus] = useState('Pending');
  const [newTrackingId, setNewTrackingId] = useState('');

  // Fetch Master Dataset
  const fetchData = async () => {
    try {
      // 1. Fetch mangoes
      const mangoesSnap = await getDocs(collection(db, 'mangoes'));
      const productsList = [];
      mangoesSnap.docs.forEach(d => {
        if (d.id !== 'STORE_SECTIONS' && d.id !== 'STORE_SETTINGS' && d.id !== 'NAVBAR_TABS') {
          productsList.push({ id: d.id, ...d.data() });
        }
      });
      productsList.sort((a, b) => (a.order || 0) - (b.order || 0));
      setMangoes(productsList);

      // 2. Fetch orders
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const ordersList = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordersList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
      setOrders(ordersList);

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

      // 5. Fetch settings
      const configSnap = await getDoc(doc(db, 'mangoes', 'STORE_SETTINGS'));
      if (configSnap.exists()) {
        const cData = configSnap.data();
        setStoreConfig({
          baseDeliveryFee: cData.baseDeliveryFee ?? 110,
          perKgFee: cData.perKgFee ?? 21
        });
        setStoreName(cData.storeName || 'Vertex Picks');
        setContactEmail(cData.contactEmail || 'hello@vertexpicks.com');
        setFooterDesc(cData.footerDesc || 'Hand-picked, tree-bagged, and delivered flawlessly. Premium Rajshahi mangoes, direct from farm to your door.');
        setContactPhone(cData.contactPhone || '+880 1581-221084');
        setContactAddress(cData.contactAddress || 'Rajshahi, Bangladesh');
        setFreeDeliveryMin(cData.freeDeliveryMin ?? 1500);
        if (cData.deliveryZones && Array.isArray(cData.deliveryZones)) {
          setDeliveryZones(cData.deliveryZones);
        }

        // Fetch customizer text settings if they exist
        if (cData.marqueeItems && Array.isArray(cData.marqueeItems)) setMarqueeItems(cData.marqueeItems);
        if (cData.heroBadge1) setHeroBadge1(cData.heroBadge1);
        if (cData.heroBadge2) setHeroBadge2(cData.heroBadge2);
        if (cData.heroBadge3) setHeroBadge3(cData.heroBadge3);
        if (cData.heroTitleLine1) setHeroTitleLine1(cData.heroTitleLine1);
        if (cData.heroTitleLine2) setHeroTitleLine2(cData.heroTitleLine2);
        if (cData.heroTitleLine3) setHeroTitleLine3(cData.heroTitleLine3);
        if (cData.heroSubtitle) setHeroSubtitle(cData.heroSubtitle);
        if (cData.heroTrust1) setHeroTrust1(cData.heroTrust1);
        if (cData.heroTrust2) setHeroTrust2(cData.heroTrust2);
        if (cData.heroTrust3) setHeroTrust3(cData.heroTrust3);
        if (cData.promiseTitle) setPromiseTitle(cData.promiseTitle);
        if (cData.promiseFeature1Title) setPromiseFeature1Title(cData.promiseFeature1Title);
        if (cData.promiseFeature1Text) setPromiseFeature1Text(cData.promiseFeature1Text);
        if (cData.promiseFeature1Icon) setPromiseFeature1Icon(cData.promiseFeature1Icon);
        if (cData.promiseFeature2Title) setPromiseFeature2Title(cData.promiseFeature2Title);
        if (cData.promiseFeature2Text) setPromiseFeature2Text(cData.promiseFeature2Text);
        if (cData.promiseFeature2Icon) setPromiseFeature2Icon(cData.promiseFeature2Icon);
        if (cData.promiseFeature3Title) setPromiseFeature3Title(cData.promiseFeature3Title);
        if (cData.promiseFeature3Text) setPromiseFeature3Text(cData.promiseFeature3Text);
        if (cData.promiseFeature3Icon) setPromiseFeature3Icon(cData.promiseFeature3Icon);
        if (cData.promiseFeature4Title) setPromiseFeature4Title(cData.promiseFeature4Title);
        if (cData.promiseFeature4Text) setPromiseFeature4Text(cData.promiseFeature4Text);
        if (cData.promiseFeature4Icon) setPromiseFeature4Icon(cData.promiseFeature4Icon);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load admin dataset:', err);
      setLoading(false);
    }
  };

  // Initial data load on mount
  useEffect(() => { fetchData(); }, []);

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
      const cleanPacks = prodPacks.filter(p => p.name?.trim() !== '' && p.price !== '');
      const pData = {
        name: prodName,
        price: Number(prodPrice),
        discountPrice: prodDiscountPrice === '' ? null : Number(prodDiscountPrice),
        stock: Number(prodStock),
        section: prodSection,
        variety: prodSection,
        sku: prodSku || `VP-${prodSection.slice(0,3).toUpperCase()}-${pId.slice(-3).toUpperCase()}`,
        minThreshold: Number(prodMinThreshold),
        season: prodSeason,
        grade: prodGrade,
        images: finalImages,
        image: finalImages[0] || '',
        description: prodDescription || 'Fresh premium bagged mango from Rajshahi orchards.',
        featured: prodFeatured,
        fixedWeight: Number(prodFixedWeight) || 1,
        order: editProductId ? (mangoes.find(m => m.id === editProductId)?.order ?? mangoes.length + 1) : mangoes.length + 1,
        badge: prodBadge ? prodBadge.trim() : '',
        packs: cleanPacks.map(p => ({ name: p.name.trim(), price: Number(p.price) })),
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
    setProdSection(p.section || 'Himsagar');
    setProdSku(p.sku || '');
    setProdMinThreshold(p.minThreshold || 10);
    setProdSeason(p.season || 'Peak');
    setProdGrade(p.grade || 'Premium');
    const loadedImages = Array.isArray(p.images) && p.images.length > 0
      ? p.images
      : (p.image ? [p.image] : ['']);
    setProdImages(loadedImages);
    setProdDescription(p.description || '');
    setProdFeatured(p.featured || false);
    setProdFixedWeight(p.fixedWeight || 1);
    
    setProdBadge(p.badge || '');
    setProdPacks(p.packs?.length ? p.packs : [{ name: '1 Box', price: '' }]);
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
    setProdSection('Himsagar');
    setProdSku('');
    setProdMinThreshold(10);
    setProdSeason('Peak');
    setProdGrade('Premium');
    setProdImages(['']);
    setProdDescription('');
    setProdFeatured(false);
    setProdFixedWeight(1);
    
    setProdBadge('');
    setProdPacks([{ name: '1 Box', price: '' }]);
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

  // Coupon Creation
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const cData = {
        code: coupCode.toUpperCase(),
        type: coupType,
        value: Number(coupValue),
        minOrder: Number(coupMinOrder),
        limit: Number(coupLimit),
        usedCount: 0,
        expires: coupExpires || '2026-12-31',
        createdAt: new Date()
      };
      
      await setDoc(doc(db, 'promos', coupCode.toUpperCase()), cData);
      toast.success(`Coupon ${coupCode.toUpperCase()} active!`);
      setShowCouponModal(false);
      setCoupCode('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create coupon.');
    }
  };

  const handleDeleteCoupon = async (cId) => {
    if (window.confirm(`Delete coupon code ${cId}?`)) {
      try {
        await deleteDoc(doc(db, 'promos', cId));
        toast.success(`Coupon ${cId} deleted.`);
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

  // Order Status Update
  const handleUpdateOrderStatus = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'orders', orderToUpdate.id), {
        status: newStatus,
        trackingId: newTrackingId
      });
      toast.success(`Order status set to: ${newStatus}`);
      setShowOrderStatusModal(false);
      setOrderToUpdate(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  const openStatusUpdate = (order) => {
    setOrderToUpdate(order);
    setNewStatus(order.status || 'Pending');
    setNewTrackingId(order.trackingId || '');
    setShowOrderStatusModal(true);
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
        freeDeliveryMin: Number(freeDeliveryMin)
      }, { merge: true });
      toast.success('General store configurations updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save general store configurations.');
    }
  };

  // Save footer details standalone
  const handleSaveFooterDetails = async (e) => {
    if (e) e.preventDefault();
    try {
      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
        footerDesc,
        contactPhone,
        contactAddress,
        contactEmail
      }, { merge: true });
      toast.success('🏡 Homepage footer details updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save footer details.');
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

  // Review soft-delete with 5s undo
  const handleDeleteReview = (productId, reviewId, reviewObj) => {
    // Mark as trashed instantly in UI
    setTrashedReviews(prev => ({ ...prev, [reviewId]: { productId, review: reviewObj } }));

    // Show undo toast
    const toastId = toast(
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
          const updated = (prodSnap.data().reviews || []).filter(r => r.id !== reviewId);
          await updateDoc(prodRef, { reviews: updated });
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

  // Dynamic Delivery Zone Actions
  const handleSaveZone = async (e) => {
    e.preventDefault();
    try {
      let updated;
      const zoneData = {
        zone: zoneName,
        areas: zoneAreas,
        fee: Number(zoneFee),
        time: zoneTime
      };

      if (editZoneIndex !== null) {
        updated = [...deliveryZones];
        updated[editZoneIndex] = zoneData;
      } else {
        updated = [...deliveryZones, zoneData];
      }

      await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
        deliveryZones: updated
      }, { merge: true });

      setDeliveryZones(updated);
      setShowZoneModal(false);
      clearZoneForm();
      toast.success(editZoneIndex !== null ? 'Delivery zone updated!' : 'New delivery zone registered!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save delivery zone.');
    }
  };

  const handleDeleteZone = async (idx) => {
    if (window.confirm("Remove this delivery zone?")) {
      try {
        const updated = deliveryZones.filter((_, i) => i !== idx);
        await setDoc(doc(db, 'mangoes', 'STORE_SETTINGS'), {
          deliveryZones: updated
        }, { merge: true });

        setDeliveryZones(updated);
        toast.success('Delivery zone removed!');
      } catch (err) {
        console.error(err);
        toast.error('Failed to remove delivery zone.');
      }
    }
  };

  const openZoneModal = (z = null, idx = null) => {
    if (z) {
      setZoneName(z.zone);
      setZoneAreas(z.areas);
      setZoneFee(z.fee);
      setZoneTime(z.time);
      setEditZoneIndex(idx);
    } else {
      clearZoneForm();
      setEditZoneIndex(null);
    }
    setShowZoneModal(true);
  };

  const clearZoneForm = () => {
    setZoneName('');
    setZoneAreas('');
    setZoneFee(60);
    setZoneTime('Same Day');
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

  // Variety sales count leaderboard
  const varietySales = {};
  activeOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const variety = item.variety || item.section || 'Himsagar';
      varietySales[variety] = (varietySales[variety] || 0) + (item.quantity || 1);
    });
  });
  const topVarieties = Object.entries(varietySales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sales]) => ({ name, sales }));
  const maxSalesVal = topVarieties.length > 0 ? topVarieties[0].sales : 1;

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

  // Orders Filter
  const filteredOrders = orders.filter(o => {
    if (orderSearch.trim() !== '') {
      const q = orderSearch.toLowerCase();
      const idMatch = o.id.toLowerCase().includes(q);
      const nameMatch = o.deliveryName?.toLowerCase().includes(q) || o.customerEmail?.toLowerCase().includes(q);
      if (!idMatch && !nameMatch) return false;
    }
    if (orderStatusFilter !== 'All Status') {
      if (o.status !== orderStatusFilter) return false;
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
    if (prod.reviews && Array.isArray(prod.reviews)) {
      prod.reviews.forEach(rev => {
        allProductReviews.push({
          ...rev,
          productId: prod.id,
          productName: prod.name
        });
      });
    }
  });

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
        <div className="fixed inset-0 bg-slate-900/75 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-modal max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col animate-in scale-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-6 text-white flex justify-between items-center shrink-0 shadow-md">
              <div className="flex-1">
                <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">{editProductId ? '✏️ Edit Product Parameters' : '✨ Create New Catalog Item'}</h3>
                <div className="modal-tabs mt-3" style={{ background: 'rgba(255,255,255,0.2)', maxWidth: 'max-content' }}>
                  <button 
                    type="button"
                    onClick={() => setActiveProdFormTab('basic')}
                    className={`modal-tab${activeProdFormTab === 'basic' ? ' active' : ''}`}
                    style={activeProdFormTab !== 'basic' ? { color: 'rgba(255,255,255,0.8)' } : {}}
                  >
                    1. Basic Details
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveProdFormTab('rich')}
                    className={`modal-tab${activeProdFormTab === 'rich' ? ' active' : ''}`}
                    style={activeProdFormTab !== 'rich' ? { color: 'rgba(255,255,255,0.8)' } : {}}
                  >
                    2. Rich Display Details
                  </button>
                </div>
              </div>
              <button 
                onClick={() => { setShowProductModal(false); setEditProductId(null); clearProductForm(); }} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSaveProduct} className="flex flex-col flex-grow overflow-hidden">
              <div className="p-6 sm:p-8 space-y-4 overflow-y-auto flex-grow scrollbar-thin">
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
                  <div>
                    <label className="form-label">Variety / Section</label>
                    <select 
                      value={prodSection} 
                      onChange={e => setProdSection(e.target.value)} 
                      className="form-input font-bold text-xs cursor-pointer"
                    >
                      <option>Himsagar</option>
                      <option>Langra</option>
                      <option>Fazli</option>
                      <option>Gopalbhog</option>
                      <option>Amrapali</option>
                      <option>Gift Box</option>
                    </select>
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
                  <div>
                    <label className="form-label">Harvest Season</label>
                    <select 
                      value={prodSeason} 
                      onChange={e => setProdSeason(e.target.value)} 
                      className="form-input font-bold text-xs cursor-pointer"
                    >
                      <option>Early</option>
                      <option>Peak</option>
                      <option>Late</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Orchard Grade</label>
                    <input 
                      type="text" 
                      value={prodGrade} 
                      onChange={e => setProdGrade(e.target.value)} 
                      className="form-input font-bold text-xs" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label mb-2">Product Images (URLs)</label>
                    <div className="p-3 space-y-2" style={{ background: 'var(--gray1)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray2)' }}>
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
                        className="btn-secondary text-xs mt-1"
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
                      className="form-input font-medium text-xs h-20 resize-none !rounded-2xl"
                    />
                  </div>
                  <div>
                    <label className="form-label">Box Weight (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={prodFixedWeight}
                      onChange={e => setProdFixedWeight(e.target.value)}
                      className="form-input font-bold text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-3" style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div
                        onClick={() => setProdFeatured(v => !v)}
                        style={{
                          width: 44, height: 24, borderRadius: 100, cursor: 'pointer',
                          background: prodFeatured ? 'var(--primary)' : 'var(--gray2)',
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
                        <div className="form-label">⭐ Featured on Home</div>
                        <div className="text-xs" style={{ color: 'var(--gray4)' }}>Shows in the Featured Mangoes section</div>
                      </div>
                    </label>
                  </div>
                </div>
                </div>

                {/* TAB 2: RICH DISPLAY DETAILS */}
                <div style={{ display: activeProdFormTab === 'rich' ? 'block' : 'none' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                      <div className="admin-card p-4" style={{ borderColor: 'rgba(232,84,10,0.2)' }}
                      >
                        <h4 className="text-xs font-black uppercase text-dark mb-3">🏷️ Pricing & Badges</h4>
                        <div className="form-group">
                          <label className="form-label">Overlay Badge</label>
                          <input type="text" placeholder="e.g. Best Seller, Rare, Gift" value={prodBadge} onChange={e => setProdBadge(e.target.value)} className="form-input" />
                        </div>
                        <div>
                          <label className="form-label mb-2">Pack Options (Name & Price)</label>
                          {prodPacks.map((pack, idx) => {
                            const isBasePack = idx === 0;
                            return (
                              <div key={idx} className="mb-3">
                                {isBasePack && (
                                  <p className="text-xs mb-1" style={{ color: 'var(--gray4)' }}>
                                    🔒 Base pack — prices auto-synced from Tab 1
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  {/* Name */}
                                  <input
                                    type="text"
                                    placeholder="Pack Name (e.g. 1 Box)"
                                    value={pack.name}
                                    onChange={e => {
                                      const newP = [...prodPacks];
                                      newP[idx].name = e.target.value;
                                      setProdPacks(newP);
                                    }}
                                    className="form-input w-2/5"
                                  />
                                  {/* Standard Price */}
                                  <input
                                    type="number"
                                    placeholder="Price (৳)"
                                    value={isBasePack ? prodPrice : pack.price}
                                    readOnly={isBasePack}
                                    onChange={isBasePack ? undefined : e => {
                                      const newP = [...prodPacks];
                                      newP[idx].price = e.target.value;
                                      setProdPacks(newP);
                                    }}
                                    className="form-input w-1/4"
                                    style={isBasePack ? { background: 'var(--gray1)', cursor: 'not-allowed', color: 'var(--gray4)' } : {}}
                                    title={isBasePack ? 'Change this in Tab 1 → Standard Price' : ''}
                                  />
                                  {/* Discount Price */}
                                  <input
                                    type="number"
                                    placeholder="Disc. (৳)"
                                    value={isBasePack ? (prodDiscountPrice || '') : (pack.discountPrice || '')}
                                    readOnly={isBasePack}
                                    onChange={isBasePack ? undefined : e => {
                                      const newP = [...prodPacks];
                                      newP[idx].discountPrice = e.target.value;
                                      setProdPacks(newP);
                                    }}
                                    className="form-input w-1/4"
                                    style={isBasePack ? { background: 'var(--gray1)', cursor: 'not-allowed', color: 'var(--gray4)' } : {}}
                                    title={isBasePack ? 'Change this in Tab 1 → Discount Price' : ''}
                                  />
                                  {/* Remove — only for additional packs */}
                                  {!isBasePack && (
                                    <button type="button" onClick={() => {
                                      setProdPacks(prodPacks.filter((_, i) => i !== idx));
                                    }} className="btn-outline px-3 text-xs" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>✕</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <button type="button" onClick={() => setProdPacks([...prodPacks, {name: '', price: '', discountPrice: ''}])} className="btn-secondary text-xs mt-1">
                            + Add Pack Option
                          </button>
                        </div>
                      </div>

                      <div className="admin-card p-4">
                        <h4 className="ach-title text-xs mb-3">🚚 Delivery & Farmer Info</h4>
                        <div className="space-y-3 mb-5">
                          <div className="form-group">
                            <label className="form-label">Dispatch Rule</label>
                            <input type="text" value={prodDeliveryInfo.dispatch} onChange={e => setProdDeliveryInfo({...prodDeliveryInfo, dispatch: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Metro Fee Text</label>
                            <input type="text" value={prodDeliveryInfo.metro} onChange={e => setProdDeliveryInfo({...prodDeliveryInfo, metro: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Packaging Info</label>
                            <input type="text" value={prodDeliveryInfo.packaging} onChange={e => setProdDeliveryInfo({...prodDeliveryInfo, packaging: e.target.value})} className="form-input" />
                          </div>
                        </div>
                        
                        <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--gray2)' }}>
                          <div className="form-group">
                            <label className="form-label">Farmer Name</label>
                            <input type="text" value={prodFarmer.name} onChange={e => setProdFarmer({...prodFarmer, name: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Farmer Bio / Orchard</label>
                            <input type="text" value={prodFarmer.bio} onChange={e => setProdFarmer({...prodFarmer, bio: e.target.value})} className="form-input" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Farmer Verification Badge</label>
                            <input type="text" value={prodFarmer.badge} onChange={e => setProdFarmer({...prodFarmer, badge: e.target.value})} className="form-input" />
                          </div>
                        </div>
                      </div>

                      <div className="admin-card p-4">
                        <h4 className="ach-title text-xs mb-3">🛡️ Trust Strip (3 Items Fixed)</h4>
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
                      <div className="admin-card p-4">
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

                      <div className="admin-card p-4">
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

                      <div className="admin-card p-4">
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
              <div className="p-6 bg-[var(--gray1)] border-t border-[var(--gray2)] flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => { setShowProductModal(false); setEditProductId(null); clearProductForm(); }} 
                  className="btn-secondary uppercase text-xs font-bold py-3 px-6 rounded-full shadow-sm transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary shiny-btn uppercase text-xs font-bold py-3 px-6 rounded-full shadow-lg shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Save Product details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. COUPON CREATION MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-slate-900/75 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-modal max-w-sm w-full overflow-hidden flex flex-col animate-in scale-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-orange-500 p-6 text-white flex justify-between items-center shrink-0 shadow-md">
              <div>
                <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">🎟️ Create New Coupon</h3>
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
                  <label className="form-label">Coupon Code (Uppercase)</label>
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
              <div className="p-6 bg-[var(--gray1)] border-t border-[var(--gray2)] flex justify-end gap-3">
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
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VIEW ORDER DETAIL MODAL */}
      {showOrderDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/75 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-modal max-w-md w-full overflow-hidden flex flex-col animate-in scale-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-black p-6 text-white flex justify-between items-center shrink-0 shadow-md">
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
            <div className="p-6 bg-[var(--gray1)] border-t border-[var(--gray2)] flex justify-end shrink-0">
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

      {/* 4. UPDATE ORDER STATUS MODAL */}
      {showOrderStatusModal && orderToUpdate && (
        <div className="fixed inset-0 bg-slate-900/75 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-modal max-w-sm w-full overflow-hidden flex flex-col animate-in scale-in duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-500 p-6 text-white flex justify-between items-center shrink-0 shadow-md">
              <div>
                <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">⚙️ Update Booking State</h3>
                <p className="text-[10px] uppercase font-bold tracking-wider text-green-200 mt-1">Logistic Pipeline Transit Control</p>
              </div>
              <button 
                onClick={() => { setShowOrderStatusModal(false); setOrderToUpdate(null); }} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all font-black text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleUpdateOrderStatus} className="flex flex-col">
              <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Status Pipeline Step</label>
                  <select 
                    value={newStatus} 
                    onChange={e => setNewStatus(e.target.value)} 
                    className="form-input font-bold text-xs cursor-pointer"
                  >
                    <option>Pending</option>
                    <option>Confirmed</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                    <option>Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Pathao Tracking ID (Optional)</label>
                  <input 
                    type="text" 
                    value={newTrackingId} 
                    onChange={e => setNewTrackingId(e.target.value)} 
                    placeholder="e.g. 15Y38A9" 
                    className="form-input font-bold text-xs" 
                  />
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="p-6 bg-[var(--gray1)] border-t border-[var(--gray2)] flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowOrderStatusModal(false); setOrderToUpdate(null); }} 
                  className="btn-secondary uppercase text-xs font-bold py-3 px-6 rounded-full shadow-sm transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary shiny-btn uppercase text-xs font-bold py-3 px-6 rounded-full shadow-lg shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Apply Status
                </button>
              </div>
            </form>
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
          <div className="admin-logo-text">Vertex<span>Picks</span></div>
          <div className="admin-role-badge">⚙️ Admin Console</div>
        </div>

        <div className="admin-nav-section">
          <span className="admin-nav-label">Main</span>
          {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'categories', icon: '📁', label: 'Categories' }, { id: 'products', icon: '🥭', label: 'Products' }, { id: 'orders', icon: '📦', label: 'Orders', badge: orders.length }, { id: 'customers', icon: '👥', label: 'Customers' }].map(item => (
            <button key={item.id} className={`admin-nav-item${activeAdminTab === item.id ? ' active' : ''}`} onClick={() => { setActiveAdminTab(item.id); setIsSidebarOpen(false); }}>
              <span className="ani-icon">{item.icon}</span>
              {item.label}
              {item.badge > 0 && <span className="ani-badge">{item.badge}</span>}
            </button>
          ))}
        </div>

        <div className="admin-nav-section">
          <span className="admin-nav-label">Manage</span>
          {[{ id: 'coupons', icon: '🎟️', label: 'Coupons' }, { id: 'reviews', icon: '⭐', label: 'Reviews', badge: allProductReviews.length }, { id: 'leads', icon: '📧', label: 'Leads', badge: leads.length }, { id: 'analytics', icon: '📈', label: 'Analytics' }, { id: 'customizer', icon: '🎨', label: 'UI Customizer' }, { id: 'settings', icon: '⚙️', label: 'Settings' }].map(item => (
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

              {/* Variety Sales donut legend */}
              <div className="admin-card">
                <div className="admin-card-head"><div className="ach-title">🥭 Sales by Variety</div></div>
                <div className="donut-wrap">
                  <svg className="donut-svg" viewBox="0 0 36 36" id="donutChart">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E8540A" strokeWidth="3.8" strokeDasharray="38 62" strokeDashoffset="25" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F5A623" strokeWidth="3.8" strokeDasharray="24 76" strokeDashoffset="-13" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2A9445" strokeWidth="3.8" strokeDasharray="18 82" strokeDashoffset="-37" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7C3AED" strokeWidth="3.8" strokeDasharray="12 88" strokeDashoffset="-55" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563EB" strokeWidth="3.8" strokeDasharray="8 92" strokeDashoffset="-67" />
                    <text x="18" y="19.5" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#1A1A1A" fontFamily="Fraunces,serif">{totalOrdersCount}</text>
                    <text x="18" y="24" textAnchor="middle" fontSize="2.5" fill="#888" fontFamily="Sora,sans-serif">orders</text>
                  </svg>
                  <div className="donut-legend">
                    <div className="dl-row"><div className="dl-dot" style={{ background: '#E8540A' }} /><span className="dl-name">Himsagar</span><span className="dl-val">38%</span></div>
                    <div className="dl-row"><div className="dl-dot" style={{ background: '#F5A623' }} /><span className="dl-name">Langra</span><span className="dl-val">24%</span></div>
                    <div className="dl-row"><div className="dl-dot" style={{ background: '#2A9445' }} /><span className="dl-name">Fazli</span><span className="dl-val">18%</span></div>
                    <div className="dl-row"><div className="dl-dot" style={{ background: '#7C3AED' }} /><span className="dl-name">Gift Boxes</span><span className="dl-val">12%</span></div>
                    <div className="dl-row"><div className="dl-dot" style={{ background: '#2563EB' }} /><span className="dl-name">Others</span><span className="dl-val">8%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders table */}
            <div className="admin-card">
              <div className="admin-card-head">
                <div className="ach-title">🛒 Recent Orders Overview</div>
                <span className="dch-action" onClick={() => setActiveAdminTab('orders')}>View Full List →</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                  <tbody>
                  {orders.slice(0, 5).map(o => {
                    const orderDate = new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    let statusClass = 'status-processing';
                    if (o.status === 'Delivered') statusClass = 'status-delivered';
                    else if (o.status === 'Shipped' || o.status === 'Confirmed') statusClass = 'status-transit';
                    else if (o.status === 'Cancelled') statusClass = 'status-cancelled';

                    return (
                      <tr key={o.id}>
                        <td><span className="order-id">#{o.id.slice(-6).toUpperCase()}</span></td>
                        <td>{o.deliveryName || 'Guest User'}</td>
                        <td className="text-xs max-w-[200px] truncate">{o.items?.map(i => `${i.name} × ${i.quantity}`).join(', ')}</td>
                        <td><strong>৳{o.total}</strong></td>
                        <td>
                          <span className={`order-status ${statusClass}`}>
                            {o.status === 'Cancelled' ? '✕ Cancelled' : 
                             o.status === 'Delivered' ? '✅ Delivered' : 
                             o.status === 'Shipped' ? '🚚 Shipped' : 
                             o.status === 'Confirmed' ? '⚙️ Confirmed' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="text-xs font-semibold text-gray4">{orderDate}</td>
                        <td>
                          <div className="at-actions">
                            <button onClick={() => { setSelectedOrder(o); setShowOrderDetailModal(true); }} className="at-action-btn" title="View details">👁️</button>
                            <button onClick={() => openStatusUpdate(o)} className="at-action-btn" title="Edit status">✏️</button>
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

        {/* TAB 1: ANALYTICS TAB */}
        {activeAdminTab === 'analytics' && (
          <div className="admin-tab active" id="atab-analytics">
            <div className="admin-header"><div className="admin-title">📈 Analytics</div></div>
            <div className="mini-stat-row">
              <div className="mini-stat"><div className="ms-label">Avg. Order Value</div><div className="ms-val">৳{(totalRevenue / (totalOrdersCount || 1)).toFixed(0)}</div></div>
              <div className="mini-stat"><div className="ms-label">Conversion Rate</div><div className="ms-val">3.8%</div></div>
              <div className="mini-stat"><div className="ms-label">Repeat Customers</div><div className="ms-val">64%</div></div>
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
                  <div className="ach-title">🥭 Revenue by Variety</div>
                </div>
                <div className="space-y-4">
                  {analyticsLoading ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">Calculating...</div>
                  ) : analyticsRevenueByVariety.length === 0 ? (
                    <div className="text-center p-4 text-xs font-bold text-gray-400">No data available</div>
                  ) : (
                    analyticsRevenueByVariety.map((v) => (
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

        {/* TAB 2: PRODUCTS CATALOG TAB */}
        {activeAdminTab === 'categories' && (
          <div className="admin-tab active" id="atab-categories">
            <CategoriesTab />
          </div>
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

        {/* TAB 4: COUPONS & OFFERS TAB */}
        {activeAdminTab === 'coupons' && (
          <div className="admin-tab active" id="atab-coupons">
            <div className="admin-header">
              <div className="admin-title">🎟️ Coupons & Offers</div>
              <button className="add-btn" onClick={() => setShowCouponModal(true)}>+ Create Coupon</button>
            </div>
            
            <div className="admin-card">
              <div className="coupon-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Code</th>
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
                              <button onClick={() => handleDeleteCoupon(c.id)} className="at-action-btn danger" title="Delete Coupon">🗑️</button>
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
            <div className="admin-header"><div className="admin-title">🛒 Customer Sales Orders</div></div>

            {/* Status Column Tabs */}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {[
                { label: 'All Orders',  value: 'All Status',  icon: '📋', color: '#6B7280' },
                { label: 'Pending',     value: 'Pending',     icon: '⏳', color: '#D97706' },
                { label: 'Confirmed',   value: 'Confirmed',   icon: '⚙️', color: '#2563EB' },
                { label: 'Shipped',     value: 'Shipped',     icon: '🚚', color: '#7C3AED' },
                { label: 'Delivered',   value: 'Delivered',   icon: '✅', color: '#16A34A' },
                { label: 'Cancelled',   value: 'Cancelled',   icon: '✕',  color: '#DC2626' },
              ].map(tab => {
                const count = tab.value === 'All Status'
                  ? orders.length
                  : orders.filter(o => o.status === tab.value).length;
                const isActive = orderStatusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => { setOrderStatusFilter(tab.value); setOrdersPage(1); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '.5rem',
                      padding: '.55rem 1.1rem', borderRadius: 100,
                      fontSize: '.8rem', fontWeight: 700, cursor: 'pointer',
                      transition: 'all .2s',
                      border: isActive ? `2px solid ${tab.color}` : '2px solid var(--gray2)',
                      background: isActive ? tab.color : '#fff',
                      color: isActive ? '#fff' : 'var(--gray4)',
                      boxShadow: isActive ? `0 4px 12px ${tab.color}33` : 'none',
                    }}
                  >
                    <span style={{ fontSize: '.85rem' }}>{tab.icon}</span>
                    {tab.label}
                    <span style={{
                      fontSize: '.68rem', fontWeight: 800, padding: '.1rem .45rem',
                      borderRadius: 100,
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--gray2)',
                      color: isActive ? '#fff' : 'var(--gray4)',
                      minWidth: 20, textAlign: 'center',
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="admin-card">
              {selectedOrders.size > 0 && (
                <div className="flex flex-wrap items-center justify-between p-4 mb-4 gap-4" style={{background:'var(--primary-pale)',border:'1.5px solid rgba(232,84,10,0.2)',borderRadius:14}}>
                  <div className="flex items-center gap-3">
                    <span style={{fontSize:'.72rem',fontWeight:900,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--primary)'}}>Bulk Actions:</span>
                    <span style={{background:'var(--primary)',color:'#fff',fontSize:'.72rem',fontWeight:900,padding:'.25rem .65rem',borderRadius:100}}>
                      {selectedOrders.size} Selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="order-action-btn"
                    >
                      🖨️ Print Multiple Receipts
                    </button>
                    <button onClick={() => handleBatchStatus('Done')} disabled={batchUpdating} className="order-action-btn">Mark Done</button>
                    <button onClick={() => handleBatchStatus('Shipped')} disabled={batchUpdating} className="order-action-btn">Mark Shipped</button>
                    <button onClick={() => handleBatchStatus('Delivered')} disabled={batchUpdating} className="order-action-btn">Mark Delivered</button>
                    <button onClick={() => handleBatchStatus('Cancelled')} disabled={batchUpdating} className="order-action-btn" style={{background:'var(--red-pale)',color:'var(--red)',borderColor:'rgba(220,38,38,0.2)'}}>Cancel Selected</button>
                  </div>
                </div>
              )}
              <div className="admin-action-bar">
                <div className="aab-left">
                  <div className="aab-search">
                    <span className="aab-search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search by order ID or customer…"
                      value={orderSearch}
                      onChange={e => { setOrderSearch(e.target.value); setOrdersPage(1); }}
                    />
                  </div>
                  <span style={{ fontSize: '.8rem', color: 'var(--gray4)', fontWeight: 600, padding: '.3rem .75rem', background: 'var(--gray1)', borderRadius: 100, border: '1px solid var(--gray2)' }}>
                    {filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="aab-right">
                  <button className="add-btn" onClick={() => {
                    const data = filteredOrders.map(o => {
                      const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : new Date(o.createdAt).toLocaleDateString());
                      const custName = (o.customerName || o.customerEmail || 'Guest');
                      return [o.id, custName, o.total, o.status, date];
                    });
                    exportToCSV('orders_list.csv', data, ['Order ID', 'Customer Name', 'Total Amount', 'Status', 'Date']);
                    toast.success('Orders exported to CSV!');
                  }}>📥 Export</button>
                </div>
              </div>

              <div style={{ overflow: 'visible', overflowX: 'visible' }}>
                {filteredOrders.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📭</div>
                    <p style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--gray4)' }}>
                      No {orderStatusFilter !== 'All Status' ? orderStatusFilter.toLowerCase() : ''} orders found
                    </p>
                  </div>
                ) : (() => {
                  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
                  const pageOrders = filteredOrders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);
                  return (
                    <>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>
                              <input 
                                type="checkbox" 
                                className="at-check" 
                                checked={selectedOrders.size === pageOrders.length && pageOrders.length > 0}
                                onChange={() => {
                                  if (selectedOrders.size === pageOrders.length) setSelectedOrders(new Set());
                                  else setSelectedOrders(new Set(pageOrders.map(o => o.id)));
                                }}
                              />
                            </th>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Items Booked</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageOrders.map(o => {
                            const orderDate = new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                            let statusClass = 'status-processing';
                            if (o.status === 'Delivered') statusClass = 'status-delivered';
                            else if (o.status === 'Shipped' || o.status === 'Confirmed') statusClass = 'status-transit';
                            else if (o.status === 'Cancelled') statusClass = 'status-cancelled';
                            return (
                              <tr key={o.id} className="relative group hover:bg-gray-50 transition-colors">
                                <td>
                                  <input 
                                    type="checkbox" 
                                    className="at-check" 
                                    checked={selectedOrders.has(o.id)}
                                    onChange={() => toggleSelectOrder(o.id)}
                                  />
                                </td>
                                <td><span className="order-id font-mono text-sm font-semibold">#{o.id.slice(-6).toUpperCase()}</span></td>
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--dark)' }}>{o.deliveryName || 'Guest User'}</div>
                                  <div style={{ fontSize: '.75rem', color: 'var(--gray4)' }}>{o.deliveryPhone}</div>
                                </td>
                                <td style={{ fontSize: '.8rem', maxWidth: 200, color: 'var(--gray5)' }}>{o.items?.map(i => `${i.name} × ${i.quantity}`).join(', ')}</td>
                                <td style={{ fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: '.95rem', color: 'var(--primary)' }}>৳{o.total}</td>
                                <td>
                                  <span className={`order-status ${statusClass}`}>
                                    {o.status === 'Cancelled' ? '✕ Cancelled' :
                                     o.status === 'Delivered' ? '✅ Delivered' :
                                     o.status === 'Shipped' ? '🚚 Shipped' :
                                     o.status === 'Confirmed' ? '⚙️ Confirmed' : '⏳ Pending'}
                                  </span>
                                </td>
                                <td className="relative overflow-visible">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => { setSelectedOrder(o); setShowOrderDetailModal(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="View details">👁️</button>
                                    <button onClick={() => openStatusUpdate(o)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" title="Edit Status">✏️</button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdown(activeDropdown === o.id ? null : o.id);
                                      }}
                                      className={`p-1.5 rounded-lg transition-colors ${activeDropdown === o.id ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 text-gray-500'}`}
                                      title="More Actions"
                                    >
                                      ⋮
                                    </button>
                                  </div>

                                  {activeDropdown === o.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-[9998]"
                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                      />
                                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden py-1 text-left">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); window.print(); setActiveDropdown(null); }}
                                          className="w-full text-left px-4 py-2.5 text-[0.85rem] font-medium text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
                                        >
                                          🖨️ Print Receipt
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedOrder(o);
                                            setShowOrderDetailModal(true); // Assuming Address edits can happen via the modal
                                            setActiveDropdown(null);
                                          }}
                                          className="w-full text-left px-4 py-2.5 text-[0.85rem] font-medium text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
                                        >
                                          📍 Edit Address
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openStatusUpdate(o); // Tracking typically added during status updates
                                            setActiveDropdown(null);
                                          }}
                                          className="w-full text-left px-4 py-2.5 text-[0.85rem] font-medium text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
                                        >
                                          📦 Add Tracking
                                        </button>
                                        
                                        {o.deliveryPhone && (
                                          <a
                                            href={getCustomWhatsAppLink(o)}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                            className="w-full text-left px-4 py-2.5 text-[0.85rem] font-medium text-green-600 hover:bg-green-50 transition-colors flex items-center gap-2"
                                          >
                                            💬 WhatsApp Msg
                                          </a>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* PAGINATION */}
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--gray2)', background: 'var(--gray1)' }}>
                          <span style={{ fontSize: '.78rem', color: 'var(--gray4)', fontWeight: 600 }}>
                            Showing {(ordersPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(ordersPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} orders
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                            <button
                              disabled={ordersPage === 1}
                              onClick={() => setOrdersPage(p => p - 1)}
                              style={{ padding: '.4rem .85rem', borderRadius: 100, border: '1.5px solid var(--gray2)', background: '#fff', cursor: ordersPage === 1 ? 'not-allowed' : 'pointer', fontSize: '.8rem', fontWeight: 700, color: ordersPage === 1 ? 'var(--gray3)' : 'var(--dark)', transition: 'all .15s' }}
                            >← Prev</button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === totalPages || Math.abs(p - ordersPage) <= 1)
                              .reduce((acc, p, idx, arr) => {
                                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                                acc.push(p);
                                return acc;
                              }, [])
                              .map((p, i) =>
                                p === '…'
                                  ? <span key={`ellipsis-${i}`} style={{ padding: '0 .25rem', color: 'var(--gray4)', fontSize: '.8rem' }}>…</span>
                                  : <button
                                      key={p}
                                      onClick={() => setOrdersPage(p)}
                                      style={{ width: 32, height: 32, borderRadius: 100, border: '1.5px solid', borderColor: ordersPage === p ? 'var(--primary)' : 'var(--gray2)', background: ordersPage === p ? 'var(--primary)' : '#fff', color: ordersPage === p ? '#fff' : 'var(--dark)', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >{p}</button>
                              )
                            }

                            <button
                              disabled={ordersPage === totalPages}
                              onClick={() => setOrdersPage(p => p + 1)}
                              style={{ padding: '.4rem .85rem', borderRadius: 100, border: '1.5px solid var(--gray2)', background: '#fff', cursor: ordersPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '.8rem', fontWeight: 700, color: ordersPage === totalPages ? 'var(--gray3)' : 'var(--dark)', transition: 'all .15s' }}
                            >Next →</button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
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
                {allProductReviews.filter(r => !trashedReviews[r.id]).length} published
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
                                  <button
                                    onClick={() => handleDeleteReview(rev.productId, rev.id, rev)}
                                    className="at-action-btn danger"
                                    title="Trash review (5s undo)"
                                  >
                                    🗑️
                                  </button>
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
                      const emails = leads.map(l => l.emailOrPhone).join('\n');
                      navigator.clipboard.writeText(emails);
                      toast.success('📋 Copied all subscriber emails/phones to clipboard!');
                    }}
                  >
                    📥 Copy All
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Subscriber Contact</th>
                      <th>Date Subscribed</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = leads.filter(l => 
                        l.emailOrPhone?.toLowerCase().includes(leadsSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', color: 'var(--gray4)', padding: '2.5rem', fontWeight: 600 }}>
                              {leads.length === 0 ? "No newsletter subscribers registered yet." : "No matching subscribers found."}
                            </td>
                          </tr>
                        );
                      }
                      return filtered.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>
                                {l.emailOrPhone?.includes('@') ? '✉️' : '📱'}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--dark)' }}>
                                {l.emailOrPhone}
                              </span>
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
                            <div className="at-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleDeleteLead(l.id)}
                                className="at-action-btn danger"
                                title="Remove subscriber"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
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
                        <span>{item}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            const updated = marqueeItems.filter((_, i) => i !== idx);
                            setMarqueeItems(updated);
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
                    ))}
                    {marqueeItems.length === 0 && (
                      <p style={{ fontSize: '.78rem', color: 'var(--gray4)', fontWeight: 600, textAlign: 'center', padding: '1rem' }}>No scrolling badges listed. Add some above!</p>
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
                  background: '#ffffff', 
                  overflow: 'hidden', 
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.12)',
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
                      background: '#ffffff', 
                      border: '1.5px solid var(--gray2)', 
                      borderRadius: '10px', 
                      padding: '.3rem .8rem', 
                      fontSize: '.68rem', 
                      fontWeight: 700, 
                      color: 'var(--gray4)', 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '.4rem',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
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
                    background: '#ffffff', 
                    fontFamily: '"Sora", sans-serif',
                    fontSize: '12px'
                  }} className="scrollbar-thin">
                    
                    {/* Micro Navigation */}
                    <div style={{ 
                      padding: '.8rem 1.25rem', 
                      borderBottom: '1px solid var(--gray2)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: '#ffffff'
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
                      background: 'radial-gradient(circle at top right, #FFFDEB, #ffffff)', 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.8rem',
                      borderBottom: '1.5px solid var(--gray2)'
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
                        {heroTitleLine1 && (heroTitleLine1.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: heroTitleLine1 }} /> : heroTitleLine1)}
                        {heroTitleLine2 && <><br />{heroTitleLine2.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: heroTitleLine2 }} /> : heroTitleLine2}</>}
                        {heroTitleLine3 && <><br />{heroTitleLine3.includes('<em>') ? <span dangerouslySetInnerHTML={{ __html: heroTitleLine3 }} /> : heroTitleLine3}</>}
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
                        <span style={{ fontSize: '.6rem', fontWeight: 800, border: '1.5px solid var(--gray2)', color: 'var(--dark)', padding: '.45rem .9rem', borderRadius: '100px', background: '#fff' }}>✦ Our Promise</span>
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
                        {heroTrust1 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: heroTrust1 }} />}
                        {heroTrust2 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: heroTrust2 }} />}
                        {heroTrust3 && <div style={{ fontSize: '.62rem', fontWeight: 600, color: 'var(--gray4)' }} dangerouslySetInnerHTML={{ __html: heroTrust3 }} />}
                      </div>
                    </div>
                    
                    {/* Miniature Category Pills */}
                    <div style={{ 
                      padding: '.75rem 1.25rem', 
                      background: '#ffffff',
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
                        <div style={{ background: '#ffffff', border: '1px solid var(--gray2)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature1Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature1Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature1Text}</span>
                        </div>
                        {/* Promise Card 2 */}
                        <div style={{ background: '#ffffff', border: '1px solid var(--gray2)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature2Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature2Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature2Text}</span>
                        </div>
                        {/* Promise Card 3 */}
                        <div style={{ background: '#ffffff', border: '1px solid var(--gray2)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature3Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature3Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature3Text}</span>
                        </div>
                        {/* Promise Card 4 */}
                        <div style={{ background: '#ffffff', border: '1px solid var(--gray2)', borderRadius: '12px', padding: '.75rem', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '1rem', display: 'block', marginBottom: '.3rem' }}>{promiseFeature4Icon}</span>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: '.15rem' }}>{promiseFeature4Title}</span>
                          <span style={{ fontSize: '.58rem', color: 'var(--gray4)', lineHeight: 1.4, display: 'block', fontWeight: 500 }}>{promiseFeature4Text}</span>
                        </div>
                      </div>
                    </div>

                    {/* Miniature Footer Section */}
                    <div style={{ 
                      padding: '1.5rem 1.25rem', 
                      background: 'var(--dark)', 
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

        {/* TAB 8: STORE SETTINGS TAB */}
        {activeAdminTab === 'settings' && (
          <div className="admin-tab active" id="atab-settings">
            <div className="admin-header"><div className="admin-title">⚙️ Control Panel Settings</div></div>
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
                    <label className="form-label">Free Delivery Threshold (৳)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={freeDeliveryMin} 
                      onChange={e => setFreeDeliveryMin(Number(e.target.value))}
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

              {/* Baseline delivery parameters */}
              <div className="admin-card settings-full">
                <div className="admin-card-head"><div className="ach-title">🚚 Baseline Delivery Fees</div></div>
                <form onSubmit={handleSaveStoreConfig} className="settings-form">
                  <div className="settings-grid">
                    <div className="form-group">
                      <label className="form-label">Baseline Shipping Fee (৳)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={storeConfig.baseDeliveryFee}
                        onChange={e => setStoreConfig({ ...storeConfig, baseDeliveryFee: Number(e.target.value) })}
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Additional Rate Per Kg (৳)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={storeConfig.perKgFee}
                        onChange={e => setStoreConfig({ ...storeConfig, perKgFee: Number(e.target.value) })}
                        required 
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary shiny-btn !rounded-full shadow-lg shadow-orange-500/10 font-bold uppercase tracking-wider text-[10px] px-6 py-2.5">Apply Baseline</button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 9: DELIVERY ZONES TAB */}
        {activeAdminTab === 'delivery' && (
          <div className="admin-tab active" id="atab-delivery">
            <div className="admin-header">
              <div className="admin-title">🚚 Delivery Zones Directory</div>
              <button className="add-btn shiny-btn !rounded-full shadow-md hover:-translate-y-0.5" onClick={() => openZoneModal()}>+ Add Zone</button>
            </div>
            
            <div className="admin-card">
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Covered Areas</th>
                      <th>Delivery Fee</th>
                      <th>Est. Time</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryZones.map((z, idx) => (
                      <tr key={idx}>
                        <td><strong>{z.zone}</strong></td>
                        <td className="text-xs font-semibold text-gray4 leading-relaxed">{z.areas}</td>
                        <td className="font-display font-extrabold text-sm text-primary">৳{z.fee}</td>
                        <td className="text-xs font-bold">{z.time}</td>
                        <td><span className="badge badge-green">● Active</span></td>
                        <td>
                          <div className="at-actions">
                            <button onClick={() => openZoneModal(z, idx)} className="at-action-btn" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteZone(idx)} className="at-action-btn danger" title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dynamic Delivery Zone Creation Modal */}
            {showZoneModal && (
              <div className="fixed inset-0 bg-slate-900/75 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                <div className="glass-modal max-w-sm w-full overflow-hidden flex flex-col animate-in scale-in duration-300">
                  <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-500 p-6 text-white flex justify-between items-center shrink-0 shadow-md">
                    <div>
                      <h3 className="font-['Fraunces'] font-black text-lg uppercase tracking-wide text-white">{editZoneIndex !== null ? '✏️ Edit Delivery Zone' : '🚚 Add Delivery Zone'}</h3>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-green-100 mt-1">Logistics Coverage Registry</p>
                    </div>
                    <button 
                      onClick={() => setShowZoneModal(false)} 
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all font-black text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveZone} className="flex flex-col">
                    <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Zone Title</label>
                        <input 
                          type="text" 
                          value={zoneName} 
                          onChange={e => setZoneName(e.target.value)} 
                          placeholder="Dhaka Metro" 
                          required 
                          className="form-input font-bold text-xs" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Covered Areas (comma separated)</label>
                        <input 
                          type="text" 
                          value={zoneAreas} 
                          onChange={e => setZoneAreas(e.target.value)} 
                          placeholder="Mirpur, Gulshan, Dhanmondi" 
                          required 
                          className="form-input font-bold text-xs" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Delivery Fee (৳)</label>
                        <input 
                          type="number" 
                          value={zoneFee} 
                          onChange={e => setZoneFee(e.target.value)} 
                          required 
                          className="form-input font-bold text-xs" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--gray4)] mb-1.5 font-['Sora']">Estimated Time</label>
                        <input 
                          type="text" 
                          value={zoneTime} 
                          onChange={e => setZoneTime(e.target.value)} 
                          placeholder="Same Day" 
                          required 
                          className="form-input font-bold text-xs" 
                        />
                      </div>
                    </div>

                    <div className="p-6 bg-[var(--gray1)] border-t border-[var(--gray2)] flex justify-end gap-3">
                      <button 
                        type="button" 
                        onClick={() => setShowZoneModal(false)} 
                        className="btn-secondary uppercase text-xs font-bold py-3 px-6 rounded-full shadow-sm transition-all duration-200 active:scale-95"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn-primary shiny-btn uppercase text-xs font-bold py-3 px-6 rounded-full shadow-lg shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {editZoneIndex !== null ? 'Update Zone' : 'Register Zone'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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

      </div>
    </div>
  );
}