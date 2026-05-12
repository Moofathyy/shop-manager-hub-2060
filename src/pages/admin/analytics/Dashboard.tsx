import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Store, Percent, ShoppingCart,
} from "lucide-react";
import { subDays } from "date-fns";
import {
  fetchKPIs, fetchTimeSeries, fetchTopProducts, fetchTopSellers,
  fetchTopCategories, fetchGeo, fetchCohort, fetchFunnel,
  type KPIs, type Granularity,
} from "@/lib/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info, var(--primary)))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];

const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function KpiCard({ icon: Icon, label, value, delta, sub }: { icon: any; label: string; value: string; delta?: number; sub?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-caption text-neutral-3">{label}</span>
          <div className="h-8 w-8 rounded-input bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="text-h2 text-neutral-1 font-bold">{value}</div>
        <div className="flex items-center gap-2 text-caption">
          {delta !== undefined && (
            <span className={`flex items-center gap-1 ${positive ? "text-success" : "text-destructive-foreground"}`}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {fmtPct(delta)}
            </span>
          )}
          {sub && <span className="text-neutral-4">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [topCats, setTopCats] = useState<any[]>([]);
  const [geo, setGeo] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const to = new Date();
  const from = subDays(to, 30);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [k, p, s, c, g, ch, fn] = await Promise.all([
        fetchKPIs(from, to),
        fetchTopProducts(from, to),
        fetchTopSellers(from, to),
        fetchTopCategories(from, to),
        fetchGeo(from, to),
        fetchCohort(6),
        fetchFunnel(from, to),
      ]);
      setKpis(k); setTopProducts(p); setTopSellers(s); setTopCats(c); setGeo(g); setCohort(ch); setFunnel(fn);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchTimeSeries(from, to, granularity).then(setSeries);
  }, [granularity]);

  if (loading || !kpis) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;
  }

  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={DollarSign} label="GMV" value={fmtCurrency(kpis.gmv)} delta={kpis.gmvDelta} sub="vs prev 30d" />
        <KpiCard icon={DollarSign} label="Net Revenue" value={fmtCurrency(kpis.netRevenue)} sub="GMV − refunds" />
        <KpiCard icon={ShoppingBag} label="AOV" value={fmtCurrency(kpis.aov)} sub={`${kpis.orderCount} orders`} />
        <KpiCard icon={Users} label="Shoppers" value={kpis.totalShoppers.toLocaleString()} delta={kpis.shoppersDelta} sub={`${kpis.newShoppers} new`} />
        <KpiCard icon={Store} label="Sellers" value={kpis.totalSellers.toLocaleString()} sub={`${kpis.activeSellers} active`} />
        <KpiCard icon={Percent} label="Conv. Rate" value={`${kpis.conversionRate}%`} sub="estimated" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={ShoppingCart} label="Cart Abandonment" value={`${kpis.cartAbandonment}%`} sub="estimated" />
        <KpiCard icon={Users} label="New shoppers" value={kpis.newShoppers.toLocaleString()} sub="last 30d" />
        <KpiCard icon={Users} label="Returning" value={kpis.returningShoppers.toLocaleString()} sub="purchased again" />
        <KpiCard icon={Store} label="New sellers" value={kpis.newSellers.toLocaleString()} sub="last 30d" />
        <KpiCard icon={ShoppingBag} label="Orders" value={kpis.orderCount.toLocaleString()} delta={kpis.ordersDelta} sub="vs prev 30d" />
        <KpiCard icon={DollarSign} label="Refunded" value={fmtCurrency(kpis.gmv - kpis.netRevenue)} sub="approved refunds" />
      </div>

      {/* Time series */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-h3">Revenue & orders over time</h3>
            <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="hsl(var(--primary))" name="Orders" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="text-h3">Top 10 products by revenue</h3>
          {topProducts.length === 0 ? <div className="text-neutral-4 text-caption py-6 text-center">No data</div> :
            topProducts.map((p, i) => {
              const max = topProducts[0].revenue || 1;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-body">
                    <span className="truncate">{i + 1}. {p.name}</span>
                    <span className="font-semibold">{fmtCurrency(p.revenue)}</span>
                  </div>
                  <div className="h-2 bg-neutral-7 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(p.revenue / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
        </CardContent></Card>

        {/* Top sellers */}
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="text-h3">Top 10 sellers by revenue</h3>
          {topSellers.length === 0 ? <div className="text-neutral-4 text-caption py-6 text-center">No data</div> :
            topSellers.map((s, i) => {
              const max = topSellers[0].revenue || 1;
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex justify-between text-body">
                    <span className="truncate">{i + 1}. {s.name}</span>
                    <span className="font-semibold">{fmtCurrency(s.revenue)}</span>
                  </div>
                  <div className="h-2 bg-neutral-7 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${(s.revenue / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top categories */}
        <Card><CardContent className="p-6">
          <h3 className="text-h3 mb-3">Top categories by sales</h3>
          {topCats.length === 0 ? <div className="text-neutral-4 text-caption py-12 text-center">No data</div> :
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={topCats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => e.name}>
                  {topCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          }
        </CardContent></Card>

        {/* Geographic */}
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="text-h3">Geographic sales (by country)</h3>
          {geo.length === 0 ? <div className="text-neutral-4 text-caption py-12 text-center">No data</div> :
            geo.slice(0, 8).map((g, i) => {
              const max = geo[0].revenue || 1;
              return (
                <div key={g.country} className="space-y-1">
                  <div className="flex justify-between text-body">
                    <span>{i + 1}. {g.country}</span>
                    <span className="font-semibold">{fmtCurrency(g.revenue)} <span className="text-neutral-4 text-caption">· {g.orders} orders</span></span>
                  </div>
                  <div className="h-2 bg-neutral-7 rounded-full overflow-hidden">
                    <div className="h-full bg-warning rounded-full" style={{ width: `${(g.revenue / max) * 100}%` }} />
                  </div>
                </div>
              );
            })
          }
        </CardContent></Card>
      </div>

      {/* Cohort */}
      <Card><CardContent className="p-6 space-y-3">
        <h3 className="text-h3">Cohort retention (% of shoppers who ordered in month N)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-caption">
            <thead>
              <tr className="text-neutral-3">
                <th className="text-left py-2 px-2">Cohort</th>
                <th className="text-right py-2 px-2">Size</th>
                {[0,1,2,3,4,5].map((m) => <th key={m} className="text-right py-2 px-2">M{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {cohort.map((c) => (
                <tr key={c.cohort} className="border-t border-neutral-6">
                  <td className="py-2 px-2 font-medium">{c.cohort}</td>
                  <td className="py-2 px-2 text-right text-neutral-3">{c.size}</td>
                  {c.values.map((v: number | null, i: number) => (
                    <td key={i} className="py-2 px-2 text-right">
                      {v === null ? <span className="text-neutral-5">—</span> :
                        <span className="inline-block px-2 py-0.5 rounded-input" style={{
                          backgroundColor: `hsl(var(--primary) / ${Math.min(v / 100, 1) * 0.5 + 0.05})`,
                          color: v > 50 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                        }}>{v}%</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
              {cohort.length === 0 && <tr><td colSpan={8} className="text-center text-neutral-4 py-8">No cohort data</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {/* Funnel */}
      <Card><CardContent className="p-6 space-y-3">
        <h3 className="text-h3">Conversion funnel <span className="text-caption text-neutral-4 font-normal">(upper stages estimated)</span></h3>
        <div className="space-y-2">
          {funnel.map((stage, i) => {
            const width = (stage.value / funnelMax) * 100;
            const conv = i > 0 ? (stage.value / funnel[i - 1].value) * 100 : 100;
            return (
              <div key={stage.stage} className="space-y-1">
                <div className="flex justify-between text-body">
                  <span>{stage.stage}{stage.estimated && <span className="text-caption text-neutral-4 ml-2">est.</span>}</span>
                  <span className="font-semibold">{stage.value.toLocaleString()} {i > 0 && <span className="text-caption text-neutral-4">({conv.toFixed(1)}%)</span>}</span>
                </div>
                <div className="h-8 bg-neutral-7 rounded-input overflow-hidden">
                  <div className="h-full bg-primary/80 rounded-input flex items-center px-3 text-primary-foreground text-caption" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent></Card>
    </div>
  );
}
