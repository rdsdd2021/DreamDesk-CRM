"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Crown,
  Briefcase,
  Headphones,
  Sun,
  Moon,
  Check,
  Layers,
  Zap,
  TrendingUp,
  UserCheck,
  Building2,
  Activity,
  KeyRound,
  Users,
  CheckCircle2,
  MapPin,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface StaffProfile {
  id: string;
  name: string;
  role: string;
  roleCode: string;
  email: string;
  avatarColor: string;
  accentColor: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  permissions: string[];
}

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"credentials" | "sandbox">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingInName, setSigningInName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [wasDeactivated, setWasDeactivated] = useState(false);
  const [userStatuses, setUserStatuses] = useState<Record<string, { status: string; last_login_location?: string }>>({});
  const [geoLocation, setGeoLocation] = useState<{
    latitude?: number;
    longitude?: number;
    timezone: string;
  }>({
    timezone: "Asia/Kolkata",
  });

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "deactivated") {
        setWasDeactivated(true);
      }

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
        setGeoLocation((prev) => ({ ...prev, timezone: tz }));
      } catch {}

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGeoLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
            });
          },
          () => {},
          { timeout: 3500, maximumAge: 300000 }
        );
      }
    }

    // Fetch live roster statuses to reflect deactivations
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map: Record<string, { status: string; last_login_location?: string }> = {};
          data.forEach((u) => {
            map[u.id] = { status: u.status, last_login_location: u.last_login_location };
          });
          setUserStatuses(map);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dreamdesk_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dreamdesk_theme", "light");
    }
  };

  const staffProfiles: StaffProfile[] = [
    {
      id: "usr_admin",
      name: "Vikramaditya S.",
      role: "Super Admin",
      roleCode: "admin",
      email: "admin@dreamdesk.in",
      avatarColor: "#4f46e5",
      accentColor: "indigo",
      icon: Crown,
      headline: "Full Administrative Authority",
      permissions: [
        "Unrestricted access to all 112k+ leads",
        "Schema Studio: custom dynamic fields",
        "Staff user management & role control",
        "Global CSV export & bulk lead deletion",
      ],
    },
    {
      id: "usr_vikram",
      name: "Vikram M.",
      role: "Team Lead",
      roleCode: "team_lead",
      email: "vikram.m@dreamdesk.in",
      avatarColor: "#059669",
      accentColor: "emerald",
      icon: Briefcase,
      headline: "Supervisory & Operations Lead",
      permissions: [
        "Supervisory view across all counselors",
        "Counselor workload & response analytics",
        "Lead reassignment & team routing",
        "Bulk status & stage updates",
      ],
    },
    {
      id: "usr_rohit",
      name: "Rohit Sharma",
      role: "Sr. Counselor",
      roleCode: "senior_counselor",
      email: "rohit.sharma@dreamdesk.in",
      avatarColor: "#2563eb",
      accentColor: "blue",
      icon: GraduationCap,
      headline: "Student Counseling Specialist",
      permissions: [
        "Strict Private Desk: assigned leads only",
        "Call dispositions & callback scheduler",
        "WhatsApp / SMS outreach integration",
        "Blocked from CSV export & peer leads",
      ],
    },
    {
      id: "usr_ananya",
      name: "Ananya Verma",
      role: "Counselor / Telecaller",
      roleCode: "counselor",
      email: "ananya.v@dreamdesk.in",
      avatarColor: "#db2777",
      accentColor: "pink",
      icon: Headphones,
      headline: "High-Velocity Inbound / Outbound",
      permissions: [
        "Instant dialing queue for fresh inquiries",
        "Strict lead privacy (no peer snooping)",
        "Disposition logging & stage updating",
        "Zero CSV leak data firewall active",
      ],
    },
  ];

  const fillCredentials = (p: StaffProfile) => {
    setEmail(p.email);
    setPassword("password123");
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please provide your email address and password.");
      return;
    }

    setLoading(true);
    setSigningInName(null);
    setError(null);
    setWasDeactivated(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          locationInfo: geoLocation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (profile: StaffProfile) => {
    if (userStatuses[profile.id]?.status === "inactive") {
      setError(`Account for ${profile.name} has been deactivated. Please contact an administrator.`);
      return;
    }

    setLoading(true);
    setSigningInName(profile.name);
    setError(null);
    setWasDeactivated(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          quickLogin: true,
          locationInfo: geoLocation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Quick login failed.");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to log in with selected role.");
      setSigningInName(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden font-sans">
      {/* Background Ambience: Subtle Modern Gradient Mesh & Grid */}
      <div className="fixed inset-0 bg-[radial-gradient(#3b82f612_1px,transparent_1px)] dark:bg-[radial-gradient(#38bdf80f_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-tl from-indigo-600/10 via-violet-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
            <GraduationCap className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-foreground">DreamDesk</span>
              <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                CRM
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium hidden sm:block">
              Higher-Ed Admissions & Enrollment OS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live System Telemetry Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/60 text-[11px] text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>SQLite WAL Engine</span>
            <span className="text-border">|</span>
            <span className="text-foreground font-semibold">112,501 Indexed Leads</span>
          </div>

          {/* Theme Switcher Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg border-border/80 bg-card/80 backdrop-blur-md shadow-2xs hover:bg-muted cursor-pointer transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="relative z-10 flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT SIDE: Brand Showcase & Enterprise Features (Hidden on mobile, prominent on desktop) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-center space-y-6 pr-4">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs w-fit">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Next-Generation Higher-Ed Admissions Suite</span>
            </div>

            {/* Hero Heading */}
            <div className="space-y-3">
              <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                Speed, Privacy & Scalability for University Admissions.
              </h1>
              <p className="text-sm xl:text-base text-muted-foreground leading-relaxed max-w-xl">
                Empower counselors, automate high-converting follow-ups, and safeguard institutional student data with strict role-based isolation.
              </p>
            </div>

            {/* Interactive Live Telemetry Showcase Card */}
            <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Live Pipeline Metrics
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono">
                  ● Real-Time Sync
                </Badge>
              </div>

              {/* 3 Metric Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-[11px] text-muted-foreground block font-medium">Active Inquiries</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-foreground">112,501</span>
                    <span className="text-[10px] text-emerald-500 font-semibold font-mono">↑ 14%</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-[11px] text-muted-foreground block font-medium">Counselor SLA</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-foreground">2.4 min</span>
                    <span className="text-[10px] text-blue-500 font-semibold font-mono">&lt; 5m goal</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-[11px] text-muted-foreground block font-medium">Conversion Rate</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-bold text-foreground">34.8%</span>
                    <span className="text-[10px] text-emerald-500 font-semibold font-mono">+4.2%</span>
                  </div>
                </div>
              </div>

              {/* Live Counselor Activity Stream Simulation */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  Recent Counselor Activities:
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-foreground">Rohit S.</span>
                    <span className="truncate">logged disposition "Scholarship Offered" for Lead #89210</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 shrink-0">1m ago</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="font-semibold text-foreground">Auto-Router</span>
                    <span className="truncate">assigned 14 fresh JEE inquiries to Telecalling Pool A</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 shrink-0">3m ago</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Pillar Features with Icons */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Strict Lead Privacy</h4>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Counselors only see assigned students. Zero CSV leaks.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Dynamic Schema</h4>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Add custom fields on the fly without schema migrations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Sub-5ms SQLite</h4>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Ultra-fast searching and filtering on 100k+ records.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: High-Craft Authentication Box */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[450px] space-y-4">
              
              {/* Main Auth Card */}
              <div className="p-6 sm:p-7 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/5 dark:shadow-black/30 space-y-5">
                
                {/* Header & Mode Switcher */}
                <div className="space-y-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      Welcome to DreamDesk
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select your sign-in method to access the admissions terminal.
                    </p>
                  </div>

                  {/* Segmented Pill Tabs */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/50 border border-border/60 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("credentials");
                        setError(null);
                      }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "credentials"
                          ? "bg-card text-foreground shadow-xs font-bold border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Staff Sign In</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("sandbox");
                        setError(null);
                      }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === "sandbox"
                          ? "bg-card text-foreground shadow-xs font-bold border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Role Sandbox</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                        Fast
                      </span>
                    </button>
                  </div>
                </div>

                {/* Deactivated Notice Banner */}
                {wasDeactivated && (
                  <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs space-y-1 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 font-bold">
                      <UserX className="w-4 h-4 shrink-0" />
                      <span>Session Terminated: Account Deactivated</span>
                    </div>
                    <p className="text-[11px] text-destructive/90 leading-relaxed pl-6">
                      Your staff account was deactivated by a system administrator. All active sessions have been immediately revoked.
                    </p>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="leading-tight">{error}</span>
                  </div>
                )}

                {/* TAB 1: STANDARD STAFF LOGIN FORM */}
                {activeTab === "credentials" && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    
                    {/* Quick Demo Autofill Helper Chips */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>Autofill test profile:</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">pwd: password123</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {staffProfiles.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => fillCredentials(p)}
                            className="px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-medium text-foreground border border-border/60 hover:border-primary/40 transition-colors cursor-pointer active:scale-95"
                            title={`Fill ${p.name} (${p.role})`}
                          >
                            {p.role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Staff Email</span>
                        </label>
                        <Input
                          type="email"
                          placeholder="e.g. rohit.sharma@dreamdesk.in"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-10 text-xs bg-muted/20 border-border/80 focus-visible:ring-primary/30"
                          disabled={loading}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Password</span>
                          </label>
                          <span className="text-[11px] text-primary/80 font-medium hover:underline cursor-pointer">
                            Forgot password?
                          </span>
                        </div>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-10 text-xs pr-10 bg-muted/20 border-border/80 focus-visible:ring-primary/30"
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded border-border/80 text-primary focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px]">Remember terminal session</span>
                        </label>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-10 text-xs font-bold gap-2 shadow-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white cursor-pointer active:scale-[0.99] transition-all"
                      >
                        {loading && !signingInName ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Authenticating...</span>
                          </span>
                        ) : (
                          <>
                            <span>Sign In to Terminal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </Button>

                      {/* Location & Security Telemetry Line */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">Login Audited: {geoLocation.timezone || "Local Terminal"}</span>
                        </span>
                        <span className="text-[10px] text-emerald-500 font-mono font-semibold shrink-0">● Geo-Audited</span>
                      </div>
                    </form>
                  </div>
                )}

                {/* TAB 2: INSTANT ROLE SANDBOX (1-CLICK EVALUATION) */}
                {activeTab === "sandbox" && (
                  <div className="space-y-2.5 animate-in fade-in duration-150">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Select an institutional role to experience its unique permissions, isolated views, and workflows.
                    </p>

                    <div className="space-y-2">
                      {staffProfiles.map((p) => {
                        const Icon = p.icon;
                        const isThisSigningIn = loading && signingInName === p.name;
                        const isDeactivated = userStatuses[p.id]?.status === "inactive";

                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded-xl border transition-all space-y-2 group relative overflow-hidden ${
                              isDeactivated
                                ? "border-destructive/30 bg-destructive/5 opacity-80"
                                : "border-border/70 bg-muted/20 hover:bg-muted/50 hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-2xs shrink-0"
                                  style={{ backgroundColor: isDeactivated ? "#64748b" : p.avatarColor }}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-foreground">
                                      {p.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] py-0 px-1.5 font-semibold bg-background"
                                    >
                                      {p.role}
                                    </Badge>
                                    {isDeactivated && (
                                      <Badge
                                        variant="destructive"
                                        className="text-[9px] py-0 px-1.5 font-semibold gap-1"
                                      >
                                        <UserX className="w-2.5 h-2.5" />
                                        <span>Deactivated</span>
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground block font-mono">
                                    {p.email}
                                  </span>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant={isDeactivated ? "outline" : "outline"}
                                onClick={() => handleQuickLogin(p)}
                                disabled={loading || isDeactivated}
                                className={`h-7 text-xs font-semibold gap-1 cursor-pointer active:scale-95 transition-all ${
                                  isDeactivated
                                    ? "border-destructive/30 text-destructive opacity-70 cursor-not-allowed"
                                    : "hover:bg-primary hover:text-primary-foreground border-border/80"
                                }`}
                              >
                                {isThisSigningIn ? (
                                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                ) : isDeactivated ? (
                                  <span>Deactivated</span>
                                ) : (
                                  <>
                                    <span>Enter</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Role Permission Bullets */}
                            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                              {p.permissions.slice(0, 2).map((perm, idx) => (
                                <div key={idx} className="flex items-center gap-1 truncate">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                  <span className="truncate">{perm}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Security & Isolation Callout */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Role-Based Isolation Active</span>
                  </span>
                  <span className="font-mono text-[10px]">scrypt • 7-day session</span>
                </div>
              </div>

              {/* Trust & Compliance Line */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3 h-3" />
                  <span>Enterprise Higher-Ed Edition</span>
                </span>
                <span className="font-mono text-[10px]">DreamDesk v2.4</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/70 border-t border-border/30">
        <span>© 2026 DreamDesk CRM Systems. Built for High-Volume University Admissions.</span>
        <div className="flex items-center gap-4">
          <span className="hover:underline cursor-pointer">Security Whitepaper</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer">Data Privacy Policy</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer">System Status</span>
        </div>
      </footer>
    </div>
  );
}
