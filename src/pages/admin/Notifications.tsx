import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell, ShieldCheck, ShoppingBag, MessageSquare, AlertTriangle,
  LifeBuoy, DollarSign, Package, CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Notice = {
  id: string;
  type: "merchant" | "order" | "review" | "dispute" | "ticket" | "refund" | "product";
  title: string;
  description: string;
  created_at: string;
  href: string;
  severity: "info" | "warning" | "critical";
};

const ICONS: Record<Notice["type"], any> = {
  merchant: ShieldCheck,
  order: ShoppingBag,
  review: MessageSquare,
  dispute: AlertTriangle,
  ticket: LifeBuoy,
  refund: DollarSign,
  product: Package,
};

export default function Notifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Notice["type"]>("all");
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
        supabase.from("merchant_applications").select("id, created_at, status").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("orders").select("id, created_at, total, status").order("created_at", { ascending: false }).limit(10),
        supabase.from("reviews").select("id, created_at, rating, status").eq("status", "flagged").order("created_at", { ascending: false }).limit(10),
        supabase.from("disputes").select("id, created_at, reason, status").eq("status", "open").order("created_at", { ascending: false }).limit(10),
        supabase.from("tickets").select("id, created_at, subject, status, priority").in("status", ["open", "in_progress", "waiting"]).order("created_at", { ascending: false }).limit(10),
        supabase.from("refunds").select("id, created_at, amount, status").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        supabase.from("products").select("id, created_at, title, status").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
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

  const filtered = items.filter((i) => filter === "all" || i.type === filter);
  const unreadCount = items.filter((i) => !read.has(i.id)).length;

  const markAllRead = () => persist(new Set(items.map((i) => i.id)));
  const toggleRead = (id: string) => {
    const s = new Set(read);
    s.has(id) ? s.delete(id) : s.add(id);
    persist(s);
  };

  const tabs: Array<{ key: typeof filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "merchant", label: "Merchants" },
    { key: "order", label: "Orders" },
    { key: "product", label: "Products" },
    { key: "review", label: "Reviews" },
    { key: "ticket", label: "Support" },
    { key: "dispute", label: "Disputes" },
    { key: "refund", label: "Refunds" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display text-neutral-1 flex items-center gap-3">
            <Bell className="h-7 w-7 text-primary" />
            Notifications
            {unreadCount > 0 && <Badge variant="warning">{unreadCount} new</Badge>}
          </h1>
          <p className="text-body text-neutral-2 mt-1">Platform activity that needs your attention.</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => {
          const count = t.key === "all" ? items.length : items.filter((i) => i.type === t.key).length;
          const active = filter === t.key;
          return (
            <Button
              key={t.key}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <Badge variant={active ? "secondary" : "outline"} className="ml-1">{count}</Badge>
            </Button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-neutral-4">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No notifications
            </div>
          ) : (
            <ul className="divide-y divide-neutral-6">
              {filtered.map((n) => {
                const Icon = ICONS[n.type];
                const isRead = read.has(n.id);
                const sevClass =
                  n.severity === "critical" ? "bg-destructive/10 text-destructive-foreground" :
                  n.severity === "warning" ? "bg-warning/10 text-warning" :
                  "bg-primary/10 text-primary";
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 p-4 hover:bg-neutral-7/50 transition-colors ${!isRead ? "bg-primary-bg/30" : ""}`}
                  >
                    <div className={`h-10 w-10 rounded-input flex items-center justify-center shrink-0 ${sevClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Link to={n.href} onClick={() => toggleRead(n.id)} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-body ${!isRead ? "font-semibold text-neutral-1" : "text-neutral-2"}`}>
                          {n.title}
                        </span>
                        {!isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <div className="text-caption text-neutral-4 truncate">{n.description}</div>
                      <div className="text-caption text-neutral-4 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => toggleRead(n.id)}>
                      {isRead ? "Mark unread" : "Mark read"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
