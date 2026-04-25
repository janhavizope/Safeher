import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, BarChart3, TrendingUp, Users, LogOut, Edit, Shield, LayoutDashboard, ChevronLeft, ChevronRight, Search, CheckSquare, Square, Trash2, CheckCircle2, History, Zap, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { useStealth } from "@/contexts/StealthContext";
import { attemptAdminPasscode, clearAdminAuth, getAdminAuthSnapshot } from "@shared/adminAuth";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toggleStealthMode } = useStealth();
  const [lastTap, setLastTap] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingIncident, setEditingIncident] = useState<any>(null);
  const [editForm, setEditForm] = useState({ description: "", latitude: 0, longitude: 0 });
  const [selectedIncidents, setSelectedIncidents] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'reports' | 'audit'>('reports');
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [adminLockState, setAdminLockState] = useState(() => getAdminAuthSnapshot(window.localStorage));

  const updateStatusMutation = trpc.admin.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.incidents.invalidate(),
        utils.admin.statistics.invalidate(),
        utils.admin.auditLogs.invalidate(),
      ]);
      toast.success("Incident status updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update incident status");
    },
  });

  const bulkUpdateMutation = trpc.admin.bulkUpdateStatus.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.admin.incidents.invalidate(),
        utils.admin.statistics.invalidate(),
        utils.admin.auditLogs.invalidate(),
      ]);
      toast.success(`Successfully updated ${data.count} reports`);
      setSelectedIncidents(new Set());
    },
    onError: (error) => {
      toast.error(error.message || "Bulk update failed");
    },
  });

  const [passcode, setPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(() => adminLockState.isAuthorized);

  const checkPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const result = attemptAdminPasscode(window.localStorage, passcode);
    setAdminLockState(result.snapshot);

    if (result.status === "success") {
      setIsAuthorized(true);
      toast.success("Moderator Access Granted");
    } else if (result.status === "locked") {
      const lockMinutes = Math.ceil(result.snapshot.remainingLockMs / 60000);
      toast.error(`Too many failed attempts. Try again in ${lockMinutes} minute${lockMinutes === 1 ? "" : "s"}.`);
    } else {
      toast.error(`Invalid Moderator Code. ${result.snapshot.remainingAttempts} attempt${result.snapshot.remainingAttempts === 1 ? "" : "s"} left before a 1 hour lock.`);
    }

    setPasscode("");
  };

  useEffect(() => {
    if (!adminLockState.isLocked) return;

    const timeout = window.setTimeout(() => {
      const nextState = getAdminAuthSnapshot(window.localStorage);
      setAdminLockState(nextState);
      setIsAuthorized(nextState.isAuthorized);
    }, adminLockState.remainingLockMs + 1000);

    return () => window.clearTimeout(timeout);
  }, [adminLockState.isLocked, adminLockState.remainingLockMs]);

  // Auth check disabled for hackathon demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isAltShift = (e.altKey || e.metaKey) && e.shiftKey;
      if (isAltShift && e.key.toLowerCase() === 'j') {
        const checkBoth = (nextEvent: KeyboardEvent) => {
           if (nextEvent.key.toLowerCase() === 'a') {
              nextEvent.preventDefault();
              // If not authorized, autofocus the input if visible
              if (!isAuthorized) {
                const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                if (input) input.focus();
              }
              window.removeEventListener('keydown', checkBoth);
           }
        };
        window.addEventListener('keydown', checkBoth, { once: true });
        setTimeout(() => window.removeEventListener('keydown', checkBoth), 1000);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthorized]);

  const editIncidentMutation = trpc.admin.editIncident.useMutation({
    onSuccess: async () => {
      await utils.admin.incidents.invalidate();
      toast.success("Incident details updated");
      setEditingIncident(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update incident details");
    },
  });

  const handleHeaderTap = () => {
    const now = Date.now();
    if (now - lastTap < 400) {
      const nextCount = tapCount + 1;
      setTapCount(nextCount);
      if (nextCount >= 3) {
        toggleStealthMode();
        setTapCount(0);
      }
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  };

  const statisticsQuery = trpc.admin.statistics.useQuery(undefined, { refetchInterval: 15000 });
  const incidentsQuery = trpc.admin.incidents.useQuery({
    page,
    limit: 20,
    filters: {
      types: filterType === "all" ? undefined : [filterType],
      severity: filterEscalated ? ["high", "critical"] : (filterSeverity === "all" ? undefined : [filterSeverity]),
      status: filterEscalated ? ["pending"] : (filterStatus === "all" ? undefined : [filterStatus]),
    },
    search: search || undefined,
  }, { refetchInterval: 15000 });

  const auditLogsQuery = trpc.admin.auditLogs.useQuery({
    search: search || undefined,
    limit: 50
  }, { 
    enabled: activeTab === 'audit',
    refetchInterval: 30000 
  });

  const stats = statisticsQuery.data;
  const incidents = incidentsQuery.data;

  const incidentMedia = editingIncident?.mediaUrls ?? [];

  const applyStatusUpdate = (
    incidentId: number,
    status: "verified" | "resolved" | "dismissed",
    defaultNote: string
  ) => {
    const noteInput = window.prompt("Add moderation note (optional)", defaultNote);
    if (noteInput === null) return;
    const trimmed = noteInput.trim();
    updateStatusMutation.mutate({
      incidentId,
      status,
      notes: trimmed.length > 0 ? trimmed : undefined,
    });
  };

  // Prepare chart data
  const typeChartData = stats
    ? Object.entries(stats.incidentsByType).map(([type, count]) => ({
        name: type,
        count: count as number,
      }))
    : [];

  const severityChartData = stats
    ? Object.entries(stats.incidentsBySeverity).map(([severity, count]) => ({
        name: severity,
        count: count as number,
      }))
    : [];

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6"];

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIncidents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIncidents(next);
  };

  const handleBulkAction = (status: "verified" | "dismissed") => {
    if (selectedIncidents.size === 0) return;
    const note = window.prompt(`Bulk ${status} note:`, `Bulk ${status} by moderator`);
    if (note === null) return;
    
    bulkUpdateMutation.mutate({
      incidentIds: Array.from(selectedIncidents),
      status,
      notes: note
    });
  };

  const getSLATimer = (submittedAt: Date) => {
    const ageMs = Date.now() - new Date(submittedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    if (ageHours < 1) return { label: "< 1h", color: "text-emerald-500 bg-emerald-50 border-emerald-100" };
    if (ageHours < 6) return { label: "1-6h", color: "text-amber-500 bg-amber-50 border-amber-100" };
    return { label: "> 6h", color: "text-rose-500 bg-rose-50 border-rose-100" };
  };

  const getEvidenceQuality = (score: number) => {
    if (score >= 80) return { label: "High", color: "bg-emerald-500" };
    if (score >= 40) return { label: "Medium", color: "bg-amber-500" };
    return { label: "Low", color: "bg-rose-400" };
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-200/60 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-100/80 rounded-full blur-3xl -ml-48 -mb-48"></div>

        <Card className="relative w-full max-w-md bg-white/90 border border-rose-100 text-rose-950 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-inner">
                <Shield className="w-8 h-8 text-rose-800" />
            </div>
            <CardTitle className="text-2xl font-serif font-bold uppercase tracking-[0.2em] text-rose-950">Security Gate</CardTitle>
            <CardDescription className="text-rose-700/70 text-xs">Verification Required for Admin Authority.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={checkPasscode} className="space-y-4">
              {adminLockState.isLocked && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900">
                  Access locked for {Math.max(1, Math.ceil(adminLockState.remainingLockMs / 60000))} minute{Math.max(1, Math.ceil(adminLockState.remainingLockMs / 60000)) === 1 ? "" : "s"} after 5 failed attempts.
                </div>
              )}
              <div className="space-y-2">
                 <Input 
                   type="password" 
                   placeholder="••••••••"
                   value={passcode}
                   onChange={(e) => setPasscode(e.target.value)}
                   className="bg-white border-rose-200 text-rose-950 text-center text-xl tracking-[0.5em] h-14 focus:border-rose-400 transition-all placeholder:tracking-normal placeholder:opacity-30"
                   autoFocus
                   disabled={adminLockState.isLocked}
                 />
              </div>
              <Button type="submit" className="w-full bg-rose-950 hover:bg-rose-900 text-white h-14 font-bold text-lg transition-transform active:scale-95 shadow-lg disabled:opacity-60" disabled={adminLockState.isLocked}>
                Authorize Session
              </Button>
            </form>
            <p className="text-center mt-6 text-[10px] text-rose-700/50 uppercase tracking-widest">SafeHer &copy; 2026 Moderator Subsystem</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex font-sans selection:bg-rose-500/30">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-200/70 rounded-full blur-[120px] -mr-64 -mt-64"></div>
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-100/90 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      </div>

      <aside className="w-64 bg-white/85 border-r border-rose-100 backdrop-blur-3xl flex flex-col z-10 shrink-0 shadow-[0_0_40px_rgba(244,63,94,0.06)]">
        <div className="p-8 cursor-pointer select-none" onClick={handleHeaderTap}>
          <h2 className="text-2xl font-serif font-bold text-rose-950 tracking-tight">SafeHer<span className="text-rose-500">.</span></h2>
          <p className="text-[10px] uppercase tracking-[0.3em] text-rose-700/55 font-bold mt-1">Moderator Control</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => {
              setFilterStatus("all");
              setPage(1);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all shadow-sm ${
              filterStatus === "all" && activeTab === 'reports' && !filterEscalated
                ? "bg-rose-50 border border-rose-100 text-rose-950"
                : "text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-rose-700" />
            All Reports
          </button>
          <button
            onClick={() => {
              setFilterStatus("pending");
              setFilterEscalated(false);
              setActiveTab('reports');
              setPage(1);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              filterStatus === "pending" && !filterEscalated && activeTab === 'reports'
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : "text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Pending Queue
          </button>
          <button
            onClick={() => {
              setFilterEscalated(true);
              setActiveTab('reports');
              setPage(1);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              filterEscalated && activeTab === 'reports'
                ? "bg-rose-600 border border-rose-700 text-white shadow-lg shadow-rose-200"
                : "text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
            }`}
          >
            <Zap className={`w-4 h-4 ${filterEscalated ? 'text-white' : 'text-rose-500'}`} />
            Escalation Queue
          </button>
          <button
            onClick={() => {
              setFilterStatus("verified");
              setFilterEscalated(false);
              setActiveTab('reports');
              setPage(1);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              filterStatus === "verified" && !filterEscalated && activeTab === 'reports'
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
            }`}
          >
            <Users className="w-4 h-4" />
            Verified Feed
          </button>
          <div className="py-2 opacity-20"><div className="h-[1px] bg-rose-200 mx-4"></div></div>
          <button
            onClick={() => {
              setActiveTab('audit');
              setFilterEscalated(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'audit'
                ? "bg-stone-100 border border-stone-200 text-stone-900"
                : "text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
            }`}
          >
            <History className="w-4 h-4" />
            Moderator Logs
          </button>
          <button
            onClick={toggleStealthMode}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 border border-transparent"
          >
            <EyeOff className="w-4 h-4" />
            Discrete Mode
          </button>
        </nav>

        <div className="p-6 border-t border-rose-100 mt-auto">
          <Button 
            variant="ghost" 
            onClick={() => {
              logout();
              clearAdminAuth(window.localStorage);
              setAdminLockState(getAdminAuthSnapshot(window.localStorage));
              setIsAuthorized(false);
              setLocation("/");
            }} 
            className="w-full justify-start text-rose-700/60 hover:text-rose-950 hover:bg-rose-50 rounded-xl px-4 py-6"
          >
            <LogOut className="w-4 h-4 mr-3" />
            System Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto relative z-10">
        <header className="flex justify-between items-end mb-12">
          <div>
          <h1 className="text-4xl font-serif font-bold text-rose-950 tracking-tight">
            {activeTab === 'audit' ? 'Moderator Audit' : filterEscalated ? 'Escalation Queue' : 'Moderation Hub'}
          </h1>
          <p className="text-rose-700/70 text-sm mt-2 font-medium tracking-wide">
            {activeTab === 'audit' ? 'Searchable compliance & action history' : 'Secure Oversight & Public Record Verification'}
          </p>
          </div>
          
          <div className="flex gap-4">
           <div className="bg-white border border-rose-100 rounded-2xl px-8 py-4 text-center backdrop-blur-xl shadow-lg">
             <p className="text-rose-700/55 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Total Impact</p>
             <p className="text-3xl font-bold text-rose-950">{stats?.totalIncidents ?? "..."}</p>
             </div>
           <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl px-8 py-4 text-center backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.08)]">
             <p className="text-rose-700 text-[10px] uppercase tracking-[0.2em] font-bold mb-1 font-mono">Quarantined</p>
             <p className="text-3xl font-bold text-rose-950">{stats?.pendingCount ?? "..."}</p>
             </div>
          </div>
        </header>

        {(stats?.pendingCount ?? 0) > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between">
            <p className="text-amber-900 text-sm font-semibold">
              {(stats?.pendingCount ?? 0)} report(s) are waiting for verification.
            </p>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => {
                setFilterStatus("pending");
                setPage(1);
              }}
            >
              Open Pending Queue
            </Button>
          </div>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-[0_4px_30px_-18px_rgba(124,45,18,0.2)] hover:border-rose-200 transition-all group cursor-default">
              <div className="flex items-center justify-between mb-2">
                <p className="text-rose-700/55 text-[10px] uppercase tracking-widest font-black">Harassment</p>
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.35)]"></div>
              </div>
              <p className="text-4xl font-bold text-rose-950">{stats?.incidentsByType['harassment'] ?? 0}</p>
           </div>
            <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-[0_4px_30px_-18px_rgba(124,45,18,0.2)] hover:border-rose-200 transition-all">
              <p className="text-rose-700/55 text-[10px] uppercase tracking-widest font-black mb-2">Assault</p>
              <p className="text-4xl font-bold text-rose-950">{stats?.incidentsByType['assault'] ?? 0}</p>
           </div>
            <div className="bg-rose-50 p-6 rounded-3xl border border-rose-200 relative overflow-hidden shadow-[0_4px_30px_-18px_rgba(124,45,18,0.24)]">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-200/50 blur-2xl -mr-8 -mt-8"></div>
              <p className="text-rose-700 text-[10px] uppercase tracking-widest font-black mb-2">Critical Priority</p>
              <p className="text-4xl font-bold text-rose-950">{stats?.highSeverityCount ?? 0}</p>
           </div>
            <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-[0_4px_30px_-18px_rgba(124,45,18,0.2)] hover:border-rose-200 transition-all">
              <p className="text-rose-700/55 text-[10px] uppercase tracking-widest font-black mb-2">Unsafe Areas</p>
              <p className="text-4xl font-bold text-rose-950">{stats?.incidentsByType['unsafe_area'] ?? 0}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Charts area */}
           <Card className="lg:col-span-2 bg-white border-rose-100 shadow-[0_8px_40px_-20px_rgba(124,45,18,0.18)] backdrop-blur-md p-6">
            <h3 className="text-sm font-serif font-bold text-rose-900 tracking-widest uppercase mb-8">Severity Heatmap (Log)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e7ea" vertical={false} />
                <XAxis dataKey="name" stroke="#b78f97" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#b78f97" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                  contentStyle={{ backgroundColor: '#fffaf9', border: '1px solid #f5d8de', borderRadius: '12px' }}
                  itemStyle={{ color: '#3f1d23', textTransform: 'capitalize' }}
                  />
                  <Bar dataKey="count" fill="url(#roseGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="bg-white border-rose-100 shadow-[0_8px_40px_-20px_rgba(124,45,18,0.18)] backdrop-blur-md p-6">
            <h3 className="text-sm font-serif font-bold text-rose-900 tracking-widest uppercase mb-8">Incident Types</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="count"
                  >
                    {typeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', opacity: 0.6 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>


        {/* Content Table */}
        <div className="bg-white border border-rose-100 rounded-[40px] shadow-2xl overflow-hidden mb-12">
          <div className="px-10 py-10 flex flex-col sm:flex-row justify-between items-center gap-6 border-b border-rose-100 bg-rose-50/60">
            <div>
               <h3 className="text-2xl font-serif font-bold text-rose-950 tracking-tight">Active Submissions</h3>
               <p className="text-rose-700/60 text-xs mt-1 font-medium tracking-wide">Reviewing {incidents?.total ?? 0} total crowd-sourced reports</p>
            </div>
            
            <div className="flex gap-4">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-700/40" />
                 <Input 
                   placeholder="Global search..." 
                   className="pl-10 w-64 bg-white border-rose-200 text-rose-950 text-xs h-12 rounded-2xl focus:border-rose-400 focus:ring-0 placeholder:text-rose-700/25"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                 />
               </div>
               <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
                  <SelectTrigger className="w-44 bg-white border-rose-200 text-rose-700 text-xs h-12 rounded-2xl">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-rose-100 text-rose-950 shadow-xl">
                    <SelectItem value="all">All Categories</SelectItem>
                    {["harassment", "assault", "stalking", "theft", "unsafe_area", "other"].map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
               <Select value={filterSeverity} onValueChange={(v) => { setFilterSeverity(v); setPage(1); }}>
                  <SelectTrigger className="w-36 bg-white border-rose-200 text-rose-700 text-xs h-12 rounded-2xl">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-rose-100 text-rose-950 shadow-xl">
                    <SelectItem value="all">All Severity</SelectItem>
                    {[
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                      { value: "critical", label: "Critical" },
                    ].map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
               <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-36 bg-white border-rose-200 text-rose-700 text-xs h-12 rounded-2xl">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-rose-100 text-rose-950 shadow-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    {[
                      { value: "pending", label: "Pending" },
                      { value: "verified", label: "Verified" },
                      { value: "resolved", label: "Resolved" },
                      { value: "dismissed", label: "Dismissed" },
                    ].map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
               </Select>
            </div>
          </div>

          {selectedIncidents.size > 0 && activeTab === 'reports' && (
            <div className="px-10 py-4 bg-rose-950 text-white flex items-center justify-between animate-in slide-in-from-top duration-300">
               <div className="flex items-center gap-4">
                  <CheckSquare className="w-5 h-5 text-rose-300" />
                  <span className="font-bold text-sm">{selectedIncidents.size} reports selected</span>
               </div>
               <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    className="text-white hover:bg-rose-900 border border-rose-800 rounded-xl px-4 py-1 h-9 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => setSelectedIncidents(new Set())}
                  >
                    Clear
                  </Button>
                  <Button 
                    className="bg-emerald-500 hover:bg-emerald-600 text-white border-none rounded-xl px-4 py-1 h-9 text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95"
                    onClick={() => handleBulkAction('verified')}
                  >
                    Bulk Verify
                  </Button>
                  <Button 
                    className="bg-rose-500 hover:bg-rose-600 text-white border-none rounded-xl px-4 py-1 h-9 text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95"
                    onClick={() => handleBulkAction('dismissed')}
                  >
                    Bulk Dismiss
                  </Button>
               </div>
            </div>
          )}

          {activeTab === 'audit' ? (
            <div className="p-0">
               <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-rose-100 text-rose-700/60 uppercase tracking-[0.2em] text-[9px] font-black">
                      <th className="px-10 py-6">Timestamp</th>
                      <th className="px-10 py-6">Moderator</th>
                      <th className="px-10 py-6">Action</th>
                      <th className="px-10 py-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                     {auditLogsQuery.data?.logs.map((log: any) => (
                       <tr key={log.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="px-10 py-6 text-xs text-rose-800 font-mono">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-700">
                                   {log.actorName.charAt(0)}
                                </div>
                                <span className="text-xs font-bold text-rose-950">{log.actorName}</span>
                             </div>
                          </td>
                          <td className="px-10 py-6">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 px-2 py-1 rounded-md border border-rose-100">
                               {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-10 py-6 text-xs text-rose-800/70 italic">
                             {log.details}
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-rose-100 text-rose-700/60 uppercase tracking-[0.2em] text-[9px] font-black">
                  <th className="px-10 py-6">
                     <button onClick={() => {
                        if (selectedIncidents.size === incidents?.incidents.length) setSelectedIncidents(new Set());
                        else setSelectedIncidents(new Set(incidents?.incidents.map((i:any) => i.id)));
                     }}>
                        {selectedIncidents.size === incidents?.incidents.length && incidents?.incidents.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                     </button>
                  </th>
                  <th className="px-10 py-6">SLA Status</th>
                  <th className="px-10 py-6">Evidence / Confidence</th>
                  <th className="px-10 py-6">Type & Description</th>
                  <th className="px-10 py-6">Priority</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6 text-right">Moderation Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                 {incidents?.incidents.map((incident: any) => {
                   const sla = getSLATimer(incident.submittedAt);
                   const evidence = getEvidenceQuality(incident.evidenceScore || 0);
                   return (
                   <tr key={incident.id} className={`group hover:bg-rose-50 transition-all duration-300 ${incident.status === 'pending' ? 'bg-rose-50/70' : ''} ${selectedIncidents.has(incident.id) ? 'bg-rose-100/50' : ''}`}>
                      <td className="px-10 py-8">
                         <button onClick={() => toggleSelection(incident.id)}>
                            {selectedIncidents.has(incident.id) ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4 text-rose-300" />}
                         </button>
                      </td>
                      <td className="px-10 py-8">
                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${sla.color}`}>
                            <AlertCircle className="w-3 h-3" />
                            Age: {sla.label}
                         </div>
                      </td>
                      <td className="px-10 py-8">
                         <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${evidence.color}`}></div>
                               <span className="text-[10px] font-black uppercase tracking-tight text-rose-950">AI Trust: {incident.evidenceScore}%</span>
                            </div>
                            <div className="w-24 h-1 bg-rose-100 rounded-full overflow-hidden">
                               <div className={`h-full ${evidence.color}`} style={{ width: `${incident.evidenceScore}%` }}></div>
                            </div>
                            <span className="text-[9px] text-rose-700/50 uppercase font-medium">{evidence.label} Quality Evidence</span>
                         </div>
                      </td>
                      <td className="px-10 py-8 max-w-sm">
                        <div className="flex items-center gap-2 mb-2">
                        <span className="text-rose-950 font-serif font-black capitalize text-base tracking-tight">{incident.incidentType}</span>
                        <span className="w-1 h-1 rounded-full bg-rose-300"></span>
                        <span className="text-rose-700/50 text-[10px] uppercase font-bold tracking-tighter">{new Date(incident.submittedAt).toLocaleDateString()}</span>
                        </div>
                      <p className="text-rose-800/70 text-xs leading-relaxed line-clamp-2 italic">{incident.description}</p>
                      </td>
                      <td className="px-10 py-8">
                         <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-sm ${
                            incident.severity === 'critical' ? 'bg-rose-500 text-white shadow-rose-500/20' :
                            incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                         'bg-rose-100 text-rose-700'
                         }`}>
                           {incident.severity}
                         </div>
                      </td>
                      <td className="px-10 py-8">
                         <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                           incident.status === 'verified' ? 'text-emerald-600' :
                           incident.status === 'pending' ? 'text-rose-600 flex items-center gap-2' :
                           'text-rose-700/45'
                            }`}>
                               {incident.status === 'pending' && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_5px_rose]"></span>}
                               {incident.status}
                            </span>
                           {incident.status === 'pending' && (
                            <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.12em] bg-amber-100 text-amber-800 border border-amber-200">
                              Pending Review
                            </span>
                           )}
                         <span className="text-[9px] text-rose-700/30 uppercase font-medium">History Logged</span>
                         </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                           {incident.status === 'pending' ? (
                              <div className="flex gap-2">
                                <Button 
                                  className="bg-rose-950 text-white hover:bg-rose-900 font-black text-[10px] uppercase tracking-widest px-6 h-12 rounded-2xl shadow-2xl transition-all active:scale-95"
                                  onClick={() => applyStatusUpdate(incident.id, 'verified', 'Verified and published by moderator')}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  Verify
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-rose-200 text-rose-700 hover:text-rose-950 hover:bg-rose-50 rounded-2xl px-5 h-12 text-[10px] font-black uppercase tracking-widest"
                                  onClick={() => applyStatusUpdate(incident.id, 'dismissed', 'Dismissed after moderator review')}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  Dismiss
                                </Button>
                              </div>
                           ) : incident.status === 'verified' ? (
                              <div className="flex gap-2">
                                 <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-emerald-200 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => applyStatusUpdate(incident.id, 'resolved', 'Resolved by moderator follow-up')}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    Mark Resolved
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-rose-200 text-rose-700 hover:text-rose-950 hover:bg-rose-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => applyStatusUpdate(incident.id, 'dismissed', 'Dismissed after re-evaluation')}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    Dismiss
                                  </Button>
                              </div>
                           ) : incident.status === 'resolved' ? (
                              <div className="flex gap-2">
                                 <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-rose-200 text-rose-700 hover:text-rose-950 hover:bg-rose-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => applyStatusUpdate(incident.id, 'dismissed', 'Dismissed after resolution review')}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    Dismiss
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-rose-200 text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => {
                                      setEditingIncident(incident);
                                      setEditForm({
                                        description: incident.description,
                                        latitude: incident.latitude,
                                        longitude: incident.longitude
                                      });
                                    }}
                                  >
                                    Analyze
                                  </Button>
                              </div>
                           ) : (
                              <div className="flex gap-2">
                                 <Button 
                                    variant="outline" 
                                    size="sm"
                              className="border-emerald-200 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => applyStatusUpdate(incident.id, 'verified', 'Re-verified by moderator')}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    Re-Verify
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                              className="border-rose-200 text-rose-700/65 hover:text-rose-950 hover:bg-rose-50 rounded-xl px-4 h-10 text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => {
                                      setEditingIncident(incident);
                                      setEditForm({
                                        description: incident.description,
                                        latitude: incident.latitude,
                                        longitude: incident.longitude
                                      });
                                    }}
                                  >
                                    Analyze
                                  </Button>
                              </div>
                           )}
                          <div className="w-[1px] h-6 bg-rose-100 mx-1"></div>
                           <Button 
                              variant="ghost" 
                            className="w-12 h-12 rounded-full text-rose-700/50 hover:text-rose-950 hover:bg-rose-50 transition-colors"
                              onClick={() => {
                                setEditingIncident(incident);
                                setEditForm({
                                  description: incident.description,
                                  latitude: incident.latitude,
                                  longitude: incident.longitude
                                });
                              }}
                           >
                              <Edit className="w-5 h-5" />
                           </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

          <div className="px-10 py-10 bg-rose-50/60 border-t border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <p className="text-rose-700/55 text-xs font-bold uppercase tracking-widest">Systems Stable</p>
                 <div className="h-4 w-[1px] bg-rose-100"></div>
                 <p className="text-rose-700/55 text-xs font-medium">Page {page} of {incidents ? Math.ceil(incidents.total / 20) : 1}</p>
              </div>
              
              <div className="flex gap-4">
                 <Button 
                   onClick={() => setPage(page - 1)} 
                   disabled={page === 1}
                   variant="ghost" 
                   className="text-rose-700/55 hover:text-rose-950 hover:bg-transparent rounded-full px-8 h-10 text-[10px] font-black uppercase tracking-widest"
                 >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                 </Button>
                 <Button 
                   onClick={() => setPage(page + 1)} 
                   disabled={!incidents || page >= Math.ceil(incidents.total / 20)}
                   className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-950 hover:text-white font-black px-10 h-10 rounded-full text-[10px] uppercase tracking-widest transition-all"
                 >
                    Next Horizon
                    <ChevronRight className="w-4 h-4 ml-2" />
                 </Button>
              </div>
          </div>
        </div>
      </main>

      {/* Modern Dialog Styles for Editing */}
      {editingIncident && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-rose-950/20 backdrop-blur-3xl transition-opacity animate-in fade-in" onClick={() => setEditingIncident(null)}></div>
           <Card className="relative w-full max-w-2xl bg-white border border-rose-100 text-rose-950 shadow-2xl p-8 rounded-[40px] animate-in zoom-in-95 duration-300">
              <h2 className="text-2xl font-serif font-black mb-1">Verify Intelligence</h2>
              <p className="text-rose-700/55 text-xs uppercase tracking-widest mb-8">Incident Record #{editingIncident.id}</p>

              {incidentMedia.length > 0 && (
                <div className="mb-8">
                  <p className="text-[10px] uppercase tracking-widest text-rose-700/55 font-bold ml-1 mb-3">Attached Media</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-auto pr-1">
                    {incidentMedia.map((mediaUrl: string, index: number) => {
                      const isVideo = /\.(mp4|webm|mov|avi)(\?|#|$)/i.test(mediaUrl);
                      return (
                        <div key={`${mediaUrl}-${index}`} className="rounded-2xl border border-rose-100 bg-rose-50 overflow-hidden shadow-sm">
                          {isVideo ? (
                            <video controls className="w-full h-40 object-cover bg-black">
                              <source src={mediaUrl} />
                            </video>
                          ) : (
                            <img src={mediaUrl} alt={`Incident attachment ${index + 1}`} className="w-full h-40 object-cover" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-rose-700/55 font-bold ml-1">Context Analysis</p>
                  <textarea 
                    className="w-full h-40 bg-white border border-rose-200 rounded-3xl p-6 text-rose-950 text-sm focus:border-rose-400 focus:ring-0 resize-none transition-all"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-rose-700/55 font-bold ml-1">Latitude</p>
                      <Input 
                        value={editForm.latitude}
                        onChange={(e) => setEditForm({...editForm, latitude: parseFloat(e.target.value)})}
                        className="bg-white border border-rose-200 rounded-2xl h-12 text-rose-950 text-sm focus:border-rose-400"
                      />
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-rose-700/55 font-bold ml-1">Longitude</p>
                      <Input 
                        value={editForm.longitude}
                        onChange={(e) => setEditForm({...editForm, longitude: parseFloat(e.target.value)})}
                        className="bg-white border border-rose-200 rounded-2xl h-12 text-rose-950 text-sm focus:border-rose-400"
                      />
                   </div>
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                 <Button 
                   variant="ghost" 
                   onClick={() => setEditingIncident(null)}
                   className="flex-1 text-rose-700/60 hover:text-rose-950"
                 >
                   Discard Changes
                 </Button>
                 <Button 
                    className="flex-1 bg-rose-950 text-white font-black uppercase tracking-widest h-14 rounded-3xl hover:bg-rose-900 transition-all shadow-xl"
                    onClick={() => editIncidentMutation.mutate({ incidentId: editingIncident.id, ...editForm })}
                    disabled={editIncidentMutation.isPending}
                 >
                    Commit Intelligence
                 </Button>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
}
