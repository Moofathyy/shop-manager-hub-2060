import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Store, ShoppingBag, DollarSign, ShieldCheck, Package,
  LifeBuoy, Flag, AlertTriangle, TrendingUp, ArrowRight,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Granularity = "daily" | "weekly" | "monthly";

interface Kpi {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "default" | "warning" | "danger";
  href?: string;
  sub?: string;
}

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-light))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const isoWeek = (d: Date) => {
  // ISO week label: yyyy-Www
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const isoMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [orders, setOrders] = useState<{ total: number; created_at: string; seller_id: string }[]>([]);
  const [commissionRates, setCommissionRates] = useState<Record<string, number>>({});
  const [signups, setSignups] = useState<{ date: string; shoppers: number; sellers: number }[]>([]);
  const [topCategories, setTopCategories] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const sinceToday = startOfDay(now);
      const sinceWeek = new Date(now.getTime() - 7 * 86400000);
      const sinceMonth = new Date(now.getTime() - 30 * 86400000);
      const since30Iso = sinceMonth.toISOString();

      const [
        ordersRes, profilesRes, sellersRes, productsRes,
        prodPendingRes, merchPendingRes, ticketsRes,
        reviewsFlaggedRes, txnFlaggedRes, itemsRes, categoriesRes,
      ] = await Promise.all([
        supabase.from("orders").select("total, created_at, seller_id"),
        supabase.from("profiles").select("id, last_login, created_at"),
        supabase.from("seller_profiles").select("user_id, approval_status, commission_rate, created_at"),
        supabase.from("products").select("id, seller_id, category_id, status"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "flagged"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).or("flagged.eq.true,status.eq.failed"),
        supabase.from("order_items").select("price, qty, product_id"),
        supabase.from("categories").select("id, name"),
      ]);

      const ordersData = (ordersRes.data ?? []) as { total: number; created_at: string; seller_id: string }[];
      const profiles = profilesRes.data ?? [];
      const sellers = sellersRes.data ?? [];
      const products = productsRes.data ?? [];
      const items = itemsRes.data ?? [];
      const cats = categoriesRes.data ?? [];

      // Commission map by seller
      const rateMap: Record<string, number> = {};
      sellers.forEach((s: any) => { rateMap[s.user_id] = Number(s.commission_rate ?? 10); });
      setCommissionRates(rateMap);

      const gmvToday = ordersData.filter((o) => new Date(o.created_at) >= sinceToday).reduce((s, o) => s + Number(o.total), 0);
      const gmvWeek = ordersData.filter((o) => new Date(o.created_at) >= sinceWeek).reduce((s, o) => s + Number(o.total), 0);
      const gmvMonth = ordersData.filter((o) => new Date(o.created_at) >= sinceMonth).reduce((s, o) => s + Number(o.total), 0);
      const commissionMonth = ordersData
        .filter((o) => new Date(o.created_at) >= sinceMonth)
        .reduce((s, o) => s + Number(o.total) * ((rateMap[o.seller_id] ?? 10) / 100), 0);

      const activeShoppers =
        profiles.filter((p: any) => p.last_login && new Date(p.last_login) >= new Date(since30Iso)).length
        || profiles.length;

      const sellersWithLiveProducts = new Set(
        products.filter((p: any) => p.status === "approved").map((p: any) => p.seller_id),
      ).size;

      setKpis([
        { label: "GMV — Today", value: fmtMoney(gmvToday), icon: DollarSign, sub: "Gross merchandise value" },
        { label: "GMV — 7 days", value: fmtMoney(gmvWeek), icon: TrendingUp },
        { label: "GMV — 30 days", value: fmtMoney(gmvMonth), icon: TrendingUp },
        { label: "Platform Revenue (30d)", value: fmtMoney(commissionMonth), icon: DollarSign, sub: "Commission earned" },
        { label: "Active Shoppers", value: String(activeShoppers), icon: Users, sub: "Logged in last 30d" },
        { label: "Active Sellers", value: String(sellersWithLiveProducts), icon: Store, sub: "With ≥1 live product" },
        { label: "Pending Merchants", value: String(merchPendingRes.count ?? 0), icon: ShieldCheck, tone: "warning", href: "/admin/merchants" },
        { label: "Pending Products", value: String(prodPendingRes.count ?? 0), icon: Package, tone: "warning", href: "/admin/products" },
        { label: "Open Tickets", value: String(ticketsRes.count ?? 0), icon: LifeBuoy, tone: "warning", href: "/admin/support" },
        { label: "Flagged Reviews", value: String(reviewsFlaggedRes.count ?? 0), icon: Flag, tone: "warning", href: "/admin/reviews" },
        { label: "Suspicious Txns", value: String(txnFlaggedRes.count ?? 0), icon: AlertTriangle, tone: "danger", href: "/admin/finance" },
        { label: "Total Orders", value: String(ordersData.length), icon: ShoppingBag },
      ]);

      setOrders(ordersData);

      // Signups over last 14 days
      const sgn: { date: string; shoppers: number; sellers: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = isoDay(d);
        sgn.push({
          date: key.slice(5),
          shoppers: profiles.filter((p: any) => p.created_at?.slice(0, 10) === key).length,
          sellers: sellers.filter((s: any) => s.created_at?.slice(0, 10) === key).length,
        });
      }
      setSignups(sgn);

      // Top 5 categories by sales (revenue from order_items)
      const prodToCat: Record<string, string | null> = {};
      products.forEach((p: any) => { prodToCat[p.id] = p.category_id; });
      const catName: Record<string, string> = {};
      cats.forEach((c: any) => { catName[c.id] = c.name; });
      const catRevenue: Record<string, number> = {};
      items.forEach((it: any) => {
        const cid = prodToCat[it.product_id];
        if (!cid) return;
        catRevenue[cid] = (catRevenue[cid] ?? 0) + Number(it.price) * Number(it.qty);
      });
      const top = Object.entries(catRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, v]) => ({ name: catName[id] ?? "Uncategorized", value: Math.round(v) }));
      setTopCategories(top);

      setLoading(false);
    })();
  }, []);

  // Orders per day for the last 30 days (fixed daily bucket)
  const ordersPerDay = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, number> = {};
    const order: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const k = isoDay(new Date(now.getTime() - i * 86400000));
      buckets[k] = 0;
      order.push(k);
    }
    orders.forEach((o) => {
      const k = isoDay(new Date(o.created_at));
      if (k in buckets) buckets[k] += 1;
    });
    return order.map((k) => ({ date: k.slice(5), orders: buckets[k] }));
  }, [orders]);

  // Aggregate revenue/orders timeseries based on granularity
  const timeseries = useMemo(() => {
    if (!orders.length) return [] as { label: string; revenue: number; orders: number }[];
    const buckets: Record<string, { revenue: number; orders: number }> = {};
    const keyer = granularity === "daily" ? isoDay : granularity === "weekly" ? isoWeek : isoMonth;

    const now = new Date();
    const points = granularity === "daily" ? 14 : granularity === "weekly" ? 12 : 6;
    const stepDays = granularity === "daily" ? 1 : granularity === "weekly" ? 7 : 30;

    const order: string[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * stepDays * 86400000);
      const k = keyer(d);
      if (!buckets[k]) { buckets[k] = { revenue: 0, orders: 0 }; order.push(k); }
    }

    orders.forEach((o) => {
      const k = keyer(new Date(o.created_at));
      if (!buckets[k]) return;
      buckets[k].revenue += Number(o.total);
      buckets[k].orders += 1;
    });

    return order.map((k) => ({
      label: granularity === "daily" ? k.slice(5) : k,
      revenue: Math.round(buckets[k].revenue),
      orders: buckets[k].orders,
    }));
  }, [orders, granularity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Overview</h1>
        <p className="text-body text-neutral-2 mt-1">Real-time snapshot of platform health.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {(loading ? Array.from({ length: 12 }).map((_, i) => ({ _i: i } as any)) : kpis).map((k: Kpi, i: number) => {
          const toneBg =
            k.tone === "danger" ? "bg-destructive-bg text-destructive" :
            k.tone === "warning" ? "bg-warning-bg text-warning" :
            "bg-primary-bg text-primary";
          const Inner = (
            <Card className={k.href ? "hover:border-primary transition-colors cursor-pointer h-full" : "h-full"}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-9 w-9 rounded-input ${loading ? "bg-primary-bg text-primary" : toneBg} flex items-center justify-center`}>
                    {loading ? <ShoppingBag className="h-4 w-4" /> : <k.icon className="h-4 w-4" />}
                  </div>
                  {k.href && <ArrowRight className="h-4 w-4 text-neutral-3" />}
                </div>
                {loading ? (
                  <>
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-7 w-16" />
                  </>
                ) : (
                  <>
                    <div className="text-caption text-neutral-2">{k.label}</div>
                    <div className="text-h1 text-neutral-1 mt-1">{k.value}</div>
                    {k.sub && <div className="text-caption text-neutral-3 mt-1">{k.sub}</div>}
                  </>
                )}
              </CardContent>
            </Card>
          );
          return k.href ? <Link key={i} to={k.href}>{Inner}</Link> : <div key={i}>{Inner}</div>;
        })}
      </div>

      {/* Revenue & Orders timeseries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Revenue & orders over time</CardTitle>
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeseries}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeseries}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }} />
                <Bar dataKey="orders" fill="hsl(var(--primary-light))" radius={[6, 6, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Categories donut + signups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top 5 categories by sales</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-neutral-3 text-body">No sales data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={topCategories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {topCategories.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }}
                    formatter={(v: number) => `$${v.toLocaleString()}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New signups: shoppers vs sellers (14d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={signups}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }} />
                <Legend />
                <Line type="monotone" dataKey="shoppers" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="sellers" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
