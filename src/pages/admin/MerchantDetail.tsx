import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MessageSquareWarning, FileText, Download, ExternalLink, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailHeader } from "@/components/admin/DetailHeader";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";

interface Doc { name: string; url?: string; type?: string }
interface KycResult { provider?: string; status?: string; score?: number; checked_at?: string }
interface Application {
  id: string;
  seller_id: string;
  documents: Doc[];
  status: "pending" | "approved" | "rejected" | "needs_info";
  decision_reason: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  business_type: string | null;
  kyc_result: KycResult | null;
}
interface Seller { store_name: string; business_name: string | null; address: string | null; tax_id: string | null }
interface Profile { full_name: string | null; phone: string | null; country: string | null }
interface AuditEntry { id: string; action: string; metadata: { reason?: string } | null; created_at: string; admin_id: string | null }

export default function MerchantDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: a } = await supabase.from("merchant_applications").select("*").eq("id", id).single();
    if (!a) { setLoading(false); return; }
    const application = { ...a, documents: (a.documents as unknown as Doc[]) ?? [], kyc_result: a.kyc_result as unknown as KycResult | null } as Application;
    setApp(application);
    const [{ data: s }, { data: p }, { data: h }] = await Promise.all([
      supabase.from("seller_profiles").select("store_name, business_name, address, tax_id").eq("user_id", application.seller_id).maybeSingle(),
      supabase.from("profiles").select("full_name, phone, country").eq("id", application.seller_id).maybeSingle(),
      supabase.from("audit_log").select("id, action, metadata, created_at, admin_id").eq("entity_id", application.id).order("created_at", { ascending: false }),
    ]);
    setSeller(s as Seller | null);
    setProfile(p as Profile | null);
    setHistory((h ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const decide = async (status: Application["status"], reason?: string) => {
    if (!app) return;
    const { error } = await supabase.from("merchant_applications").update({
      status, decision_reason: reason ?? null,
      decided_at: new Date().toISOString(),
      decided_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    }).eq("id", app.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    if (status === "approved" || status === "rejected") {
      await supabase.from("seller_profiles").update({ approval_status: status }).eq("user_id", app.seller_id);
    }
    await logAudit(`merchant.${status}`, "merchant_application", app.id, { reason });
    toast({ title: `Application ${status.replace("_", " ")}` });
    load();
  };

  if (loading) return <Skeleton className="h-96" />;
  if (!app) return <div>Application not found.</div>;

  const kyc = app.kyc_result ?? {};
  const kycVariant = kyc.status === "verified" ? "success" : kyc.status === "failed" ? "destructive" : "warning";

  return (
    <div className="space-y-6">
      <DetailHeader
        backTo="/admin/merchants"
        backLabel="Back to approvals"
        title={seller?.store_name ?? "Application"}
        subtitle={`Submitted ${new Date(app.created_at).toLocaleString()}`}
      >
        <Badge variant={app.status === "approved" ? "success" : app.status === "rejected" ? "destructive" : "warning"}>
          {app.status.replace("_", " ")}
        </Badge>
      </DetailHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Business information</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 text-body">
              <Field label="Applicant" value={profile?.full_name ?? "—"} />
              <Field label="Phone" value={profile?.phone ?? "—"} />
              <Field label="Country" value={profile?.country ?? "—"} />
              <Field label="Store name" value={seller?.store_name ?? "—"} />
              <Field label="Legal business name" value={seller?.business_name ?? "—"} />
              <Field label="Business type" value={app.business_type ?? "—"} />
              <Field label="Tax ID" value={seller?.tax_id ?? "—"} />
              <Field label="Address" value={seller?.address ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uploaded documents</CardTitle></CardHeader>
            <CardContent>
              {app.documents.length === 0 ? (
                <p className="text-neutral-4">No documents uploaded.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {app.documents.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-input">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-neutral-7 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-neutral-3" />
                        </div>
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-caption text-neutral-4">{d.type ?? "document"}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button asChild size="sm" variant="ghost"><a href={d.url || "#"} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                        <Button asChild size="sm" variant="ghost"><a href={d.url || "#"} download><Download className="h-4 w-4" /></a></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> KYC verification</CardTitle></CardHeader>
            <CardContent>
              {!kyc.status ? (
                <p className="text-neutral-4">No KYC result available.</p>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Provider" value={kyc.provider ?? "—"} />
                  <Field label="Status" value={<Badge variant={kycVariant as never}>{kyc.status}</Badge>} />
                  <Field label="Score" value={kyc.score != null ? `${kyc.score}/100` : "—"} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Decision history</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-neutral-4">No decisions yet.</p>
              ) : (
                <ol className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-body">
                      <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                      <div>
                        <div className="font-medium">{h.action.replace("merchant.", "").replace("_", " ")}</div>
                        <div className="text-caption text-neutral-4">{new Date(h.created_at).toLocaleString()}</div>
                        {h.metadata?.reason && <p className="text-caption text-neutral-2 mt-1">{h.metadata.reason}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Admin decision</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {app.status === "approved" || app.status === "rejected" ? (
                <p className="text-neutral-2 text-body">
                  Decision recorded: <strong>{app.status}</strong>
                  {app.decision_reason && <span> — {app.decision_reason}</span>}
                </p>
              ) : (
                <>
                  <Button variant="primary" className="w-full" onClick={() => decide("approved")}>
                    <CheckCircle2 className="h-4 w-4" /> Approve & send welcome email
                  </Button>
                  <ReasonDialog
                    trigger={<Button variant="secondary" className="w-full"><MessageSquareWarning className="h-4 w-4" /> Request more info</Button>}
                    title="Request more information"
                    description="Specify what is missing. The seller will be notified."
                    onSubmit={(r) => decide("needs_info", r)}
                  />
                  <ReasonDialog
                    trigger={<Button variant="destructive" className="w-full"><XCircle className="h-4 w-4" /> Reject application</Button>}
                    title="Reject application"
                    description="Provide a rejection reason. This will be shown to the seller."
                    onSubmit={(r) => decide("rejected", r)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-caption text-neutral-4">{label}</div>
      <div className="text-body text-neutral-1">{value}</div>
    </div>
  );
}

function ReasonDialog({ trigger, title, description, onSubmit }: { trigger: React.ReactNode; title: string; description: string; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Type details…" rows={5} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSubmit(reason); setOpen(false); setReason(""); }} disabled={!reason.trim()}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
