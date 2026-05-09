import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ShoppingBag, DollarSign, ShieldCheck, Package, TrendingUp, Sparkles } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface Kpi { label: string; value: string; icon: React.ElementType; gradient: string; iconBg: string; }

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [revenue, setRevenue] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [signups, setSignups] = useState<{ date: string; shoppers: number; sellers: number }[]>([]);

  useEffect(() => {
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const sinceToday = new Date(); sinceToday.setHours(0,0,0,0);
      const sinceWeek = new Date(Date.now() - 7 * 86400000);

      const [ordersAll, profilesAll, sellersAll, productsPending, merchantsPending] = await Promise.all([
        supabase.from("orders").select("total, created_at, status"),
        supabase.from("profiles").select("id, last_login, created_at"),
        supabase.from("seller_profiles").select("user_id, approval_status, created_at"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("merchant_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const orders = ordersAll.data ?? [];
      const profiles = profilesAll.data ?? [];
      const sellers = sellersAll.data ?? [];

      const gmvToday = orders.filter((o) => new Date(o.created_at) >= sinceToday).reduce((s, o) => s + Number(o.total), 0);
      const gmvWeek = orders.filter((o) => new Date(o.created_at) >= sinceWeek).reduce((s, o) => s + Number(o.total), 0);
      const activeShoppers = profiles.filter((p) => p.last_login && new Date(p.last_login) >= new Date(since30)).length || profiles.length;
      const activeSellers = sellers.filter((s) => s.approval_status === "approved").length;

      setKpis([
        { label: "GMV (Today)", value: `$${gmvToday.toFixed(0)}`, icon: DollarSign, gradient: "from-violet-500/15 via-fuchsia-500/10 to-transparent", iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500" },
        { label: "GMV (7 days)", value: `$${gmvWeek.toFixed(0)}`, icon: TrendingUp, gradient: "from-emerald-500/15 via-teal-500/10 to-transparent", iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500" },
        { label: "Active Shoppers", value: String(activeShoppers), icon: Users, gradient: "from-sky-500/15 via-blue-500/10 to-transparent", iconBg: "bg-gradient-to-br from-sky-500 to-blue-600" },
        { label: "Active Sellers", value: String(activeSellers), icon: Store, gradient: "from-amber-500/15 via-orange-500/10 to-transparent", iconBg: "bg-gradient-to-br from-amber-500 to-orange-500" },
        { label: "Pending Products", value: String(productsPending.count ?? 0), icon: Package, gradient: "from-pink-500/15 via-rose-500/10 to-transparent", iconBg: "bg-gradient-to-br from-pink-500 to-rose-500" },
        { label: "Pending Merchants", value: String(merchantsPending.count ?? 0), icon: ShieldCheck, gradient: "from-indigo-500/15 via-purple-500/10 to-transparent", iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600" },
      ]);

      // Revenue / orders over last 14 days
      const days: { date: string; revenue: number; orders: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const dayOrders = orders.filter((o) => o.created_at.slice(0, 10) === key);
        days.push({
          date: key.slice(5),
          revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
          orders: dayOrders.length,
        });
      }
      setRevenue(days);

      // Signups over last 14 days (shoppers vs sellers)
      const sgn: { date: string; shoppers: number; sellers: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        sgn.push({
          date: key.slice(5),
          shoppers: profiles.filter((p) => p.created_at.slice(0,10) === key).length,
          sellers: sellers.filter((s) => s.created_at.slice(0,10) === key).length,
        });
      }
      setSignups(sgn);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-caption font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Live overview
            </div>
            <h1 className="text-display mt-3">Welcome back 👋</h1>
            <p className="text-body text-white/80 mt-1">A real-time pulse of your marketplace performance.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
            <TrendingUp className="h-5 w-5" />
            <div>
              <div className="text-micro text-white/70 uppercase tracking-wide">Today</div>
              <div className="text-h3 font-semibold">{loading ? "—" : kpis[0]?.value}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {(loading ? Array.from({ length: 6 }).map((_, i) => ({ _i: i } as any)) : kpis).map((k: any, i: number) => (
          <Card key={i} className={`relative overflow-hidden border-neutral-6 hover:shadow-lg transition-all hover:-translate-y-0.5 ${!loading ? `bg-gradient-to-br ${k.gradient}` : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                {loading ? (
                  <Skeleton className="h-10 w-10 rounded-xl" />
                ) : (
                  <div className={`h-10 w-10 rounded-xl ${k.iconBg} text-white flex items-center justify-center shadow-md`}>
                    <k.icon className="h-5 w-5" />
                  </div>
                )}
              </div>
              {loading ? (
                <>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-7 w-16" />
                </>
              ) : (
                <>
                  <div className="text-caption text-neutral-2 font-medium">{k.label}</div>
                  <div className="text-h1 text-neutral-1 mt-1 font-bold tracking-tight">{k.value}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-neutral-6 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
              Revenue (last 14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(280 90% 60%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(280 90% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(280 90% 55%)" strokeWidth={3} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-neutral-6 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              Orders per day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(190 90% 55%)" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="orders" fill="url(#barGrad)" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-neutral-6 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-sky-500 to-amber-500" />
            New signups: shoppers vs sellers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={signups}>
              <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
              <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
              <Legend />
              <Line type="monotone" dataKey="shoppers" stroke="hsl(210 100% 55%)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="sellers" stroke="hsl(35 95% 55%)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
