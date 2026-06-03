import { 
  LayoutDashboard, 
  LineChart, 
  PackageSearch, 
  Boxes, 
  Ticket, 
  ShoppingCart, 
  Users, 
  Star, 
  Settings, 
  Truck,
  LogOut,
  X,
  ShieldCheck,
  FolderTree
} from 'lucide-react';

export default function AdminSidebar({ 
  activeAdminTab, 
  setActiveAdminTab, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  ordersCount = 0, 
  reviewsCount = 0,
  handleLogout
}) {

  const renderNavItem = (tabId, Icon, label, badge) => {
    const isActive = activeAdminTab === tabId;
    return (
      <button
        onClick={() => {
          setActiveAdminTab(tabId);
          setIsSidebarOpen(false);
        }}
        className={`admin-nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="ani-icon"><Icon size={16} /></span>
        <span>{label}</span>
        {badge !== undefined && (
          <span className="ani-badge">{badge}</span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-[290] lg:hidden" 
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`admin-sidebar fixed inset-y-0 left-0 z-[300] w-64 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:block`}
      >
        {/* Header / Logo */}
        <div className="admin-logo-area flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
            <span className="admin-logo-text">Vertex<span>Picks</span></span>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="admin-nav-item lg:hidden"
            style={{ width: 'auto', padding: '4px', marginBottom: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Nav Content */}
        <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: 'thin' }}>
          
          {/* Section: Main */}
          <div className="admin-nav-section">
            <span className="admin-nav-label">Main</span>
            {renderNavItem('dashboard', LayoutDashboard, 'Dashboard')}
            {renderNavItem('analytics', LineChart, 'Analytics')}
          </div>

          {/* Section: Catalog */}
          <div className="admin-nav-section">
            <span className="admin-nav-label">Catalog</span>
            {renderNavItem('categories', FolderTree, 'Categories')}
            {renderNavItem('products', PackageSearch, 'Products')}
            {renderNavItem('inventory', Boxes, 'Inventory')}
            {renderNavItem('coupons', Ticket, 'Coupons')}
          </div>

          {/* Section: Sales */}
          <div className="admin-nav-section">
            <span className="admin-nav-label">Sales</span>
            {renderNavItem('orders', ShoppingCart, 'Orders', ordersCount)}
            {renderNavItem('customers', Users, 'Customers')}
            {renderNavItem('reviews', Star, 'Reviews', reviewsCount)}
          </div>

          {/* Section: System */}
          <div className="admin-nav-section">
            <span className="admin-nav-label">System</span>
            {renderNavItem('settings', Settings, 'Settings')}
            {renderNavItem('delivery', Truck, 'Delivery Zones')}
          </div>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', padding: '.9rem', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <button 
            onClick={handleLogout}
            className="admin-nav-item"
            style={{ width: '100%', textAlign: 'left', color: 'var(--red)' }}
          >
            <span className="ani-icon"><LogOut size={16} /></span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
