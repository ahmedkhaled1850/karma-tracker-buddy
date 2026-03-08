import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Save, DollarSign, Mail, Palette, RefreshCw, Bus, Wifi, Award, Languages, Shield, Eye, EyeOff } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";
import { useTheme } from "next-themes";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be under 20 characters");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Requires at least one uppercase letter")
  .regex(/[a-z]/, "Requires at least one lowercase letter")
  .regex(/[0-9]/, "Requires at least one digit");

export default function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [autosaveMode, setAutosaveMode] = useState<"manual" | "immediate" | "hourly">("manual");
  const [appTheme, setAppTheme] = useState<string>("dark");
  
  const [baseSalary, setBaseSalary] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("");
  const [kpiPercentage, setKpiPercentage] = useState<string>("70");
  const [transportAllowance, setTransportAllowance] = useState<string>("0");
  const [internetAllowance, setInternetAllowance] = useState<string>("0");
  const [seniorBonus, setSeniorBonus] = useState<string>("0");
  const [languageAllowance, setLanguageAllowance] = useState<string>("0");
  const [isSalarySaving, setIsSalarySaving] = useState(false);
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
    if ((profile as any)?.display_name) setDisplayName((profile as any).display_name);
    const metaMode = (user?.user_metadata as Record<string, unknown> | undefined)?.autosaveMode;
    if (metaMode === "immediate" || metaMode === "hourly" || metaMode === "manual") {
      setAutosaveMode(metaMode as any);
    }
    if (theme) setAppTheme(theme);
  }, [profile, user]);

  useEffect(() => {
    const loadSalary = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_settings')
        .select('base_salary, tax_rate, kpi_percentage, transportation_allowance, internet_allowance, senior_bonus, language_allowance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        if (d.base_salary != null) setBaseSalary(String(d.base_salary));
        if (d.tax_rate != null) setTaxRate(String(d.tax_rate));
        if (d.kpi_percentage != null) setKpiPercentage(String(d.kpi_percentage));
        if (d.transportation_allowance != null) setTransportAllowance(String(d.transportation_allowance));
        if (d.internet_allowance != null) setInternetAllowance(String(d.internet_allowance));
        if (d.senior_bonus != null) setSeniorBonus(String(d.senior_bonus));
        if (d.language_allowance != null) setLanguageAllowance(String(d.language_allowance));
      }
    };
    loadSalary();
  }, [user?.id]);

  const onSalarySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSalarySaving(true);
    try {
      const payload = {
        base_salary: baseSalary ? parseFloat(baseSalary) : null,
        tax_rate: taxRate ? parseFloat(taxRate) : null,
        kpi_percentage: kpiPercentage ? parseFloat(kpiPercentage) : 70,
        transportation_allowance: transportAllowance ? parseFloat(transportAllowance) : 0,
        internet_allowance: internetAllowance ? parseFloat(internetAllowance) : 0,
        senior_bonus: seniorBonus ? parseFloat(seniorBonus) : 0,
        language_allowance: languageAllowance ? parseFloat(languageAllowance) : 0,
      } as any;
      
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('user_settings').update(payload).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_settings').insert({ user_id: user.id, ...payload });
        if (error) throw error;
      }
      toast.success("Salary settings saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setIsSalarySaving(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async ({ newUsername, newDisplayName }: { newUsername: string; newDisplayName: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ username: newUsername, display_name: newDisplayName } as any)
        .eq("user_id", user?.id || "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (err: PostgrestError) => {
      const msg = err?.message?.includes("violates") || err?.code === "23514"
        ? "Username is invalid based on server rules"
        : err?.message || "An error occurred while updating";
      toast.error(msg);
    },
  });

  const onProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { usernameSchema.parse(username); } catch (err) {
      if (err instanceof z.ZodError) { toast.error(err.errors[0].message); return; }
    }
    updateProfileMutation.mutate(username);
    const { error } = await supabase.auth.updateUser({ data: { autosaveMode } });
    if (error) toast.error("Failed to save preferences: " + error.message);
    else toast.success("Preferences saved");
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (oldPassword === newPassword) { toast.error("New password must be different"); return; }
    try { passwordSchema.parse(newPassword); } catch (err) {
      if (err instanceof z.ZodError) { toast.error(err.errors[0].message); return; }
    }
    setIsPasswordLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: oldPassword });
    if (signInError) { setIsPasswordLoading(false); toast.error("Incorrect old password"); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsPasswordLoading(false);
    if (updateError) toast.error(updateError.message);
    else { toast.success("Password changed successfully"); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, salary, and security preferences.</p>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account" className="gap-2"><User className="h-4 w-4" /> Account</TabsTrigger>
          <TabsTrigger value="salary" className="gap-2"><DollarSign className="h-4 w-4" /> Salary</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Profile & Preferences</CardTitle>
              <CardDescription>Update your public profile and app preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onProfileSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email</Label>
                  <Input value={user?.email || ""} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /> Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username"
                    disabled={isProfileLoading || updateProfileMutation.isPending} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> Auto-save</Label>
                    <Select value={autosaveMode} onValueChange={(val) => setAutosaveMode(val as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual only</SelectItem>
                        <SelectItem value="immediate">Auto after changes</SelectItem>
                        <SelectItem value="hourly">Auto hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Palette className="h-3.5 w-3.5 text-muted-foreground" /> Theme</Label>
                    <Select value={appTheme} onValueChange={(val) => { setAppTheme(val); setTheme(val); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">🌙 Dark</SelectItem>
                        <SelectItem value="light">☀️ Light</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={isProfileLoading || updateProfileMutation.isPending} className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Salary & KPI Settings</CardTitle>
              <CardDescription>Configure your compensation details for salary estimation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSalarySave} className="space-y-5">
                {/* Primary Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Base Salary</Label>
                    <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="e.g. 5000" step="0.01" min="0" />
                    <p className="text-[11px] text-muted-foreground">Gross monthly salary</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">KPI % of Salary</Label>
                    <Input type="number" value={kpiPercentage} onChange={(e) => setKpiPercentage(e.target.value)} placeholder="70" step="0.01" min="0" max="100" />
                    <p className="text-[11px] text-muted-foreground">KPI pool percentage</p>
                  </div>
                </div>

                {/* Allowances */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Allowances
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Bus className="h-3 w-3" /> Transport</Label>
                      <Input type="number" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} placeholder="0" step="0.01" min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Wifi className="h-3 w-3" /> Internet</Label>
                      <Input type="number" value={internetAllowance} onChange={(e) => setInternetAllowance(e.target.value)} placeholder="0" step="0.01" min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Award className="h-3 w-3" /> Senior</Label>
                      <Input type="number" value={seniorBonus} onChange={(e) => setSeniorBonus(e.target.value)} placeholder="0" step="0.01" min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Languages className="h-3 w-3" /> Language</Label>
                      <Input type="number" value={languageAllowance} onChange={(e) => setLanguageAllowance(e.target.value)} placeholder="0" step="0.01" min="0" />
                    </div>
                  </div>
                </div>

                {/* Tax */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Deductions
                  </h4>
                  <div className="max-w-xs">
                    <Label className="text-xs">Tax & Insurance Rate (%)</Label>
                    <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="e.g. 14.5" step="0.01" min="0" max="100" />
                  </div>
                </div>

                {/* Formula Info */}
                <Card className="p-3 bg-muted/30 border-dashed">
                  <p className="text-xs font-medium text-muted-foreground mb-1">💡 Salary Formula:</p>
                  <p className="text-[11px] text-muted-foreground">KPI Bonus = Base × KPI% × Score</p>
                  <p className="text-[11px] text-muted-foreground">Gross = Base + KPI + Allowances</p>
                  <p className="text-[11px] text-muted-foreground">Net = Gross × (1 - Tax%)</p>
                </Card>

                <Button type="submit" disabled={isSalarySaving} className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" /> {isSalarySaving ? "Saving..." : "Save Salary Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>Enter your current password for verification, then set a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPasswordSubmit} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input type={showOldPassword ? "text" : "password"} value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" disabled={isPasswordLoading} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10"
                      onClick={() => setShowOldPassword(!showOldPassword)}>
                      {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input type={showNewPassword ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" disabled={isPasswordLoading} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10"
                      onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Min 8 chars, with uppercase, lowercase & digit</p>
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" disabled={isPasswordLoading} />
                </div>
                <Button type="submit" disabled={isPasswordLoading} className="w-full sm:w-auto">
                  <Lock className="mr-2 h-4 w-4" /> Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
