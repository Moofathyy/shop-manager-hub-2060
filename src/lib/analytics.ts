import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval,
  eachWeekOfInterval, eachMonthOfInterval, subDays, differenceInCalendarMonths,
} from "date-fns";

export type Granularity = "daily" | "weekly" | "monthly";

export interface KPIs {
  gmv: number;
  netRevenue: number;
  aov: number;
  orderCount: number;
  totalShoppers: number;
  newShoppers: number;
  returningShoppers: number;
  totalSellers: number;
  newSellers: number;
  activeSellers: number;
  conversionRate: number;   // estimated
  cartAbandonment: number;  // estimated
  // deltas vs previous window of same length
  gmvDelta: number;
  ordersDelta: number;
  shoppersDelta: number;
}

function pctDelta(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

export async function fetchKPIs(from: Date, to: Date): Promise<KPIs> {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const windowDays = Math.max(1, Math.round((+to - +from) / 86400000));
  const prevFrom = subDays(from, windowDays).toISOString();
  const prevTo = fromISO;

  const [orders, prevOrders, refunds, profiles, sellers] = await Promise.all([
    supabase.from("orders").select("id, total, shopper_id, created_at").gte("created_at", fromISO).lte("created_at", toISO),
    supabase.from("orders").select("id, total, shopper_id").gte("created_at", prevFrom).lt("created_at", prevTo),
    supabase.from("refunds").select("amount, status, created_at").eq("status", "approved").gte("created_at", fromISO).lte("created_at", toISO),
    supabase.from("profiles").select("id, created_at"),
    supabase.from("seller_profiles").select("user_id, created_at, approval_status"),
  ]);

  const ordersList = orders.data ?? [];
  const prevList = prevOrders.data ?? [];
  const refundsList = refunds.data ?? [];

  const gmv = ordersList.reduce((s, o: any) => s + Number(o.total || 0), 0);
  const prevGmv = prevList.reduce((s, o: any) => s + Number(o.total || 0), 0);
  const refundTotal = refundsList.reduce((s, r: any) => s + Number(r.amount || 0), 0);
  const netRevenue = gmv - refundTotal;
  const orderCount = ordersList.length;
  const aov = orderCount > 0 ? gmv / orderCount : 0;

  const shopperIds = new Set(ordersList.map((o: any) => o.shopper_id));
  const prevShopperIds = new Set(prevList.map((o: any) => o.shopper_id));

  const allProfiles = profiles.data ?? [];
  const totalShoppers = allProfiles.length;
  const newShoppers = allProfiles.filter((p: any) => p.created_at >= fromISO && p.created_at <= toISO).length;
  const returningShoppers = [...shopperIds].filter((id) => {
    const p = allProfiles.find((x: any) => x.id === id);
    return p && p.created_at < fromISO;
  }).length;

  const allSellers = sellers.data ?? [];
  const totalSellers = allSellers.length;
  const newSellers = allSellers.filter((s: any) => s.created_at >= fromISO && s.created_at <= toISO).length;
  const activeSellerIds = new Set(ordersList.map((o: any) => (o as any).seller_id).filter(Boolean));
  const activeSellers = activeSellerIds.size || allSellers.filter((s: any) => s.approval_status === "approved").length;

  return {
    gmv, netRevenue, aov, orderCount,
    totalShoppers, newShoppers, returningShoppers,
    totalSellers, newSellers, activeSellers,
    conversionRate: 2.8,
    cartAbandonment: 68.4,
    gmvDelta: pctDelta(gmv, prevGmv),
    ordersDelta: pctDelta(orderCount, prevList.length),
    shoppersDelta: pctDelta(shopperIds.size, prevShopperIds.size),
  };
}

export async function fetchTimeSeries(from: Date, to: Date, granularity: Granularity) {
  const { data } = await supabase
    .from("orders")
    .select("total, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const buckets: Date[] =
    granularity === "daily" ? eachDayOfInterval({ start: from, end: to }) :
    granularity === "weekly" ? eachWeekOfInterval({ start: from, end: to }) :
    eachMonthOfInterval({ start: from, end: to });

  const startOf = granularity === "daily" ? startOfDay : granularity === "weekly" ? (d: Date) => startOfWeek(d) : startOfMonth;
  const labelFmt = granularity === "daily" ? "MMM d" : granularity === "weekly" ? "MMM d" : "MMM yyyy";

  const map = new Map<string, { revenue: number; orders: number }>();
  buckets.forEach((b) => map.set(b.toISOString(), { revenue: 0, orders: 0 }));

  (data ?? []).forEach((o: any) => {
    const key = startOf(new Date(o.created_at)).toISOString();
    const cur = map.get(key);
    if (cur) { cur.revenue += Number(o.total || 0); cur.orders += 1; }
  });

  return [...map.entries()].map(([k, v]) => ({
    label: format(new Date(k), labelFmt),
    revenue: Math.round(v.revenue * 100) / 100,
    orders: v.orders,
  }));
}

export async function fetchTopProducts(from: Date, to: Date, limit = 10) {
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, price, qty, orders!inner(created_at)")
    .gte("orders.created_at", from.toISOString())
    .lte("orders.created_at", to.toISOString());

  const totals = new Map<string, number>();
  (items ?? []).forEach((i: any) => {
    const rev = Number(i.price) * Number(i.qty);
    totals.set(i.product_id, (totals.get(i.product_id) ?? 0) + rev);
  });

  const ids = [...totals.keys()];
  if (ids.length === 0) return [];
  const { data: products } = await supabase.from("products").select("id, title").in("id", ids);
  const titleById = new Map((products ?? []).map((p: any) => [p.id, p.title]));

  return [...totals.entries()]
    .map(([id, revenue]) => ({ id, name: titleById.get(id) ?? "Unknown", revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function fetchTopSellers(from: Date, to: Date, limit = 10) {
  const { data } = await supabase
    .from("orders")
    .select("seller_id, total")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const totals = new Map<string, number>();
  (data ?? []).forEach((o: any) => {
    totals.set(o.seller_id, (totals.get(o.seller_id) ?? 0) + Number(o.total || 0));
  });

  const ids = [...totals.keys()];
  if (ids.length === 0) return [];
  const { data: sellers } = await supabase.from("seller_profiles").select("user_id, store_name").in("user_id", ids);
  const nameById = new Map((sellers ?? []).map((s: any) => [s.user_id, s.store_name]));

  return [...totals.entries()]
    .map(([id, revenue]) => ({ id, name: nameById.get(id) ?? "Unknown seller", revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function fetchTopCategories(from: Date, to: Date, limit = 8) {
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, price, qty, orders!inner(created_at)")
    .gte("orders.created_at", from.toISOString())
    .lte("orders.created_at", to.toISOString());

  const ids = [...new Set((items ?? []).map((i: any) => i.product_id))];
  if (ids.length === 0) return [];
  const { data: products } = await supabase.from("products").select("id, category_id").in("id", ids);
  const catByProduct = new Map((products ?? []).map((p: any) => [p.id, p.category_id]));

  const totals = new Map<string, number>();
  (items ?? []).forEach((i: any) => {
    const cat = catByProduct.get(i.product_id);
    if (!cat) return;
    totals.set(cat, (totals.get(cat) ?? 0) + Number(i.price) * Number(i.qty));
  });

  const catIds = [...totals.keys()];
  const { data: cats } = await supabase.from("categories").select("id, name").in("id", catIds);
  const nameById = new Map((cats ?? []).map((c: any) => [c.id, c.name]));

  return [...totals.entries()]
    .map(([id, value]) => ({ name: nameById.get(id) ?? "Uncategorized", value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function fetchGeo(from: Date, to: Date) {
  const { data: ord } = await supabase
    .from("orders")
    .select("shopper_id, total")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const ids = [...new Set((ord ?? []).map((o: any) => o.shopper_id))];
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id, country").in("id", ids);
  const countryById = new Map((profs ?? []).map((p: any) => [p.id, p.country ?? "Unknown"]));

  const totals = new Map<string, { revenue: number; orders: number }>();
  (ord ?? []).forEach((o: any) => {
    const c = countryById.get(o.shopper_id) ?? "Unknown";
    const cur = totals.get(c) ?? { revenue: 0, orders: 0 };
    cur.revenue += Number(o.total || 0);
    cur.orders += 1;
    totals.set(c, cur);
  });

  return [...totals.entries()]
    .map(([country, v]) => ({ country, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function fetchCohort(months = 6) {
  const { data: profiles } = await supabase.from("profiles").select("id, created_at");
  const { data: orders } = await supabase.from("orders").select("shopper_id, created_at");

  const monthKey = (d: Date) => format(startOfMonth(d), "yyyy-MM");
  const cohorts = new Map<string, Set<string>>();
  (profiles ?? []).forEach((p: any) => {
    const key = monthKey(new Date(p.created_at));
    if (!cohorts.has(key)) cohorts.set(key, new Set());
    cohorts.get(key)!.add(p.id);
  });

  const ordersByUser = new Map<string, Set<string>>();
  (orders ?? []).forEach((o: any) => {
    const m = monthKey(new Date(o.created_at));
    if (!ordersByUser.has(o.shopper_id)) ordersByUser.set(o.shopper_id, new Set());
    ordersByUser.get(o.shopper_id)!.add(m);
  });

  const cohortKeys = [...cohorts.keys()].sort().slice(-months);
  return cohortKeys.map((cohort) => {
    const users = [...cohorts.get(cohort)!];
    const size = users.length;
    const cohortDate = new Date(cohort + "-01");
    const row: { cohort: string; size: number; values: (number | null)[] } = { cohort, size, values: [] };
    for (let m = 0; m < months; m++) {
      const target = format(startOfMonth(new Date(cohortDate.getFullYear(), cohortDate.getMonth() + m, 1)), "yyyy-MM");
      const monthsSinceNow = differenceInCalendarMonths(new Date(), new Date(target + "-01"));
      if (monthsSinceNow < 0) { row.values.push(null); continue; }
      const active = users.filter((u) => ordersByUser.get(u)?.has(target)).length;
      row.values.push(size > 0 ? Math.round((active / size) * 1000) / 10 : 0);
    }
    return row;
  });
}

export async function fetchFunnel(from: Date, to: Date) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  const purchases = (orders ?? []).filter((o: any) => o.status !== "cancelled").length;
  const checkout = Math.round(purchases / 0.35);     // ~35% checkout→purchase
  const addToCart = Math.round(checkout / 0.45);     // ~45% cart→checkout
  const productViews = Math.round(addToCart / 0.20); // ~20% view→cart
  const visits = Math.round(productViews / 0.55);    // ~55% visit→view

  return [
    { stage: "Visits", value: visits, estimated: true },
    { stage: "Product Views", value: productViews, estimated: true },
    { stage: "Add to Cart", value: addToCart, estimated: true },
    { stage: "Checkout", value: checkout, estimated: true },
    { stage: "Purchase", value: purchases, estimated: false },
  ];
}

export async function runCustomReport(
  from: Date, to: Date,
  dimension: "seller" | "category" | "country" | "product" | "day",
  metrics: string[]
) {
  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  const [orders, items, refunds, profiles] = await Promise.all([
    supabase.from("orders").select("id, seller_id, shopper_id, total, created_at").gte("created_at", fromISO).lte("created_at", toISO),
    dimension === "category" || dimension === "product"
      ? supabase.from("order_items").select("product_id, price, qty, order_id, orders!inner(created_at, seller_id, shopper_id)").gte("orders.created_at", fromISO).lte("orders.created_at", toISO)
      : Promise.resolve({ data: [] as any[] }),
    metrics.some((m) => m.startsWith("refund")) ? supabase.from("refunds").select("amount, status, order_id, created_at").gte("created_at", fromISO).lte("created_at", toISO) : Promise.resolve({ data: [] as any[] }),
    dimension === "country" ? supabase.from("profiles").select("id, country") : Promise.resolve({ data: [] as any[] }),
  ]);

  const oList = orders.data ?? [];
  const iList = (items as any).data ?? [];
  const rList = (refunds as any).data ?? [];
  const pList = (profiles as any).data ?? [];
  const countryById = new Map(pList.map((p: any) => [p.id, p.country ?? "Unknown"]));

  const groups = new Map<string, { gmv: number; orders: number; refundAmount: number; refundCount: number }>();
  const bump = (key: string, fields: Partial<{ gmv: number; orders: number; refundAmount: number; refundCount: number }>) => {
    const cur = groups.get(key) ?? { gmv: 0, orders: 0, refundAmount: 0, refundCount: 0 };
    cur.gmv += fields.gmv ?? 0;
    cur.orders += fields.orders ?? 0;
    cur.refundAmount += fields.refundAmount ?? 0;
    cur.refundCount += fields.refundCount ?? 0;
    groups.set(key, cur);
  };

  if (dimension === "seller") {
    oList.forEach((o: any) => bump(o.seller_id, { gmv: Number(o.total || 0), orders: 1 }));
  } else if (dimension === "country") {
    oList.forEach((o: any) => bump((countryById.get(o.shopper_id) as string) ?? "Unknown", { gmv: Number(o.total || 0), orders: 1 }));
  } else if (dimension === "day") {
    oList.forEach((o: any) => bump(format(new Date(o.created_at), "yyyy-MM-dd"), { gmv: Number(o.total || 0), orders: 1 }));
  } else if (dimension === "product") {
    iList.forEach((i: any) => bump(i.product_id, { gmv: Number(i.price) * Number(i.qty), orders: 1 }));
  } else if (dimension === "category") {
    // need product->category map
    const productIds = [...new Set(iList.map((i: any) => i.product_id as string))] as string[];
    const { data: prods } = await supabase.from("products").select("id, category_id").in("id", productIds);
    const catBy = new Map<string, string>((prods ?? []).map((p: any) => [p.id, p.category_id]));
    iList.forEach((i: any) => {
      const cat = catBy.get(i.product_id) ?? "uncategorized";
      bump(cat, { gmv: Number(i.price) * Number(i.qty), orders: 1 });
    });
  }

  rList.forEach((r: any) => {
    const o = oList.find((x: any) => x.id === r.order_id);
    if (!o) return;
    let key: string | undefined;
    if (dimension === "seller") key = o.seller_id;
    else if (dimension === "country") key = (countryById.get(o.shopper_id) as string) ?? "Unknown";
    else if (dimension === "day") key = format(new Date(o.created_at), "yyyy-MM-dd");
    if (key && groups.has(key)) {
      const cur = groups.get(key)!;
      cur.refundAmount += Number(r.amount || 0);
      cur.refundCount += 1;
    }
  });

  // resolve names
  let labelMap = new Map<string, string>();
  if (dimension === "seller") {
    const ids = [...groups.keys()];
    const { data } = await supabase.from("seller_profiles").select("user_id, store_name").in("user_id", ids);
    labelMap = new Map((data ?? []).map((s: any) => [s.user_id, s.store_name]));
  } else if (dimension === "product") {
    const ids = [...groups.keys()];
    const { data } = await supabase.from("products").select("id, title").in("id", ids);
    labelMap = new Map((data ?? []).map((p: any) => [p.id, p.title]));
  } else if (dimension === "category") {
    const ids = [...groups.keys()].filter((x) => x !== "uncategorized");
    const { data } = await supabase.from("categories").select("id, name").in("id", ids);
    labelMap = new Map((data ?? []).map((c: any) => [c.id, c.name]));
  }

  return [...groups.entries()]
    .map(([key, v]) => {
      const row: Record<string, any> = { [dimension]: labelMap.get(key) ?? key };
      if (metrics.includes("gmv")) row.gmv = Math.round(v.gmv * 100) / 100;
      if (metrics.includes("orders")) row.orders = v.orders;
      if (metrics.includes("aov")) row.aov = v.orders ? Math.round((v.gmv / v.orders) * 100) / 100 : 0;
      if (metrics.includes("refund_amount")) row.refund_amount = Math.round(v.refundAmount * 100) / 100;
      if (metrics.includes("refund_count")) row.refund_count = v.refundCount;
      return row;
    })
    .sort((a, b) => (b.gmv ?? b.orders ?? 0) - (a.gmv ?? a.orders ?? 0));
}
