import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Store, ShoppingBag, Package, Tag, FileSearch, ShieldCheck,
  DollarSign, MessageSquare, LifeBuoy, Megaphone, BarChart3, Truck, UserCog,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const main = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, end: true },
  
  { title: "Shoppers", url: "/admin/shoppers", icon: Users },
  { title: "Sellers", url: "/admin/sellers", icon: Store },
  { title: "Merchant Approvals", url: "/admin/merchants", icon: ShieldCheck },
  { title: "Admin Users", url: "/admin/admin-users", icon: UserCog },
];

const catalog = [
  { title: "Products", url: "/admin/products", icon: Package },
  { title: "Categories", url: "/admin/categories", icon: Tag },
  { title: "Orders", url: "/admin/orders", icon: ShoppingBag },
];

const ops = [
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Finance", url: "/admin/finance", icon: DollarSign },
  { title: "Logistics", url: "/admin/logistics", icon: Truck },
  { title: "Reviews", url: "/admin/reviews", icon: MessageSquare },
  { title: "Support", url: "/admin/support", icon: LifeBuoy },
  { title: "Marketing", url: "/admin/marketing", icon: Megaphone },
  { title: "Audit Log", url: "/admin/audit", icon: FileSearch },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const renderGroup = (label: string, items: typeof main) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-label text-neutral-4 uppercase">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url, item.end)} className="h-11 rounded-input data-[active=true]:bg-primary-bg data-[active=true]:text-primary data-[active=true]:font-semibold hover:bg-primary-bg/50">
                <NavLink to={item.url} end={item.end} className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="text-body">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-neutral-6">
      <SidebarHeader className="px-4 py-5 border-b border-neutral-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-input bg-primary flex items-center justify-center text-primary-foreground font-bold">
            E
          </div>
          {!collapsed && (
            <div>
              <div className="text-h3 text-primary leading-tight">Ejada</div>
              <div className="text-caption text-neutral-4">Admin Console</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        {renderGroup("Main", main)}
        {renderGroup("Catalog", catalog)}
        {renderGroup("Operations", ops)}
      </SidebarContent>
    </Sidebar>
  );
}
