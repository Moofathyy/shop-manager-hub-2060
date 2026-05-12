import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bell, ShieldCheck, ShoppingBag, MessageSquare, AlertTriangle,
  LifeBuoy, DollarSign, Package, CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type NoticeType = "merchant" | "order" | "review" | "dispute" | "ticket" | "refund" | "product";
type Notice = {
  id: string;
  type: NoticeType;
  title: string;
  description: string;
  created_at: string;
  href: string;
  severity: "info" | "warning" | "critical";
};

const ICONS: Record<NoticeType, any> = {
  merchant: ShieldCheck,
  order: ShoppingBag,
  review: MessageSquare,
  dispute: AlertTriangle,
  ticket: LifeBuoy,
  refund: DollarSign,
  product: Package,
};

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [read, setRead] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("notif:read") ?? "[]")); }
    catch { return new Set(); }
  });

  const persist = (s: Set<string>) => {
    setRead(new Set(s));
    localStorage.setItem("notif:read", JSON.stringify([...s]));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [merchants, orders, reviews, disputes, tickets, refunds, products] = await Promise.all([
        supabase.from("merchant_applications").select("id, created_at, status").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("id, created_at, total, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("reviews").select("id, created_at, rating, status").eq("status", "flagged").order("created_at", { ascending: false }).limit(5),
        supabase.from("disputes").select("id, created_at, reason, status").eq("status", "open").order("created_at", { ascending: false }).limit(5),
        supabase.from("tickets").select("id, created_at, subject, status, priority").in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("refunds").select("id, created_at, amount, status").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("products").select("id, created_at, title, status").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      ]);

      const list: Notice[] = [];
      (merchants.data ?? []).forEach((r) => list.push({
        id: `merchant-${r.id}`, type: "merchant", title: "New merchant application",
        description: "Pending KYC review", created_at: r.created_at, href: `/admin/merchants/${r.id}`, severity: "warning",
      }));
      (orders.data ?? []).forEach((r) => list.push({
        id: `order-${r.id}`, type: "order", title: `New order · $${Number(r.total).toFixed(2)}`,
        description: `Status: ${r.status}`, created_at: r.created_at, href: `/admin/orders/${r.id}`, severity: "info",
      }));
      (reviews.data ?? []).forEach((r) => list.push({
        id: `review-${r.id}`, type: "review", title: "Review flagged for moderation",
        description: `Rating: ${r.rating}/5`, created_at: r.created_at, href: `/admin/reviews`, severity: "warning",
      }));
      (disputes.data ?? []).forEach((r) => list.push({
        id: `dispute-${r.id}`, type: "dispute", title: "Open dispute",
        description: r.reason ?? "—", created_at: r.created_at, href: `/admin/support`, severity: "critical",
      }));
      (tickets.data ?? []).forEach((r: any) => list.push({
        id: `ticket-${r.id}`, type: "ticket", title: r.subject,
        description: `${r.priority} priority`, created_at: r.created_at, href: `/admin/support`,
        severity: r.priority === "high" || r.priority === "urgent" ? "critical" : "info",
      }));
      (refunds.data ?? []).forEach((r) => list.push({
        id: `refund-${r.id}`, type: "refund", title: `Refund request · $${Number(r.amount).toFixed(2)}`,
        description: "Awaiting finance review", created_at: r.created_at, href: `/admin/finance`, severity: "warning",
      }));
      (products.data ?? []).forEach((r) => list.push({
        id: `product-${r.id}`, type: "product", title: "Product awaiting approval",
        description: r.title, created_at: r.created_at, href: `/admin/products/${r.id}`, severity: "info",
      }));

      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setItems(list);
      setLoading(false);
    })();
  }, []);

  const unreadCount = items.filter((i) => !read.has(i.id)).length;
  const markAllRead = () => persist(new Set(items.map((i) => i.id)));
  const markRead = (id: string) => { const s = new Set(read); s.add(id); persist(s); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-neutral-2">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-micro font-semibold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-6">
          <div className="flex items-center gap-2">
            <span className="text-label text-neutral-1">Notifications</span>
            {unreadCount > 0 && <Badge variant="warning">{unreadCount} new</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-neutral-4">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <div className="text-caption">No notifications</div>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-6">
              {items.slice(0, 20).map((n) => {
                const Icon = ICONS[n.type];
                const isRead = read.has(n.id);
                const sevClass =
                  n.severity === "critical" ? "bg-destructive/10 text-destructive" :
                  n.severity === "warning" ? "bg-warning/10 text-warning" :
                  "bg-primary/10 text-primary";
                return (
                  <li key={n.id} className={`hover:bg-neutral-7/50 transition-colors ${!isRead ? "bg-primary-bg/30" : ""}`}>
                    <Link
                      to={n.href}
                      onClick={() => { markRead(n.id); setOpen(false); }}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className={`h-9 w-9 rounded-input flex items-center justify-center shrink-0 ${sevClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-caption ${!isRead ? "font-semibold text-neutral-1" : "text-neutral-2"} truncate`}>
                            {n.title}
                          </span>
                          {!isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <div className="text-micro text-neutral-4 truncate">{n.description}</div>
                        <div className="text-micro text-neutral-4 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
