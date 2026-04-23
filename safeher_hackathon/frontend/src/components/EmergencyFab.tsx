import { useState, useEffect } from 'react';
import { AlertTriangle, PhoneCall, FastForward, MessageCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function EmergencyFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);

  // Stop scrolling during fake call
  useEffect(() => {
    if (showFakeCall) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showFakeCall]);

  const triggerQuickExit = () => {
    // Instantly replace history so Back button doesn't work easily to return
    window.location.replace("https://www.google.com/search?q=weather+today");
  };

  const triggerWhatsAppSOS = () => {
    if (!navigator.geolocation) {
      toast.error("Location not supported for SOS message");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const msg = encodeURIComponent(`🚨 SOS! I feel unsafe right now. This is my live location: https://maps.google.com/?q=${latitude},${longitude} Please check on me.`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
        setIsOpen(false);
      },
      () => toast.error("Could not get location. Ensure permissions are enabled.")
    );
  };

  const triggerFakeCall = () => {
    setShowFakeCall(true);
    setIsOpen(false);
  };

  const triggerCallSOS = () => {
    // 112 is the standard emergency number in many countries (including India)
    window.location.href = "tel:112";
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[100]">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="bg-rose-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(225,29,72,0.6)] hover:bg-rose-700 transition-all flex items-center justify-center animate-pulse duration-2000"
            aria-label="Emergency SOS Options"
          >
            <AlertTriangle className="w-8 h-8" />
          </button>
        )}

        {/* SOS Menu */}
        {isOpen && (
          <div className="flex flex-col gap-3 items-end animate-in slide-in-from-bottom-5 fade-in duration-200">
            <button
              onClick={triggerQuickExit}
              className="bg-slate-900 text-white py-3 px-5 rounded-full shadow-lg hover:bg-black transition-all flex items-center gap-3 font-semibold group"
              title="Ghost Mode: Instantly leaves site"
            >
              <span className="group-hover:opacity-100 right-0">Quick Exit (Ghost Mode)</span>
              <FastForward className="w-5 h-5" />
            </button>

            <button
              onClick={triggerCallSOS}
              className="bg-red-600 text-white py-3 px-5 rounded-full shadow-lg hover:bg-red-700 transition-all flex items-center gap-3 font-semibold"
            >
              <span>Call Emergency (112)</span>
              <PhoneCall className="w-5 h-5" />
            </button>

            <button
              onClick={triggerFakeCall}
              className="bg-blue-600 text-white py-3 px-5 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-3 font-semibold"
            >
              <span>Fake Phone Call</span>
              <PhoneCall className="w-5 h-5" />
            </button>

            <button
              onClick={triggerWhatsAppSOS}
              className="bg-emerald-500 text-white py-3 px-5 rounded-full shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-3 font-semibold"
            >
              <span>WhatsApp Live Location</span>
              <MessageCircle className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="bg-stone-200 text-stone-800 p-4 mt-2 rounded-full shadow-lg hover:bg-stone-300 transition-all flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Fake Phone Call Modal Overlay */}
      {showFakeCall && (
        <div className="fixed inset-0 z-[200] bg-zinc-900 text-white flex flex-col items-center justify-between py-16 animate-in slide-in-from-top-full duration-300">
          <div className="text-center mt-12">
            <div className="w-24 h-24 mx-auto rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center mb-6 overflow-hidden">
               <span className="text-4xl text-slate-400">M</span>
            </div>
            <h1 className="text-4xl font-light tracking-wide mb-2">Mom</h1>
            <p className="text-xl text-zinc-400">Mobile</p>
          </div>
          
          <div className="w-full px-12 pb-12 flex justify-between items-end max-w-sm mx-auto">
            <button 
              onClick={() => setShowFakeCall(false)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center pointer-events-none">
                <PhoneCall className="w-8 h-8 text-white rotate-[135deg]" />
              </div>
              <span className="text-lg tracking-wide mt-2">Decline</span>
            </button>

            <button 
              onClick={() => setShowFakeCall(false)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center animate-bounce pointer-events-none">
                <PhoneCall className="w-8 h-8 text-white animate-pulse" />
              </div>
              <span className="text-lg tracking-wide mt-2">Accept</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
