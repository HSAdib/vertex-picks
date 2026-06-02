import React from 'react';
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
  ShieldCheck
} from 'lucide-react';

// A helper if needed, but we can just use normal template strings.

export default function AdminSidebar({ 
  activeAdminTab, 
  setActiveAdminTab, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  ordersCount = 0, 
  reviewsCount = 0,
  handleLogout
}) {

  const NavItem = ({ tabId, icon: Icon, label, badge }) => {
    const isActive = activeAdminTab === tabId;
    return (
      <button
        onClick={() => {
          setActiveAdminTab(tabId);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive 
            ? 'bg-zinc-800 text-zinc-50' 
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-50' : 'text-zinc-400'}`} />
          <span>{label}</span>
        </div>
        {badge !== undefined && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Clickable background overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[290] lg:hidden transition-opacity duration-300" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-[300] w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:block`}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 text-zinc-50 font-bold tracking-tight">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span>Vertex<span className="text-orange-500">Picks</span> Admin</span>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden text-zinc-400 hover:text-zinc-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Nav Content */}
        <div className="flex-1 overflow-y-auto scrollbar-none py-6 px-3 space-y-8">
          
          {/* Section: Main */}
          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Main</h4>
            <NavItem tabId="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem tabId="analytics" icon={LineChart} label="Analytics" />
          </div>

          {/* Section: Catalog */}
          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Catalog</h4>
            <NavItem tabId="products" icon={PackageSearch} label="Products" />
            <NavItem tabId="inventory" icon={Boxes} label="Inventory" />
            <NavItem tabId="coupons" icon={Ticket} label="Coupons" />
          </div>

          {/* Section: Sales */}
          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sales</h4>
            <NavItem tabId="orders" icon={ShoppingCart} label="Orders" badge={ordersCount} />
            <NavItem tabId="customers" icon={Users} label="Customers" />
            <NavItem tabId="reviews" icon={Star} label="Reviews" badge={reviewsCount} />
          </div>

          {/* Section: System */}
          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">System</h4>
            <NavItem tabId="settings" icon={Settings} label="Settings" />
            <NavItem tabId="delivery" icon={Truck} label="Delivery Zones" />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
