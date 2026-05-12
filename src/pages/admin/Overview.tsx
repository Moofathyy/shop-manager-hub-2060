import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users, Store, ShoppingBag, DollarSign, ShieldCheck, Package,
  LifeBuoy, Flag, AlertTriangle, TrendingUp, ArrowUpRight, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Granularity = "daily" | "weekly" | "monthly";

interface Kpi {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "default" | "warning" | "danger" | "primary";
  href?: string;
  sub?: string;
  featured?: boolean;
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
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const isoMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--neutral-6))",
  background: "hsl(var(--background))",
  boxShadow: "0 10px 30px -10px hsl(var(--neutral-1) / 0.18)",
  fontSize: 12,
};

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [orders, setOrders] = useState<{ total: number; created_at: string; seller_id: string }[]>([]);
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

      const rateMap: Record<string, number> = {};
      sellers.forEach((s: any) => { rateMap[s.user_id] = Number(s.commission_rate ?? 10); });

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
        { label: "GMV — Today", value: fmtMoney(gmvToday), icon: DollarSign, sub: "Gross merchandise value", tone: "primary", featured: true },
        { label: "GMV — 7 days", value: fmtMoney(gmvWeek), icon: TrendingUp, tone: "primary", featured: true },
        { label: "GMV — 30 days", value: fmtMoney(gmvMonth), icon: TrendingUp, tone: "primary", featured: true },
        { label: "Platform Revenue (30d)", value: fmtMoney(commissionMonth), icon: Sparkles, sub: "Commission earned", tone: "primary", featured: true },
        { label: "Active Shoppers", value: String(activeShoppers), icon: Users, sub: "Logged in last 30d" },
        { label: "Active Sellers", value: String(sellersWithLiveProducts), icon: Store, sub: "With ≥1 live product" },
        { label: "Total Orders", value: String(ordersData.length), icon: ShoppingBag, sub: "All-time" },
        { label: "Pending Merchants", value: String(merchPendingRes.count ?? 0), icon: ShieldCheck, tone: "warning", href: "/admin/merchants" },
        { label: "Pending Products", value: String(prodPendingRes.count ?? 0), icon: Package, tone: "warning", href: "/admin/products" },
        { label: "Open Tickets", value: String(ticketsRes.count ?? 0), icon: LifeBuoy, tone: "warning", href: "/admin/support" },
        { label: "Flagged Reviews", value: String(reviewsFlaggedRes.count ?? 0), icon: Flag, tone: "warning", href: "/admin/reviews" },
        { label: "Suspicious Txns", value: String(txnFlaggedRes.count ?? 0), icon: AlertTriangle, tone: "danger", href: "/admin/finance" },
      ]);

      setOrders(ordersData);

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
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-6 bg-gradient-to-br from-primary-bg via-background to-accent/10 p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-6 bg-background/70 px-3 py-1 text-caption text-neutral-2 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live data
            </div>
            <h1 className="mt-3 text-display text-neutral-1">Overview</h1>
            <p className="text-body text-neutral-2 mt-1 max-w-xl">
              Real-time snapshot of platform health, performance, and approvals.
            </p>
          </div>
          <div className="flex items-center gap-2 text-caption text-neutral-3">
            <span>Updated</span>
            <Badge variant="outline" className="font-normal">
              {new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
            </Badge>
          </div>
        </div>
      </div>

      {/* FEATURED KPI ROW (GMV & Revenue) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(loading ? Array.from({ length: 4 }).map((_, i) => ({ _i: i } as any)) : kpis.filter((k) => k.featured)).map(
          (k: Kpi, i: number) => {
            const featuredGradients = [
              "from-emerald-400 to-teal-500",
              "from-fuchsia-500 to-pink-500",
              "from-amber-400 to-orange-500",
              "from-blue-500 to-indigo-500",
            ];
            const gradient = featuredGradients[i % featuredGradients.length];
            return (
              <Card
                key={i}
                className={`group relative overflow-hidden border-0 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 animate-fade-in bg-gradient-to-br ${gradient}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-all duration-500 group-hover:scale-125" />
                <div aria-hidden className="pointer-events-none absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-white/10" />
                <CardContent className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                      {loading ? <DollarSign className="h-5 w-5 text-white" /> : <k.icon className="h-5 w-5 text-white" />}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-2 py-1 text-[11px] font-medium ring-1 ring-white/25">
                      <TrendingUp className="h-3 w-3" /> live
                    </div>
                  </div>
                  {loading ? (
                    <>
                      <Skeleton className="h-3 w-24 mb-2 bg-white/30" />
                      <Skeleton className="h-8 w-20 bg-white/30" />
                    </>
                  ) : (
                    <>
                      <div className="text-caption font-medium text-white/85 uppercase tracking-wide">{k.label}</div>
                      <div className="text-display text-white mt-1 tabular-nums">{k.value}</div>
                      {k.sub && <div className="text-caption text-white/75 mt-1">{k.sub}</div>}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      {/* SECONDARY KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {(loading ? Array.from({ length: 8 }).map((_, i) => ({ _i: i } as any)) : kpis.filter((k) => !k.featured)).map(
          (k: Kpi, i: number) => {
            const toneGradient =
              k.tone === "danger" ? "from-rose-400 to-red-500" :
              k.tone === "warning" ? "from-amber-400 to-orange-500" :
              k.tone === "primary" ? "from-blue-500 to-indigo-500" :
              "from-emerald-400 to-teal-500";
            const Inner = (
              <Card
                className={`group h-full border-0 text-white shadow-md transition-all duration-300 animate-fade-in bg-gradient-to-br ${toneGradient} relative overflow-hidden ${
                  k.href ? "hover:-translate-y-0.5 hover:shadow-xl cursor-pointer" : "hover:-translate-y-0.5 hover:shadow-lg"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
                <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 h-28 w-28 rounded-full bg-white/10" />
                <CardContent className="relative p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30 flex items-center justify-center transition-transform group-hover:scale-110">
                      {loading ? <ShoppingBag className="h-4 w-4 text-white" /> : <k.icon className="h-4 w-4 text-white" />}
                    </div>
                    {k.href && (
                      <ArrowUpRight className="h-4 w-4 text-white/80 transition-all group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    )}
                  </div>
                  {loading ? (
                    <>
                      <Skeleton className="h-3 w-20 mb-2 bg-white/30" />
                      <Skeleton className="h-6 w-12 bg-white/30" />
                    </>
                  ) : (
                    <>
                      <div className="text-caption text-white/85">{k.label}</div>
                      <div className="text-h1 text-white mt-1 tabular-nums">{k.value}</div>
                      {k.sub && <div className="text-caption text-white/75 mt-1">{k.sub}</div>}
                    </>
                  )}
                </CardContent>
              </Card>
            );
            return k.href ? <Link key={i} to={k.href}>{Inner}</Link> : <div key={i}>{Inner}</div>;
          },
        )}
      </div>

      {/* REVENUE & ORDERS */}
      <Card className="border-neutral-6 overflow-hidden">
        <div aria-hidden className="h-1 w-full bg-gradient-to-r from-primary via-primary-light to-accent" />
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <CardTitle>Revenue & orders over time</CardTitle>
          </div>
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <TabsList className="bg-neutral-7">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revFill)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeseries}>
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary-light))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary-light))" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--neutral-7))" }} />
                <Bar dataKey="orders" fill="url(#barFill)" radius={[8, 8, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ORDERS PER DAY */}
      <Card className="border-neutral-6 overflow-hidden">
        <div aria-hidden className="h-1 w-full bg-gradient-to-r from-accent via-primary to-success" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <CardTitle>Orders per day · last 30 days</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ordersPerDay}>
              <defs>
                <linearGradient id="opdFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--neutral-7))" }} />
              <Bar dataKey="orders" fill="url(#opdFill)" radius={[6, 6, 0, 0]} name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* CATEGORIES DONUT + SIGNUPS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-neutral-6 overflow-hidden">
          <div aria-hidden className="h-1 w-full bg-gradient-to-r from-primary to-accent" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <CardTitle>Top 5 categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-neutral-3 text-body">No sales data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={topCategories} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3} stroke="hsl(var(--background))" strokeWidth={3}>
                    {topCategories.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-neutral-6 overflow-hidden">
          <div aria-hidden className="h-1 w-full bg-gradient-to-r from-accent to-primary-light" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <CardTitle>New signups · shoppers vs sellers (14d)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={signups}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="shoppers" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sellers" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
