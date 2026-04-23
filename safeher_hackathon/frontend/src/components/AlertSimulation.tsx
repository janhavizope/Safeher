import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, Navigation } from "lucide-react";

export function AlertSimulation() {
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    // Delay of 12 seconds to simulate a user walking/browsing before a geofence trigger
    const timer = setTimeout(() => {
      if (!hasTriggered) {
        triggerAlert();
        setHasTriggered(true);
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [hasTriggered]);

  const triggerAlert = () => {
    toast.custom((t) => (
      <div className="bg-red-600 text-white p-6 rounded-2xl shadow-2xl border-4 border-red-500 animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col gap-4 max-w-sm w-full">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-full animate-pulse">
                <ShieldAlert className="w-6 h-6 text-white" />
             </div>
             <div>
                <h4 className="font-bold text-lg leading-none">SafeHer GEOFENCE ALERT</h4>
                <p className="text-red-100/80 text-xs mt-1 font-medium tracking-wide">CRITICAL SECURITY UPDATE</p>
             </div>
          </div>
          <button onClick={() => toast.dismiss(t)} className="text-white/60 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        
        <div className="bg-red-700/50 rounded-xl p-4 border border-white/10">
          <p className="text-sm font-medium">
            Multiple high-severity incidents reported within <span className="underline decoration-white/40">500m</span> of your live location. 
          </p>
        </div>

        <div className="flex gap-2">
           <button 
             onClick={() => window.location.href = "/map"}
             className="flex-1 bg-white text-red-600 font-bold py-3 rounded-xl text-sm hover:bg-stone-100 transition-colors flex items-center justify-center gap-2"
           >
             <Navigation className="w-4 h-4" />
             View Risk Map
           </button>
           <button 
             onClick={() => toast.dismiss(t)}
             className="px-4 py-3 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-400 transition-colors"
           >
             Dismiss
           </button>
        </div>
      </div>
    ), {
      duration: 15000,
      position: 'bottom-right'
    });
  };

  return null; // This component doesn't render anything directly, it strictly handles the toast simulation
}
