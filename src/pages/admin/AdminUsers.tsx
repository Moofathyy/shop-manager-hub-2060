import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

type AdminUser = {
  id: string;
  full_name: string | null;
  status: string | null;
  last_login: string | null;
  roles: string[];
};

const ADMIN_ROLES = ["super_admin", "finance_admin", "support_agent", "moderator", "marketing_admin"];

const roleColor: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  finance_admin: "bg-emerald-500 text-white",
  support_agent: "bg-blue-500 text-white",
  moderator: "bg-amber-500 text-white",
  marketing_admin: "bg-fuchsia-500 text-white",
};

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-input bg-primary-bg text-primary flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-h2 text-neutral-1">Admin Users</h1>
          <p className="text-caption text-neutral-4">People with access to this admin panel</p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-neutral-4 py-10">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
