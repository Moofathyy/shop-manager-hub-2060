import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString();

const FIRST = ["Aya","Omar","Lina","Youssef","Salma","Karim","Nour","Hassan","Mona","Tariq","Sara","Adam","Mariam","Khaled","Layla","Ziad","Hana","Bassel","Reem","Faris"];
const LAST = ["Ahmed","Hassan","Mostafa","Fawzy","Salah","Nasr","Khalil","Said","Adel","Rashid","Mahmoud","Younes","Saleh","Aziz","Ibrahim"];
const COUNTRIES = ["EG","SA","AE","JO","KW","QA","MA","TN","LB","OM"];
const STORE_NAMES = ["Cairo Crafts","Nile Tech","Desert Bloom","Pyramid Goods","Oasis Wear","Pharaoh Co","Souk Modern","Atlas Home","Sahara Style","Bazaar Plus","Medina Market","Casbah Decor"];
const PRODUCT_NAMES = ["Wireless Earbuds","Smart Watch","Cotton T-Shirt","Leather Wallet","Yoga Mat","Coffee Maker","LED Desk Lamp","Bluetooth Speaker","Backpack","Sneakers","Sunglasses","Notebook","Power Bank","Water Bottle","Hair Dryer","Cookware Set","Kids Toy Car","Skincare Kit","Perfume","Phone Case"];
const CATEGORY_NAMES = ["Electronics","Fashion","Home & Kitchen","Beauty","Sports","Toys","Books","Grocery"];

async function ensureAuthUser(email: string, meta: Record<string, unknown>) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list?.users?.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Password@123",
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw error;
  return data.user!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const log: string[] = [];

    // 1) Categories
    const catMap: Record<string, string> = {};
    for (const name of CATEGORY_NAMES) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: existing } = await admin.from("categories").select("id").eq("slug", slug).maybeSingle();
      if (existing) { catMap[name] = existing.id; continue; }
      const { data } = await admin.from("categories").insert({ name, slug, sort_order: 0 }).select("id").single();
      catMap[name] = data!.id;
    }
    log.push(`categories: ${Object.keys(catMap).length}`);

    // 2) Users (shoppers + sellers)
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailToId = new Map<string, string>();
    for (const u of existingUsers?.users ?? []) emailToId.set(u.email!, u.id);

    const shopperIds: string[] = [];
    const sellerIds: string[] = [];

    for (let i = 0; i < 25; i++) {
      const email = `shopper${i + 1}@ejada.test`;
      let id = emailToId.get(email);
      if (!id) {
        id = await ensureAuthUser(email, { full_name: `${rand(FIRST)} ${rand(LAST)}` });
      }
      shopperIds.push(id);
    }
    for (let i = 0; i < 12; i++) {
      const email = `seller${i + 1}@ejada.test`;
      let id = emailToId.get(email);
      if (!id) {
        id = await ensureAuthUser(email, { full_name: `${rand(FIRST)} ${rand(LAST)}` });
      }
      sellerIds.push(id);
    }
    log.push(`shoppers: ${shopperIds.length}, sellers: ${sellerIds.length}`);

    // 3) Profiles update (country, status)
    for (const id of [...shopperIds, ...sellerIds]) {
      await admin.from("profiles").update({
        country: rand(COUNTRIES),
        status: Math.random() < 0.9 ? "active" : "suspended",
        full_name: `${rand(FIRST)} ${rand(LAST)}`,
        phone: `+20${randInt(1000000000, 1999999999)}`,
        last_login: daysAgo(randInt(0, 30)),
      }).eq("id", id);
    }

    // 4) Roles
    for (const id of sellerIds) {
      await admin.from("user_roles").upsert({ user_id: id, role: "seller" }, { onConflict: "user_id,role" });
    }

    // 5) Seller profiles
    for (let i = 0; i < sellerIds.length; i++) {
      const id = sellerIds[i];
      const name = STORE_NAMES[i % STORE_NAMES.length];
      const status = i < 8 ? "approved" : i < 10 ? "pending" : "rejected";
      const { data: existing } = await admin.from("seller_profiles").select("user_id").eq("user_id", id).maybeSingle();
      const payload = {
        user_id: id,
        store_name: name,
        business_name: `${name} LLC`,
        tax_id: `TAX${randInt(100000, 999999)}`,
        address: `${randInt(1, 999)} Market St, ${rand(["Cairo","Riyadh","Dubai","Amman"])}`,
        approval_status: status as "approved" | "pending" | "rejected",
        kyc_status: status === "approved" ? "verified" : status === "pending" ? "submitted" : "rejected",
        rating: status === "approved" ? Number((3 + Math.random() * 2).toFixed(1)) : null,
        commission_rate: 10 + randInt(0, 5),
        total_revenue: status === "approved" ? randInt(5000, 80000) : 0,
        payout_balance: status === "approved" ? randInt(100, 5000) : 0,
      };
      if (existing) await admin.from("seller_profiles").update(payload).eq("user_id", id);
      else await admin.from("seller_profiles").insert(payload);
    }

    // 6) Merchant applications
    for (const id of sellerIds) {
      const { data: existing } = await admin.from("merchant_applications").select("id").eq("seller_id", id).maybeSingle();
      if (existing) continue;
      const status = rand(["pending","approved","approved","rejected"]);
      await admin.from("merchant_applications").insert({
        seller_id: id,
        business_type: rand(["LLC","Sole Proprietor","Corporation","Partnership"]),
        status,
        documents: [{ type: "trade_license", url: "https://example.com/doc.pdf" }],
        decided_at: status !== "pending" ? daysAgo(randInt(1, 20)) : null,
      });
    }

    // 7) Products
    const approvedSellerIds = sellerIds.slice(0, 8);
    const productIds: { id: string; price: number; seller_id: string }[] = [];
    const catIds = Object.values(catMap);
    for (let i = 0; i < 60; i++) {
      const seller_id = rand(approvedSellerIds);
      const price = randInt(15, 500);
      const status = rand(["approved","approved","approved","pending","rejected"]);
      const { data } = await admin.from("products").insert({
        seller_id,
        category_id: rand(catIds),
        title: `${rand(PRODUCT_NAMES)} ${randInt(100, 999)}`,
        description: "High quality product, fast shipping.",
        sku: `SKU-${randInt(10000, 99999)}`,
        price,
        stock: randInt(0, 200),
        status,
        images: [{ url: "https://placehold.co/400" }],
        rating: status === "approved" ? Number((3 + Math.random() * 2).toFixed(1)) : null,
        sales_count: randInt(0, 300),
      }).select("id").single();
      if (data) productIds.push({ id: data.id, price, seller_id });
    }
    log.push(`products: ${productIds.length}`);

    // 8) Orders + items
    const orderIds: { id: string; shopper_id: string; seller_id: string; total: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const shopper_id = rand(shopperIds);
      const items = Array.from({ length: randInt(1, 4) }, () => rand(productIds));
      const subtotal = items.reduce((s, p) => s + p.price, 0);
      const shipping = randInt(5, 25);
      const discount = Math.random() < 0.3 ? randInt(5, 30) : 0;
      const total = subtotal + shipping - discount;
      const status = rand(["pending","paid","shipped","delivered","delivered","delivered","cancelled","refunded"]);
      const seller_id = items[0].seller_id;
      const { data: order } = await admin.from("orders").insert({
        shopper_id,
        seller_id,
        subtotal, shipping, discount, total,
        status,
        payment_status: status === "delivered" || status === "shipped" || status === "paid" ? "paid" : status === "refunded" ? "refunded" : "pending",
        shipping_status: status === "delivered" ? "delivered" : status === "shipped" ? "in_transit" : "not_shipped",
        payment_method: rand(["card","cod","wallet"]),
        carrier: rand(["DHL","Aramex","FedEx"]),
        tracking_number: `TRK${randInt(100000, 999999)}`,
        shipping_address: { line1: `${randInt(1, 999)} Main St`, city: rand(["Cairo","Riyadh","Dubai"]), country: rand(COUNTRIES) },
        created_at: daysAgo(randInt(0, 60)),
      }).select("id").single();
      if (!order) continue;
      orderIds.push({ id: order.id, shopper_id, seller_id, total });
      for (const it of items) {
        await admin.from("order_items").insert({ order_id: order.id, product_id: it.id, qty: randInt(1, 3), price: it.price });
      }
    }
    log.push(`orders: ${orderIds.length}`);

    // 9) Transactions
    for (const o of orderIds.slice(0, 60)) {
      await admin.from("transactions").insert({
        order_id: o.id,
        user_id: o.shopper_id,
        amount: o.total,
        currency: "USD",
        type: "payment",
        status: rand(["completed","completed","completed","pending","failed"]),
        provider: rand(["stripe","paymob","fawry"]),
        provider_ref: `ch_${randInt(100000, 999999)}`,
        flagged: Math.random() < 0.05,
      });
    }

    // 10) Payouts
    for (const sid of approvedSellerIds) {
      for (let i = 0; i < 3; i++) {
        await admin.from("payouts").insert({
          seller_id: sid,
          amount: randInt(200, 4000),
          status: rand(["pending","processed","processed","on_hold"]),
          scheduled_for: daysAgo(-randInt(1, 14)).slice(0, 10),
          processed_at: Math.random() < 0.5 ? daysAgo(randInt(0, 20)) : null,
        });
      }
    }

    // 11) Refunds
    for (let i = 0; i < 8; i++) {
      const o = rand(orderIds);
      await admin.from("refunds").insert({
        order_id: o.id,
        requested_by: o.shopper_id,
        amount: Math.round(o.total * 0.5),
        reason: rand(["Item damaged","Wrong item","Late delivery","Changed mind"]),
        status: rand(["pending","approved","rejected"]),
      });
    }

    // 12) Reviews
    for (let i = 0; i < 50; i++) {
      const p = rand(productIds);
      await admin.from("reviews").insert({
        reviewer_id: rand(shopperIds),
        target_type: "product",
        target_id: p.id,
        rating: randInt(2, 5),
        content: rand(["Great quality!","Fast delivery.","As described.","Would buy again.","Not as expected.","Excellent value."]),
        status: rand(["published","published","published","flagged","removed"]),
      });
    }

    // 13) Tickets + messages
    for (let i = 0; i < 20; i++) {
      const uid = rand([...shopperIds, ...sellerIds]);
      const { data: t } = await admin.from("tickets").insert({
        user_id: uid,
        subject: rand(["Order not received","Refund question","Account issue","Product damaged","Shipping delay"]),
        type: rand(["order","payment","account","other"]),
        priority: rand(["low","medium","high","urgent"]),
        status: rand(["open","in_progress","resolved","closed"]),
      }).select("id").single();
      if (t) {
        await admin.from("ticket_messages").insert({
          ticket_id: t.id, author_id: uid, body: "Hi, I need help with my recent order.", is_internal: false,
        });
      }
    }

    // 14) Disputes
    for (let i = 0; i < 6; i++) {
      const o = rand(orderIds);
      await admin.from("disputes").insert({
        order_id: o.id,
        shopper_id: o.shopper_id,
        seller_id: o.seller_id,
        reason: rand(["Item not as described","Never delivered","Damaged"]),
        status: rand(["open","under_review","resolved","closed"]),
      });
    }

    // 15) Banners
    for (let i = 0; i < 5; i++) {
      await admin.from("banners").insert({
        title: `Promo ${i + 1}`,
        link_url: "/sale",
        image_desktop_url: "https://placehold.co/1600x400",
        image_mobile_url: "https://placehold.co/800x400",
        active: i < 3,
        sort_order: i,
        starts_at: daysAgo(randInt(1, 10)),
        ends_at: daysAgo(-randInt(5, 30)),
      });
    }

    // 16) Coupons
    for (let i = 0; i < 8; i++) {
      await admin.from("coupons").insert({
        code: `SAVE${randInt(10, 50)}`,
        description: "Storewide discount",
        discount_type: rand(["percent","fixed"]),
        discount_value: randInt(5, 30),
        min_order_value: randInt(0, 100),
        max_uses: 1000,
        used_count: randInt(0, 500),
        status: rand(["active","active","expired","disabled"]),
        expires_at: daysAgo(-randInt(5, 60)),
      });
    }

    // 17) Flash sales
    for (let i = 0; i < 4; i++) {
      await admin.from("flash_sales").insert({
        title: `Flash Sale ${i + 1}`,
        description: "Limited time offer",
        discount_percentage: randInt(10, 50),
        product_ids: productIds.slice(i * 5, i * 5 + 5).map((p) => p.id),
        starts_at: daysAgo(randInt(0, 5)),
        ends_at: daysAgo(-randInt(1, 10)),
        status: rand(["scheduled","active","ended"]),
      });
    }

    // 18) Notifications
    for (let i = 0; i < 6; i++) {
      await admin.from("notifications").insert({
        channel: rand(["email","sms","push"]),
        audience: rand(["all","shoppers","sellers"]),
        subject: `Update ${i + 1}`,
        body: "Check out our latest features and offers!",
        status: rand(["draft","scheduled","sent"]),
        recipient_count: randInt(100, 5000),
        open_count: randInt(50, 2000),
        click_count: randInt(10, 500),
        sent_at: daysAgo(randInt(1, 20)),
      });
    }

    // 19) Shipping carriers
    const carrierIds: string[] = [];
    for (const c of [["DHL","dhl"],["Aramex","aramex"],["FedEx","fedex"]]) {
      const { data: existing } = await admin.from("shipping_carriers").select("id").eq("code", c[1]).maybeSingle();
      if (existing) { carrierIds.push(existing.id); continue; }
      const { data } = await admin.from("shipping_carriers").insert({
        name: c[0], code: c[1], active: true, regions: ["EG","SA","AE"], default_for_regions: [],
      }).select("id").single();
      if (data) carrierIds.push(data.id);
    }

    // 20) Delivery zones
    const zoneIds: string[] = [];
    for (const z of [["GCC", ["SA","AE","KW","QA","OM"]], ["North Africa", ["EG","MA","TN"]], ["Levant", ["JO","LB"]]]) {
      const { data: existing } = await admin.from("delivery_zones").select("id").eq("name", z[0] as string).maybeSingle();
      if (existing) { zoneIds.push(existing.id); continue; }
      const { data } = await admin.from("delivery_zones").insert({
        name: z[0] as string, countries: z[1] as string[], active: true,
      }).select("id").single();
      if (data) zoneIds.push(data.id);
    }

    // 21) Shipments
    for (const o of orderIds.slice(0, 50)) {
      const { data: s } = await admin.from("shipments").insert({
        order_id: o.id,
        carrier_id: rand(carrierIds),
        zone_id: rand(zoneIds),
        tracking_number: `SHP${randInt(100000, 999999)}`,
        cost: randInt(5, 30),
        status: rand(["pending","in_transit","delivered","delivered","failed"]),
        estimated_delivery: daysAgo(-randInt(1, 7)),
        delivered_at: Math.random() < 0.5 ? daysAgo(randInt(0, 10)) : null,
      }).select("id").single();
      if (s) {
        await admin.from("shipment_events").insert({
          shipment_id: s.id, status: "in_transit", location: rand(["Cairo Hub","Dubai Hub","Riyadh Hub"]), note: "Package picked up",
        });
      }
    }

    // 22) Return requests
    for (let i = 0; i < 8; i++) {
      const o = rand(orderIds);
      await admin.from("return_requests").insert({
        order_id: o.id,
        shopper_id: o.shopper_id,
        seller_id: o.seller_id,
        reason: rand(["Defective","Wrong size","Not as described"]),
        status: rand(["requested","approved","received","refunded","rejected"]),
        refund_amount: Math.round(o.total * 0.5),
      });
    }

    // 23) Loyalty
    for (const id of shopperIds.slice(0, 15)) {
      const { data: existing } = await admin.from("loyalty_points").select("user_id").eq("user_id", id).maybeSingle();
      if (existing) continue;
      await admin.from("loyalty_points").insert({
        user_id: id, balance: randInt(50, 5000), lifetime_earned: randInt(100, 10000),
      });
    }

    // 24) Audit log
    for (let i = 0; i < 20; i++) {
      await admin.from("audit_log").insert({
        entity_type: rand(["product","order","user","payout"]),
        action: rand(["create","update","delete","approve","reject"]),
        admin_id: "19bb2c53-794a-47c6-9128-869a072b0acb",
        ip: `192.168.${randInt(0, 255)}.${randInt(0, 255)}`,
        metadata: { note: "seeded" },
      });
    }

    return new Response(JSON.stringify({ ok: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
