import { useAuth } from "@/_core/hooks/useAuth";
import { CircularText } from "@/components/CircularText";

import { Button } from "@/components/ui/button";
import { AlertCircle, MapPin, Shield, EyeOff, LayoutDashboard, Cpu, Navigation } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, type CSSProperties } from "react";
import { SafetyScore } from "@/components/SafetyScore";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSafetySentinel } from "@/contexts/SafetySentinel";
import { Mic, Activity, Users, ShieldCheck, Share2, HeartPulse, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { attemptAdminPasscode, getAdminAuthSnapshot } from "@shared/adminAuth";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminLockState, setAdminLockState] = useState(() => getAdminAuthSnapshot(window.localStorage));
  const { loudness, isMonitoring, setMonitoring, isListening } = useSafetySentinel();
  const [lastTap, setLastTap] = useState(0);
  const [tapCount, setTapCount] = useState(0);

  const toggleVolunteer = trpc.safety.toggleVolunteer.useMutation({
    onSuccess: () => toast.success("Support status updated!")
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const revealElements = document.querySelectorAll<HTMLElement>(".reveal-on-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Secret Shortcut: Windows/Alt + Shift + J + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Robust detection: Alt + Shift + J + A
      const isAltShift = (e.altKey || e.metaKey) && e.shiftKey;
      if (isAltShift && e.key.toLowerCase() === 'j') {
        const checkBoth = (nextEvent: KeyboardEvent) => {
           if (nextEvent.key.toLowerCase() === 'a') {
              nextEvent.preventDefault();
              setShowAdminLogin(true);
              window.removeEventListener('keydown', checkBoth);
           }
        };
        window.addEventListener('keydown', checkBoth, { once: true });
        setTimeout(() => window.removeEventListener('keydown', checkBoth), 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const result = attemptAdminPasscode(window.localStorage, adminCode);
    setAdminLockState(result.snapshot);

    if (result.status === "success") {
      setLocation("/admin");
      toast.success("Moderator Access Granted");
    } else if (result.status === "locked") {
      const lockMinutes = Math.ceil(result.snapshot.remainingLockMs / 60000);
      toast.error(`Too many failed attempts. Try again in ${lockMinutes} minute${lockMinutes === 1 ? "" : "s"}.`);
    } else {
      toast.error("Invalid Secret Access Code");
    }

    setAdminCode("");
  };

  useEffect(() => {
    if (!adminLockState.isLocked) return;

    const timeout = window.setTimeout(() => {
      setAdminLockState(getAdminAuthSnapshot(window.localStorage));
    }, adminLockState.remainingLockMs + 1000);

    return () => window.clearTimeout(timeout);
  }, [adminLockState.isLocked, adminLockState.remainingLockMs]);


  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white border-b border-gray-100 shadow-sm py-4" : "bg-transparent py-6"}`}>
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <h1 className={`text-2xl font-serif font-bold ${scrolled ? "text-rose-950" : "text-white"}`}>SafeHer.</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#problem" className={`text-sm font-medium hover:opacity-75 ${scrolled ? "text-gray-600" : "text-gray-200"}`}>Problem</a>
            <a href="#features" className={`text-sm font-medium hover:opacity-75 ${scrolled ? "text-gray-600" : "text-gray-200"}`}>Features</a>
            <a href="#how-it-works" className={`text-sm font-medium hover:opacity-75 ${scrolled ? "text-gray-600" : "text-gray-200"}`}>How It Works</a>
            <a href="#impact" className={`text-sm font-medium hover:opacity-75 ${scrolled ? "text-gray-600" : "text-gray-200"}`}>Impact</a>
            <Button 
              onClick={() => setLocation("/report")} 
              className={`rounded-xl px-6 py-5 ${scrolled ? "bg-rose-950 hover:bg-rose-900 text-white" : "bg-white/90 hover:bg-white text-rose-950"}`}
            >
              Report Anonymously
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 hero-live-bg" aria-hidden="true">
            {/* Circular Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 mt-[-5vh]">
              <CircularText 
                text="या देवी सर्वभूतेषु शक्तिरूपेण संस्थिता। नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः॥ " 
                className="w-[90vh] h-[90vh] text-stone-200/60 font-serif tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                speed={40}
              />
            </div>

            <img src="/hero-durga.png" alt="Durga Silhouette Background" className="hero-custom-blend hero-goddess-layer-anim" />
            <div className="hero-live-gradient"></div>
            {/* Petals removed as per user request to clean up 'stars' */}
          </div>
          <div className="absolute inset-0 bg-stone-950/30 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950/90"></div>
          <div className="absolute inset-0 hero-light-sweep"></div>
          <div className="absolute inset-0 hero-vignette" aria-hidden="true"></div>
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mt-20">
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-serif text-white font-semibold mb-6 tracking-tight drop-shadow-md hero-fade-up hero-delay-1 hero-title-premium">
              SafeHer
            </h1>
            <h2 className="text-2xl md:text-3xl text-white/90 font-medium mb-4 hero-fade-up hero-delay-2">
              Anonymous Incident Reporting & Safety Mapping System
            </h2>
            <p className="hero-tagline-premium text-sm md:text-base text-rose-100/85 mb-6 hero-fade-up hero-delay-3">
              Private. Trusted.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap hero-fade-up hero-delay-5 mt-12">
              <Button size="lg" onClick={() => setLocation("/report")} className="hero-cta-elevate bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-7 text-lg rounded-2xl h-auto font-bold shadow-xl backdrop-blur-md transition-all hover:scale-105">
                <MapPin className="w-5 h-5 mr-3" />
                Report Incident
              </Button>
              <Button size="lg" onClick={() => setLocation("/community")} className="hero-cta-elevate bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-7 text-lg rounded-2xl h-auto font-bold shadow-xl backdrop-blur-md transition-all hover:scale-105">
                <Users className="w-5 h-5 mr-3" />
                Sisterhood Hub
              </Button>
              <Button size="lg" onClick={() => setLocation("/map")} className="hero-cta-elevate bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-7 text-lg rounded-2xl h-auto font-bold shadow-xl backdrop-blur-md transition-all hover:scale-105">
                <EyeOff className="w-5 h-5 mr-3" />
                Safety Map
              </Button>
            </div>
            
            <div className="flex justify-center gap-6 mt-8 hero-fade-up hero-delay-6">
               <button onClick={() => setLocation("/track")} className="text-white/60 hover:text-white text-sm font-medium flex items-center gap-2">
                 <AlertCircle className="w-4 h-4" /> Track Status
               </button>
               <button onClick={() => setLocation("/route")} className="text-white/60 hover:text-white text-sm font-medium flex items-center gap-2">
                 <Navigation className="w-4 h-4" /> Safe Routing
               </button>
            </div>
            
            <div className="absolute bottom-6 left-1/2 flex flex-col items-center text-white/50 hero-scroll-cue">
              <span className="text-[10px] uppercase tracking-[0.2em] mb-3 font-medium">Scroll to explore</span>
              <svg className="w-6 h-6 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </section>




      {/* Community Pulse Section - Seamless Transition */}
      <section className="py-20 bg-gradient-to-b from-stone-50 to-white border-t border-rose-100 relative z-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-10 bg-white backdrop-blur-xl rounded-[2.5rem] p-6 border border-rose-100 shadow-xl overflow-hidden">
                <div className="flex-1 p-4 md:p-8 text-left">
                  <h2 className="text-3xl font-serif font-bold text-rose-950 mb-4">Community Pulse</h2>
                  <p className="text-gray-600 text-base mb-8 leading-relaxed">
                    Live monitoring of verified incident reports across the network. Built on our Aiven-hosted identity layer, ensuring your safety information is always up to date.
                  </p>
                  <div className="flex gap-8">
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-rose-950">24/7</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Monitoring</span>
                    </div>
                    <div className="w-px h-10 bg-rose-200"></div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-rose-950">100%</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Anonymous</span>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-[420px] bg-rose-50 p-2 rounded-[2rem] border border-rose-100">
                  <SafetyScore />
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section id="problem" className="py-24 bg-white relative overflow-hidden section-ambient-wrap">
        <div className="section-ambient section-ambient-problem" aria-hidden="true"></div>
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-center text-6xl font-serif font-bold text-gray-900 mb-12 reveal-on-scroll heading-shine" style={{ "--reveal-delay": "90ms" } as CSSProperties}>The Problem</h2>
          
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="bg-stone-50 rounded-2xl p-8 mb-16 text-gray-600 text-lg leading-relaxed italic border border-stone-100 text-writing-reveal reveal-on-scroll" style={{ "--reveal-delay": "180ms" } as CSSProperties}>
                A large number of harassment and safety-related incidents go unreported due to fear, stigma, or lack of anonymity.
              </div>
              
              <div className="mt-12 space-y-8 border-l-4 border-rose-900 pl-8 ml-2">
                <h3 className="text-9xl font-serif text-black font-bold tracking-tighter leading-none">70%</h3>
                <p className="text-3xl font-serif text-black leading-snug max-w-lg">
                  Every day in India, 70% of women <br /> experience harassment in public spaces.
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                  Source: UN Women, 2023 — Safety Facts & Figures
                </p>
              </div>
            </div>
            
            <div className="space-y-4 pt-12">
              {[
                { icon: AlertCircle, text: "Fear of retaliation or social stigma" },
                { icon: EyeOff, text: "No anonymity in existing reporting channels" },
                { icon: MapPin, text: "No map or visibility of unsafe zones" },
                { icon: LayoutDashboard, text: "Authorities lack data to act effectively" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-6 bg-stone-50 p-6 rounded-2xl border border-stone-100 problem-card-reveal reveal-on-scroll" style={{ "--reveal-delay": `${260 + i * 120}ms` } as CSSProperties}>
                  <div className="bg-rose-100 p-3 rounded-xl flex-shrink-0">
                    <item.icon className="w-6 h-6 text-rose-900" />
                  </div>
                  <span className="text-lg text-gray-700 font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="py-24 relative overflow-hidden bg-white section-ambient-wrap">
        {/* Subtle background decoration */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-50/50 via-white to-white pointer-events-none"></div>
        <div className="section-ambient section-ambient-features" aria-hidden="true"></div>
        
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center mb-20 reveal-on-scroll" style={{ "--reveal-delay": "90ms" } as CSSProperties}>
            <h2 className="text-6xl font-serif font-bold text-gray-900 mb-6 heading-shine">Key Features</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto text-writing-reveal reveal-on-scroll" style={{ "--reveal-delay": "220ms" } as CSSProperties}>Everything you need for secure, anonymous incident reporting and community safety awareness.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Shield,
                title: "Anonymous Reporting Interface",
                desc: "Secure login with alias-based identity. Users submit incidents under a protected name — real data is encrypted and never visible to others."
              },
              {
                icon: MapPin,
                title: "Geo-Tagging of Incidents",
                desc: "GPS-based or manual pin-drop location tagging ensures each report is spatially accurate and mapped instantly."
              },
              {
                icon: Cpu,
                title: "Automated Categorization",
                desc: "Smart classification organizes reports by type (harassment, stalking, unsafe zones) to maintain well-structured safety datasets."
              },
              {
                icon: LayoutDashboard,
                title: "Real-Time Safety Map",
                desc: "A live community dashboard visualizes unsafe areas, generating heatmaps to alert others to exercise caution."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl border border-rose-100 shadow-[0_4px_40px_-12px_rgba(200,100,120,0.1)] hover:border-rose-200 hover:shadow-[0_8px_40px_-12px_rgba(200,100,120,0.2)] transition-all duration-300 reveal-on-scroll feature-card-premium" style={{ "--reveal-delay": `${180 + i * 120}ms` } as CSSProperties}>
                <div className="bg-rose-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-8">
                  <feature.icon className="w-8 h-8 text-rose-950" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed text-lg">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white border-t border-rose-50 relative overflow-hidden section-ambient-wrap">
        <div className="section-ambient section-ambient-how" aria-hidden="true"></div>
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-20 reveal-on-scroll" style={{ "--reveal-delay": "100ms" } as CSSProperties}>
            <h2 className="text-6xl font-serif font-bold text-gray-900 mb-6 heading-shine">How It Works</h2>
            <p className="text-xl text-gray-500 text-writing-reveal reveal-on-scroll" style={{ "--reveal-delay": "240ms" } as CSSProperties}>From incident to community awareness in 5 simple steps.</p>
          </div>
          
          <div className="relative">
            {/* Center Line */}
            <div className="absolute left-[20px] md:left-1/2 top-4 bottom-4 w-px bg-rose-200 -translate-x-1/2 timeline-line-pulse"></div>
            
            {[
              { step: "01", title: "Incident Occurs", desc: "User experiences or witnesses a safety threat.", icon: AlertCircle },
              { step: "02", title: "Open SafeHer", desc: "User opens the app, completely anonymous and secure.", icon: Shield },
              { step: "03", title: "Tag & Submit", desc: "Select type, confirm location via GPS, submit under your alias.", icon: MapPin },
              { step: "04", title: "Data Processed", desc: "Backend clusters reports, updates heatmap in real time.", icon: Cpu },
              { step: "05", title: "Community Safe", desc: "Other users are aware of the zone, boosting collective safety.", icon: EyeOff }
            ].map((item, i) => (
              <div key={i} className={`relative flex items-center mb-16 last:mb-0 reveal-on-scroll ${i % 2 === 0 ? "md:justify-start" : "md:justify-end"}`} style={{ "--reveal-delay": `${170 + i * 130}ms` } as CSSProperties}>
                
                {/* Timeline Dot */}
                <div className="absolute left-[20px] md:left-1/2 w-3 h-3 bg-rose-950 rounded-full -translate-x-1/2 z-10 border-4 border-white box-content timeline-dot-pulse"></div>
                
                {/* Content Card */}
                <div className={`ml-[60px] md:ml-0 md:w-[45%] ${i % 2 === 0 ? "md:pr-12" : "md:pl-12"}`}>
                  <div className="bg-stone-50 border border-stone-100 p-8 rounded-3xl timeline-card-premium">
                    <div className="bg-rose-100 inline-block p-4 rounded-2xl mb-6">
                      <item.icon className="w-6 h-6 text-rose-800" />
                    </div>
                    <p className="text-rose-950 font-bold text-sm tracking-widest mb-3 uppercase">STEP {item.step}</p>
                    <h3 className="text-3xl font-serif font-bold text-gray-900 mb-4">{item.title}</h3>
                    <p className="text-gray-600 text-lg">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 text-center reveal-on-scroll" style={{ "--reveal-delay": "120ms" } as CSSProperties}>
          <p className="text-gray-400 font-medium">&copy; 2026 SafeHer. Built for community safety.</p>
        </div>
      </footer>

      {/* Premium Moderator Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-xl transition-opacity animate-in fade-in duration-500" onClick={() => setShowAdminLogin(false)}></div>
          <Card className="relative w-full max-w-sm bg-rose-950/90 border border-white/10 text-white shadow-2xl animate-in zoom-in-95 duration-300">
             <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                   <Shield className="w-6 h-6 text-rose-300" />
                </div>
                <CardTitle className="text-xl font-serif font-bold text-white uppercase tracking-[0.2em]">Private Access</CardTitle>
                <CardDescription className="text-white/40 text-xs">Access Restricted to SafeHer Moderator Authority.</CardDescription>
             </CardHeader>
             <CardContent className="pt-4">
                <form onSubmit={handleAdminVerify} className="space-y-4">
                   {adminLockState.isLocked && (
                     <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900">
                       Access locked for {Math.max(1, Math.ceil(adminLockState.remainingLockMs / 60000))} minute{Math.max(1, Math.ceil(adminLockState.remainingLockMs / 60000)) === 1 ? "" : "s"} after 5 failed attempts.
                     </div>
                   )}
                   <div className="space-y-2">
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        autoFocus
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-center text-lg tracking-[0.5em] h-12 focus:border-rose-300/50 transition-all placeholder:tracking-normal placeholder:opacity-30"
                        disabled={adminLockState.isLocked}
                      />
                   </div>
                   <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setShowAdminLogin(false)}
                        className="flex-1 text-white/40 hover:text-white hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 bg-white text-rose-950 font-bold hover:bg-rose-100 transition-colors disabled:opacity-60"
                        disabled={adminLockState.isLocked}
                      >
                        Authorize
                      </Button>
                   </div>
                </form>
             </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
