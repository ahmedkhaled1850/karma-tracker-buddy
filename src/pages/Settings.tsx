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
import { User, Lock, Save } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";
import { useTheme } from "next-themes";

// Schemas
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be under 20 characters")
  .regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers and underscore are allowed");

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
  
  // Profile State
  const [username, setUsername] = useState("");
  const [autosaveMode, setAutosaveMode] = useState<"manual" | "immediate" | "hourly">("manual");
  const [appTheme, setAppTheme] = useState<string>("dark");
  
  // Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  // Fetch Profile
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

  // Effect to set initial state
  useEffect(() => {
    if (profile?.username) {
        setUsername(profile.username);
    }
    const metaMode = (user?.user_metadata as Record<string, unknown> | undefined)?.autosaveMode;
    if (metaMode === "immediate" || metaMode === "hourly" || metaMode === "manual") {
      setAutosaveMode(metaMode as any);
    }
    if (theme) setAppTheme(theme);
  }, [profile, user]);

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ username: newUsername })
        .eq("user_id", user?.id || "");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (err: PostgrestError) => {
      const msg =
        err?.message?.includes("violates") || err?.code === "23514"
          ? "Username is invalid based on server rules"
          : err?.message || "An error occurred while updating";
      toast.error(msg);
    },
  });

  const onProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      usernameSchema.parse(username);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    
    updateProfileMutation.mutate(username);
    
    // Update Autosave Preference
    const { error } = await supabase.auth.updateUser({ 
        data: { autosaveMode } 
    });
    
    if (error) {
        toast.error("Failed to save preferences: " + error.message);
    } else {
        toast.success("Preferences saved");
    }
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    if (oldPassword === newPassword) {
        toast.error("New password must be different from the old password");
        return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsPasswordLoading(true);

    // Verify Old Password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: oldPassword
    });

    if (signInError) {
        setIsPasswordLoading(false);
        toast.error("Incorrect old password");
        return;
    }

    // Update Password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    
    setIsPasswordLoading(false);
    
    if (updateError) {
      toast.error(updateError.message);
    } else {
      toast.success("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>

        <Tabs defaultValue="account" className="space-y-4">
            <TabsList>
                <TabsTrigger value="account" className="flex items-center gap-2"><User className="h-4 w-4"/> Account</TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2"><Lock className="h-4 w-4"/> Security</TabsTrigger>
            </TabsList>

            <TabsContent value="account">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile & Preferences</CardTitle>
                        <CardDescription>Update your public profile and app preferences.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={onProfileSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={user?.email || ""} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Username</Label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username"
                                    disabled={isProfileLoading || updateProfileMutation.isPending}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Auto-save Mode</Label>
                                <Select
                                    value={autosaveMode}
                                    onValueChange={(val) => setAutosaveMode(val as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual only</SelectItem>
                                        <SelectItem value="immediate">Auto after changes</SelectItem>
                                        <SelectItem value="hourly">Auto hourly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Theme</Label>
                                <Select
                                    value={appTheme}
                                    onValueChange={(val) => {
                                      setAppTheme(val);
                                      setTheme(val);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="light">Light</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" disabled={isProfileLoading || updateProfileMutation.isPending}>
                                <Save className="mr-2 h-4 w-4" /> Save Changes
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="security">
                <Card>
                    <CardHeader>
                        <CardTitle>Password</CardTitle>
                        <CardDescription>Change your password. Please enter your current password for security.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={onPasswordSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Old Password</Label>
                                <Input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    placeholder="••••••••"
                                    disabled={isPasswordLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    disabled={isPasswordLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm New Password</Label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    disabled={isPasswordLoading}
                                />
                            </div>
                            <Button type="submit" disabled={isPasswordLoading}>
                                Update Password
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </TabsContent>
            
        </Tabs>
    </div>
  );
}
