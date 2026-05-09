import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Auth() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user && isAdmin) return <Navigate to="/admin" replace />;

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    // Verify admin
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
      const isAdminRole = (data ?? []).some((r) => ["super_admin","finance_admin","support_agent","moderator","marketing_admin"].includes(r.role));
      if (!isAdminRole) {
        await supabase.auth.signOut();
        return toast({ title: "Access denied", description: "Your account does not have admin access.", variant: "destructive" });
      }
      navigate("/admin");
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/admin`, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    toast({ title: "Account created", description: "Ask a super admin to grant you admin access." });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-bg p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-card bg-primary flex items-center justify-center text-primary-foreground text-h1 mb-4">E</div>
          <h1 className="text-display text-primary">Ejada Admin</h1>
          <p className="text-body text-neutral-2 mt-2">E-commerce platform control center</p>
        </div>
        <Card className="shadow-elevation-2">
          <CardContent className="p-6">
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <label className="text-label text-neutral-2">Email</label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-label text-neutral-2">Password</label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-caption text-neutral-4 text-center pt-2">
                Demo: <span className="text-neutral-2">demo@ejada.test</span> / <span className="text-neutral-2">Demo@12345</span>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
