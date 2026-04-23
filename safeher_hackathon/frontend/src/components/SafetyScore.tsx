import { trpc } from "@/lib/trpc";
import { Shield, AlertCircle, CheckCircle } from "lucide-react";

export function SafetyScore() {
  const { data: stats, isLoading } = trpc.incidents.stats.useQuery();

  if (isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-white/20 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-white/20 rounded w-2/3"></div>
      </div>
    );
  }

  const incidentCount = stats?.totalIncidents ?? 0;
  const isSafe = (stats?.highSeverityCount ?? 0) === 0;

  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-all hover:border-rose-300 group">
      <div className="flex items-center justify-between mb-6">
        <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 group-hover:bg-rose-100 transition-colors">
          <Shield className="w-8 h-8 text-rose-600" />
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Live Status</p>
          <div className="flex items-center gap-2 justify-end">
             <div className={`w-2 h-2 rounded-full animate-pulse ${isSafe ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
             <span className="text-rose-950 font-medium">{isSafe ? 'Stable' : 'Caution'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-rose-950 text-3xl font-serif font-bold mb-1">
            {isSafe ? "Community is Secure" : "Heightened Awareness"}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {isSafe 
              ? "No critical incidents verified in the last 48 hours. Continue looking out for each other."
              : `Caution advised. ${stats?.highSeverityCount} high-severity incidents verified recently.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-rose-100">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-rose-950 font-bold text-lg leading-tight">{incidentCount}</p>
              <p className="text-gray-500 text-xs uppercase font-medium">Reports</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-5 h-5 ${isSafe ? 'text-gray-300' : 'text-amber-500'}`} />
            <div>
              <p className="text-rose-950 font-bold text-lg leading-tight">{stats?.highSeverityCount ?? 0}</p>
              <p className="text-gray-500 text-xs uppercase font-medium">Alerts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
