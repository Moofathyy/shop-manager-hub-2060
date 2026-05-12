import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "demo@ejada.test";
  const password = "Demo@12345";

  // Try to find existing user
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    user = data.user!;
  } else {
    // Ensure password and confirmed
    await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
  }

  // Ensure super_admin role
  await admin.from("user_roles").upsert(
    { user_id: user.id, role: "super_admin" },
    { onConflict: "user_id,role" }
  );

  return new Response(JSON.stringify({ ok: true, user_id: user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
