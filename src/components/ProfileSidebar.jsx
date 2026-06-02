import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  Package, 
  Heart, 
  Wallet, 
  MapPin, 
  Star, 
  Bell, 
  User, 
  Shield, 
  ShieldCheck, 
  LogOut,
  X
} from 'lucide-react';

export default function ProfileSidebar({
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  user,
  displayName,
  initials,
  isAdmin,
  myOrdersCount = 0,
  wishlistCount = 0,
  notificationsCount = 0,
  handleLogout
}) {

  const NavItem = ({ tabId, icon: Icon, label, badge, isDanger }) => {
    const isActive = activeTab === tabId;
    return (
      <button
        onClick={() => {
          setActiveTab(tabId);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive 
            ? 'bg-zinc-100 text-zinc-900 shadow-sm' 
            : isDanger 
              ? 'text-red-600 hover:bg-red-50' 
              : 'text-zinc-600 hover:bg-zinc-100/50 hover:text-zinc-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-900' : isDanger ? 'text-red-600' : 'text-zinc-500'}`} />
          <span>{label}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-zinc-900 text-zinc-50' : 'bg-zinc-100 text-zinc-600'}`}>
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
        className={`fixed inset-y-0 left-0 z-[300] w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:block shrink-0`}
      >
        {/* Mobile close button */}
        {isSidebarOpen && (
          <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Menu</span>
            <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* User Card */}
        <div className="p-6 border-b border-zinc-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold mb-3 shadow-inner">
            {initials}
          </div>
          <h2 className="text-base font-bold text-zinc-900 truncate w-full">{user?.displayName || displayName || 'Vertex User'}</h2>
          <p className="text-xs text-zinc-500 truncate w-full">{user?.email}</p>
          <div className="mt-3 px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-orange-500" />
            {isAdmin ? 'Master Admin' : 'Gold Member'}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-6">
          <div className="space-y-1">
            <NavItem tabId="overview" icon={Home} label="Overview" />
            <NavItem tabId="orders" icon={Package} label="My Orders" badge={myOrdersCount} />
            <NavItem tabId="wishlist" icon={Heart} label="Wishlist" badge={wishlistCount} />
            <NavItem tabId="wallet" icon={Wallet} label="Wallet & Points" />
            <NavItem tabId="addresses" icon={MapPin} label="Addresses" />
            <NavItem tabId="reviews" icon={Star} label="My Reviews" />
            <NavItem tabId="notifications" icon={Bell} label="Notifications" badge={notificationsCount} />
          </div>

          <div className="space-y-1">
            <h4 className="px-3 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Account</h4>
            <NavItem tabId="profile" icon={User} label="Edit Profile" />
            <NavItem tabId="security" icon={Shield} label="Security" />
          </div>

          {isAdmin && (
            <div className="space-y-1 pt-2 border-t border-zinc-100">
              <Link 
                to="/admin" 
                onClick={() => setIsSidebarOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Console</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
