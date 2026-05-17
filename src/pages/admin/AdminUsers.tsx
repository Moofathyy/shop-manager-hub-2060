import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type AdminUser = {
  id: string;
  full_name: string | null;
  status: string;
  last_login: string | null;
  roles: string[];
};

const ADMIN_ROLES = ["super_admin", "finance_admin", "support_agent", "moderator", "marketing_admin"] as const;
type AdminRole = typeof ADMIN_ROLES[number];

const roleColor: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  finance_admin: "bg-emerald-500 text-white",
  support_agent: "bg-blue-500 text-white",
  moderator: "bg-amber-500 text-white",
  marketing_admin: "bg-fuchsia-500 text-white",
};

export default function AdminUsers() {
  const { roles: myRoles } = useAuth();
  const canEdit = myRoles.includes("super_admin");

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [draftRoles, setDraftRoles] = useState<AdminRole[]>([]);
  const [draftStatus, setDraftStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ADMIN_ROLES as any);

    const byUser = new Map<string, string[]>();
    (roleRows ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });

    const ids = Array.from(byUser.keys());
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, status, last_login")
        .in("id", ids);
      profiles = data ?? [];
    }

    setUsers(
      ids.map((id) => {
        const p = profiles.find((pr) => pr.id === id);
        return {
          id,
          full_name: p?.full_name ?? "—",
          status: p?.status ?? "active",
          last_login: p?.last_login ?? null,
          roles: byUser.get(id) ?? [],
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setDraftRoles(u.roles.filter((r): r is AdminRole => (ADMIN_ROLES as readonly string[]).includes(r)));
    setDraftStatus(u.status);
  };

  const toggleRole = (role: AdminRole) => {
    setDraftRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const save = async () => {
    if (!editing) return;
    if (draftRoles.length === 0) {
      toast.error("Select at least one admin role");
      return;
    }
    setSaving(true);
    try {
      // Update status
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ status: draftStatus as any })
        .eq("id", editing.id);
      if (pErr) throw pErr;

      const current = new Set(editing.roles.filter((r) => (ADMIN_ROLES as readonly string[]).includes(r)));
      const next = new Set(draftRoles);
      const toAdd = [...next].filter((r) => !current.has(r));
      const toRemove = [...current].filter((r) => !next.has(r));

      if (toRemove.length) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editing.id)
          .in("role", toRemove as any[]);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("user_roles")
          .insert(toAdd.map((role) => ({ user_id: editing.id, role: role as any })));
        if (error) throw error;
      }

      toast.success("Admin user updated");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-input bg-primary-bg text-primary flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-h2 text-neutral-1">Admin Users</h1>
          <p className="text-caption text-neutral-4">
            {canEdit ? "Manage who can access this admin panel" : "People with access to this admin panel"}
          </p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-4 py-10">
                  No admin users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.map((r) => (
                        <Badge key={r} className={roleColor[r] ?? "bg-neutral-5"}>
                          {r.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-3">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(u)}
                      disabled={!canEdit}
                      title={canEdit ? "Edit" : "Only super admins can edit"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit admin user</DialogTitle>
            <DialogDescription>{editing?.full_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <div className="text-label text-neutral-2 mb-2">Roles</div>
              <div className="space-y-2">
                {ADMIN_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={draftRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <span className="text-body capitalize">{role.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-label text-neutral-2 mb-2">Status</div>
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
