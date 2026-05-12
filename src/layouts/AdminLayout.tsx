import { Outlet, useLocation, Link } from "react-router-dom";
import { Search, LogOut, ChevronRight } from "lucide-react";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const labels: Record<string, string> = {
  admin: "Overview",
  shoppers: "Shoppers",
  sellers: "Sellers",
  merchants: "Merchant Approvals",
  products: "Products",
  categories: "Categories",
  orders: "Orders",
  audit: "Audit Log",
};

export default function AdminLayout() {
  const { user, signOut, roles } = useAuth();
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-neutral-7">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-neutral-6 bg-background px-4 sticky top-0 z-30">
            <SidebarTrigger className="text-neutral-2" />
            <div className="flex-1" />
            <div className="hidden lg:flex relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-4" />
              <Input placeholder="Search…" className="h-10 pl-9 text-body" />
            </div>
            <Button variant="ghost" size="icon" className="text-neutral-2">
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-neutral-7">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-label">
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-caption text-neutral-2 leading-tight max-w-[140px] truncate">{user?.email}</div>
                    <div className="text-micro text-neutral-4 leading-tight capitalize">{(["super_admin","admin","finance_admin","seller","shopper"].find(r => roles.includes(r as any)) ?? roles[0])?.replace("_", " ")}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive-foreground">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <nav className="hidden md:flex items-center gap-1 text-caption text-neutral-4 px-6 pt-4">
            {segments.map((seg, i) => {
              const path = "/" + segments.slice(0, i + 1).join("/");
              const isLast = i === segments.length - 1;
              return (
                <span key={path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {isLast ? (
                    <span className="text-neutral-2 font-semibold">{labels[seg] ?? seg}</span>
                  ) : (
                    <Link to={path} className="hover:text-primary">{labels[seg] ?? seg}</Link>
                  )}
                </span>
              );
            })}
          </nav>
          <main className="flex-1 p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
