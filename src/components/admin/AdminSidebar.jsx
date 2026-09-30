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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  FolderOpen, 
  SlidersHorizontal, 
  Cherry, 
  Package, 
  Warehouse,
  Users, 
  Ticket, 
  Truck,
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
  ordersBadgeCount = 0, 
  pendingReviewsCount = 0, 
  leadsLength = 0 
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const nameParts = storeName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const restName = nameParts.slice(1).join(' ');
  const mainItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'categories', icon: FolderOpen, label: 'Categories' },
    { id: 'filters', icon: SlidersHorizontal, label: 'Filters' },
    { id: 'products', icon: Cherry, label: 'Products' },
    { id: 'inventory', icon: Warehouse, label: 'Inventory' },
    { id: 'orders', icon: Package, label: 'Orders', badge: ordersBadgeCount },
    { id: 'customers', icon: Users, label: 'Customers' }
  ];

  const manageItems = [
    { id: 'coupons', icon: Ticket, label: 'Promo Codes' },
    { id: 'packaging', icon: Truck, label: 'Packaging & Delivery' },
    { id: 'reviews', icon: Star, label: 'Reviews', badge: pendingReviewsCount },
    { id: 'leads', icon: Mail, label: 'Leads', badge: leadsLength },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'customizer', icon: Palette, label: 'UI Customizer' }
  ];

  const handleNavClick = (tabId) => {
    setActiveAdminTab(tabId);
    if (isMobile) setOpenMobile(false);
  };

  const renderMenuItems = (items) => items.map(item => {
    const isActive = activeAdminTab === item.id;
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton 
          isActive={isActive}
          onClick={() => handleNavClick(item.id)}
          tooltip={item.label}
          className={`font-semibold transition-all duration-150 rounded-lg ${
            isActive
              ? ''
              : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }`}
          style={isActive 
            ? { background: '#E8540A', color: '#fff', fontWeight: 700, boxShadow: '0 4px 12px rgba(232,84,10,0.25)' }
            : { color: 'var(--text-secondary)' }
          }
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.label}</span>
          {item.badge > 0 && (
            <span 
              className="ml-auto rounded-full text-[0.62rem] font-bold px-1.5 py-0.5 min-w-[1.25rem] text-center"
              style={isActive 
                ? { background: '#fff', color: '#E8540A' }
                : { background: 'var(--primary-pale)', color: '#E8540A', border: '1px solid rgba(232, 84, 10, 0.15)' }
              }
            >
              {item.badge}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border pb-3 pt-3 px-4 bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="font-display text-xl font-black leading-tight truncate tracking-wide flex items-center">
            <span style={{ color: 'var(--text-primary)', fontWeight: 900 }}>{firstName}</span>
            <span style={{ color: '#E8540A', fontWeight: 900 }}>{restName ? ` ${restName}` : ''}</span>
          </div>
        </div>
        <div 
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full mt-1.5 w-fit whitespace-nowrap"
          style={{ 
            background: 'var(--primary-pale)', 
            color: '#E8540A', 
            border: '1px solid rgba(232, 84, 10, 0.15)' 
          }}
        >
          <span>⚙️</span> Admin Console
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-bold uppercase tracking-[0.12em] mb-2 px-2" style={{ color: 'var(--text-muted)' }}>
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(mainItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] font-bold uppercase tracking-[0.12em] mb-2 px-2" style={{ color: 'var(--text-muted)' }}>
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(manageItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="hover:bg-sidebar-accent rounded-lg">
              <Link to="/profile" className="font-semibold rounded-lg" style={{ color: 'var(--text-secondary)' }}>
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => signOut(auth)}
              className="font-semibold rounded-lg hover:bg-red-500/10"
              style={{ color: '#DC2626' }}
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
