import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarFooter 
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  FolderOpen, 
  SlidersHorizontal, 
  Cherry, 
  Package, 
  Users, 
  Ticket, 
  Star, 
  Mail, 
  BarChart3, 
  Palette, 
  User, 
  LogOut 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

export function AdminSidebar({ 
  activeAdminTab, 
  setActiveAdminTab, 
  storeName = 'Admin',
  unreadOrderCount = 0, 
  ordersLength = 0, 
  pendingReviewsCount = 0, 
  leadsLength = 0 
}) {
  const nameParts = storeName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const restName = nameParts.slice(1).join(' ');
  const mainItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'categories', icon: FolderOpen, label: 'Categories' },
    { id: 'filters', icon: SlidersHorizontal, label: 'Filters' },
    { id: 'products', icon: Cherry, label: 'Products' },
    { id: 'orders', icon: Package, label: 'Orders', badge: unreadOrderCount > 0 ? unreadOrderCount : ordersLength },
    { id: 'customers', icon: Users, label: 'Customers' }
  ];

  const manageItems = [
    { id: 'coupons', icon: Ticket, label: 'Promo Codes' },
    { id: 'packaging', icon: Package, label: 'Packaging & Delivery' },
    { id: 'reviews', icon: Star, label: 'Reviews', badge: pendingReviewsCount },
    { id: 'leads', icon: Mail, label: 'Leads', badge: leadsLength },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'customizer', icon: Palette, label: 'UI Customizer' }
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#121212] text-white">
      <SidebarHeader className="border-b border-white/10 pb-3 pt-3 px-4 bg-[#121212]">
        <div className="flex items-center gap-2">
          <div className="font-display text-xl font-black leading-tight truncate tracking-wide flex items-center">
            <span style={{ color: '#FFFFFF', fontWeight: 900 }}>{firstName}</span>
            <span style={{ color: '#E8540A', fontWeight: 900 }}>{restName ? ` ${restName}` : ''}</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full bg-[#E8540A]/20 text-[#FF7A33] mt-1.5 border border-[#E8540A]/30 w-fit whitespace-nowrap">
          <span>⚙️</span> Admin Console
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#121212]">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/40 mb-2 px-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={activeAdminTab === item.id}
                    onClick={() => setActiveAdminTab(item.id)}
                    tooltip={item.label}
                    className={`font-semibold transition-all duration-150 rounded-lg ${
                      activeAdminTab === item.id
                        ? 'bg-[#E8540A] text-white font-bold shadow-md shadow-orange-500/20 hover:bg-[#E8540A]'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className={`ml-auto rounded-full text-[0.62rem] font-bold px-1.5 py-0.5 ${
                        activeAdminTab === item.id 
                          ? 'bg-white text-[#E8540A]' 
                          : 'bg-[#E8540A]/20 text-[#FF7A33] border border-[#E8540A]/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/40 mb-2 px-2">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={activeAdminTab === item.id}
                    onClick={() => setActiveAdminTab(item.id)}
                    tooltip={item.label}
                    className={`font-semibold transition-all duration-150 rounded-lg ${
                      activeAdminTab === item.id
                        ? 'bg-[#E8540A] text-white font-bold shadow-md shadow-orange-500/20 hover:bg-[#E8540A]'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className={`ml-auto rounded-full text-[0.62rem] font-bold px-1.5 py-0.5 ${
                        activeAdminTab === item.id 
                          ? 'bg-white text-[#E8540A]' 
                          : 'bg-[#E8540A]/20 text-[#FF7A33] border border-[#E8540A]/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3 bg-[#121212]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/profile" className="text-white/70 hover:text-white hover:bg-white/10 font-semibold rounded-lg">
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut(auth)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
