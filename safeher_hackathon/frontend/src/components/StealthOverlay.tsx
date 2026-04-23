import { useState, useEffect } from "react";
import { Menu, Search, Share2, MessageCircle, Clock, ChevronRight, Globe, TrendingUp } from "lucide-react";
import { useStealth } from "@/contexts/StealthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function StealthOverlay() {
  const { isStealthMode, setStealthMode } = useStealth();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const createIncident = trpc.incidents.submit.useMutation({
    onSuccess: () => {
      // Silent success - no visual indicator except maybe a small fake "Article Shared" toast
      console.log("Silent SOS sent successfully");
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Escape mechanism: Triple-click logo
  const [clickCount, setClickCount] = useState(0);
  const [lastClick, setLastClick] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClick < 400) {
      const nextCount = clickCount + 1;
      setClickCount(nextCount);
      if (nextCount >= 2) { // 3 clicks total (0, 1, 2)
        setStealthMode(false);
        toast.info("Safety Mode Restored");
      }
    } else {
      setClickCount(1);
    }
    setLastClick(now);
  };

  if (!isStealthMode) return null;

  const handleSilentSOS = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        createIncident.mutate({
          incidentType: "other",
          description: "SILENT ALERT: User triggered SOS from Stealth Mode disguise.",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          severity: "high",
          reporterAlias: "Stealth Guardian",
          reportedAt: new Date()
        });
        toast.success("Article shared with your network", { duration: 2000 });
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white text-slate-900 flex flex-col font-sans overflow-y-auto animate-in fade-in duration-500">
      {/* News Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setStealthMode(false)}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            title="Switch back to SafeHer"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <div 
            className="flex flex-col select-none cursor-pointer active:opacity-70 transition-opacity"
            onClick={handleLogoClick}
          >
            <h1 className="text-xl font-serif font-black tracking-tighter text-blue-900 uppercase italic">
              Daily News <span className="text-red-600">India</span>
            </h1>
            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 -mt-1">Truth in Information</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Search className="w-5 h-5 text-slate-500" />
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
            JS
          </div>
        </div>
      </header>

      {/* Breaking News Ticker */}
      <div className="bg-red-600 text-white px-4 py-1.5 flex items-center gap-3 overflow-hidden">
        <span className="text-[10px] font-black uppercase tracking-widest bg-white text-red-600 px-1.5 py-0.5 rounded">Live</span>
        <div className="text-xs font-bold whitespace-nowrap animate-marquee">
          Market Indices reach all-time high • Weather update: Monsoon predicted early in Mumbai • Sports: National team wins series
        </div>
      </div>

      <main className="flex-1 pb-10">
        {/* Featured Story */}
        <section className="p-4 border-b border-slate-100">
          <div className="relative rounded-xl overflow-hidden aspect-video mb-4 bg-slate-200">
             <img 
               src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=1000" 
               alt="Digital Innovation" 
               className="w-full h-full object-cover grayscale-[0.2]"
             />
             <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded">Technology</div>
          </div>
          <h2 className="text-2xl font-serif font-bold leading-tight mb-3 text-slate-900">
            India's Digital Transformation Accelerates with New Infrastructure Push
          </h2>
          <div className="flex items-center gap-3 text-slate-500 text-xs mb-4">
            <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 12 mins ago</div>
            <div className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> National Desk</div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            New policies aiming to bridge the digital divide are showing early success across rural sectors, enabling small-scale entrepreneurs to compete on a global stage...
          </p>
          <div className="flex items-center justify-between border-t border-slate-50 pt-4">
             <div className="flex gap-4">
                <Share2 className="w-4 h-4 text-slate-400" />
                <MessageCircle className="w-4 h-4 text-slate-400" />
             </div>
             <button className="text-blue-600 text-xs font-bold flex items-center gap-1">
               Full Coverage <ChevronRight className="w-3 h-3" />
             </button>
          </div>
        </section>

        {/* Silent SOS Trigger Story */}
        <section 
          className="p-4 bg-slate-50 border-b border-slate-200 active:bg-slate-100 transition-colors"
          onClick={handleSilentSOS}
        >
          <div className="flex gap-4">
             <div className="flex-1">
                <div className="text-red-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Breaking Now
                </div>
                <h3 className="font-bold text-base leading-snug text-slate-900">
                  Emergency Protocols: What You Need to Know in Modern Urban Environments
                </h3>
                <p className="text-slate-500 text-xs mt-2 italic">Tap to view regional safety guide...</p>
             </div>
             <div className="w-24 h-24 rounded-lg bg-slate-300 flex-shrink-0 overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=400" 
                  alt="Protocol" 
                  className="w-full h-full object-cover"
                />
             </div>
          </div>
        </section>

        {/* Regular News Items */}
        {[
          { cat: "Business", title: "Start-ups see resurgence in venture capital interest", time: "1h ago" },
          { cat: "Wellness", title: "5 holistic habits to improve mental clarity daily", time: "3h ago" },
          { cat: "Climate", title: "New solar initiative to power 10,000 villages", time: "5h ago" }
        ].map((item, i) => (
          <section key={i} className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="max-w-[70%]">
               <span className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">{item.cat}</span>
               <h4 className="font-bold text-sm text-slate-800 leading-tight">{item.title}</h4>
               <span className="text-[10px] text-slate-400 mt-2 block">{item.time}</span>
            </div>
            <div className="w-16 h-16 rounded bg-slate-100 flex-shrink-0"></div>
          </section>
        ))}
      </main>

      <footer className="p-8 bg-slate-900 text-slate-400 text-center">
         <div className="text-xl font-serif font-black tracking-tighter text-white uppercase italic mb-4">
            Daily News <span className="text-red-500">India</span>
         </div>
         <p className="text-[10px] uppercase tracking-[0.3em] font-medium mb-6">Verified Information Hub</p>
         <div className="flex justify-center gap-6 text-xs font-bold uppercase tracking-widest mb-8">
            <span>Politics</span>
            <span>Tech</span>
            <span>Life</span>
         </div>
         <p className="text-[9px] opacity-40">© 2026 Daily News India Media Group. All rights reserved.</p>
         <p className="text-[9px] opacity-40 mt-1">Edition: New Delhi • {currentTime.toLocaleDateString()}</p>
         <p className="text-[8px] opacity-20 mt-4 italic font-sans">[Tip: Triple-tap the header logo to return to Safety Portal]</p>
      </footer>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
