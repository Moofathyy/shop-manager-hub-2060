import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MessageSquareWarning, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { logAudit } from "@/lib/audit";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Application {
  id: string;
  seller_id: string;
  documents: Array<{ name: string; url?: string }>;
  status: "pending" | "approved" | "rejected" | "needs_info";
  decision_reason: string | null;
  created_at: string;
  store_name?: string;
}

export default function Merchants() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const load = async () => {
    setLoading(true);
    const [{ data: apps }, { data: sellers }] = await Promise.all([
      supabase.from("merchant_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("seller_profiles").select("user_id, store_name"),
    ]);
    const m = new Map((sellers ?? []).map((s) => [s.user_id, s.store_name]));
    setRows((apps ?? []).map((a) => ({ ...a, documents: (a.documents as Application["documents"]) ?? [], store_name: m.get(a.seller_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => tab === "all" || r.status === tab);

  const decide = async (app: Application, status: Application["status"], reason?: string) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-neutral-1">Merchant Approvals</h1>
        <p className="text-body text-neutral-2 mt-1">Review seller onboarding applications.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-neutral-7">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Skeleton className="h-40" /> : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-neutral-4">No applications</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-h3 text-neutral-1">{a.store_name ?? "Unnamed store"}</h3>
                      <Badge variant={a.status === "approved" ? "success" : a.status === "rejected" ? "destructive" : "warning"}>
                        {a.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-caption text-neutral-2">Submitted {new Date(a.created_at).toLocaleDateString()}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {a.documents.length === 0 ? (
                        <span className="text-caption text-neutral-4">No documents uploaded</span>
                      ) : a.documents.map((d, i) => (
                        <Badge key={i} variant="secondary"><FileText className="h-3 w-3 mr-1" /> {d.name}</Badge>
                      ))}
                    </div>
                    {a.decision_reason && (
                      <p className="text-caption text-neutral-2 mt-2"><strong>Reason:</strong> {a.decision_reason}</p>
                    )}
                  </div>
                  {a.status === "pending" && (
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => decide(a, "approved")}>
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                      <ReasonDialog
                        trigger={<Button variant="secondary" size="sm"><MessageSquareWarning className="h-4 w-4" /> Request info</Button>}
                        title="Request more information"
                        onSubmit={(r) => decide(a, "needs_info", r)}
                      />
                      <ReasonDialog
                        trigger={<Button variant="destructive" size="sm"><XCircle className="h-4 w-4" /> Reject</Button>}
                        title="Reject application"
                        onSubmit={(r) => decide(a, "rejected", r)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReasonDialog({ trigger, title, onSubmit }: { trigger: React.ReactNode; title: string; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>This message will be sent to the seller.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" rows={4} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSubmit(reason); setOpen(false); setReason(""); }} disabled={!reason.trim()}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
