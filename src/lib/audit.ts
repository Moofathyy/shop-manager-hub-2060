import { supabase } from "@/integrations/supabase/client";

export async function logAudit(action: string, entity_type: string, entity_id?: string | null, metadata?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_log").insert({
    admin_id: user.id,
    action,
    entity_type,
    entity_id: entity_id ?? null,
    metadata: (metadata ?? null) as never,
  });
}
