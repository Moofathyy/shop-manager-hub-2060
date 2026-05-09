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
        { label: "GMV (Today)", value: `$${gmvToday.toFixed(0)}`, icon: DollarSign },
        { label: "GMV (7 days)", value: `$${gmvWeek.toFixed(0)}`, icon: DollarSign },
        { label: "Active Shoppers", value: String(activeShoppers), icon: Users },
        { label: "Active Sellers", value: String(activeSellers), icon: Store },
        { label: "Pending Products", value: String(productsPending.count ?? 0), icon: Package },
        { label: "Pending Merchants", value: String(merchantsPending.count ?? 0), icon: ShieldCheck },
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
      <div>
        <h1 className="text-display text-neutral-1">Overview</h1>
        <p className="text-body text-neutral-2 mt-1">Real-time snapshot of your platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {(loading ? Array.from({ length: 6 }).map((_, i) => ({ label: "", value: "", icon: ShoppingBag, _i: i })) : kpis).map((k, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-input bg-primary-bg text-primary flex items-center justify-center">
                  <k.icon className="h-4 w-4" />
                </div>
              </div>
              {loading ? (
                <>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-7 w-16" />
                </>
              ) : (
                <>
                  <div className="text-caption text-neutral-2">{k.label}</div>
                  <div className="text-h1 text-neutral-1 mt-1">{k.value}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenue}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue}>
                <CartesianGrid stroke="hsl(var(--neutral-6))" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--neutral-4))" fontSize={12} />
                <YAxis stroke="hsl(var(--neutral-4))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--neutral-6))" }} />
                <Bar dataKey="orders" fill="hsl(var(--primary-light))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New signups: shoppers vs sellers</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
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
  );
}
