import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapView } from "@/components/Map";
import { MapPin, Share2, Navigation, ShieldCheck, HeartPulse } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useSafetySentinel } from "@/contexts/SafetySentinel";

export default function SafeWalk() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [activeSession, setActiveSession] = useState<{ token: string; destLat?: number; destLng?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);

  const startWalkMutation = trpc.safety.startSafeWalk.useMutation();
  const updateWalkMutation = trpc.safety.updateWalk.useMutation();

  const handleMapReady = (map: any) => {
    mapRef.current = map;
    // Set initial view to user location if possible
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCurrentPos(coords);
      map.setView(coords, 15);
    });
  };

  /**
   * Picking Destination
   */
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const onMapClick = (e: any) => {
      if (activeSession) return; // Can't change dest during walk
      setDestination([e.latlng.lat, e.latlng.lng]);
    };

    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [mapRef.current, activeSession]);

  /**
   * Update User Marker on Map
   */
  useEffect(() => {
    if (!mapRef.current || !currentPos || !window.L) return;
    
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(currentPos);
    } else {
      userMarkerRef.current = window.L.marker(currentPos, {
        icon: window.L.divIcon({
          className: "user-pos-icon",
          html: `
            <div style="position:relative;width:12px;height:12px;">
              <div style="background:#be123c;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>
            </div>
          `,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(mapRef.current);
    }
  }, [currentPos]);

  /**
   * Tracking Heartbeat
   */
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(coords);
        updateWalkMutation.mutate({
          token: activeSession.token,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      });
    }, 5000); // Pulse location every 5 seconds

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStartWalk = async () => {
    if (!currentPos) return;
    try {
      const session = await startWalkMutation.mutateAsync({
        startLat: currentPos[0],
        startLng: currentPos[1],
        destLat: destination?.[0],
        destLng: destination?.[1]
      });
      if (session) {
        setActiveSession({ token: session.secretToken! });
        toast.success("SafeWalk Started. Your live location is now being monitored.");
      }
    } catch (err) {
      toast.error("Failed to start walk");
    }
  };

  const handleShare = () => {
    if (!activeSession) return;
    const url = `${window.location.origin}/track/${activeSession.token}`;
    const text = `I'm using SafeHer SafeWalk to walk home. Watch my live location here: ${url}`;
    
    if (navigator.share) {
      navigator.share({ title: "SafeHer SafeWalk", text, url });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col">
      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/")} className="text-rose-950 hover:text-rose-900 hover:bg-rose-50">
          ← Back
        </Button>
        <h1 className="text-xl font-bold text-rose-950 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-rose-700" />
          SafeWalk Companion
        </h1>
        <div className="w-16"></div>
      </nav>

      <div className="flex-1 relative">
        <MapView onMapReady={handleMapReady} initialZoom={15} />
        
        {/* Destination Marker */}
        {destination && !activeSession && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
             <div className="bg-rose-600 text-white p-2 rounded shadow-lg text-xs animate-bounce">
               Target Destination
             </div>
          </div>
        )}

        {/* UI Overlay */}
        <div className="absolute bottom-8 left-4 right-4 z-[1000] space-y-4 max-w-md mx-auto">
          {!activeSession ? (
            <Card className="bg-white/95 backdrop-blur border-rose-100 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-rose-950">Set Destination</CardTitle>
                <CardDescription className="text-gray-500">
                  Tap the map where you are going, then start your walk.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button 
                  className="flex-1 bg-rose-950 hover:bg-rose-900 text-white"
                  onClick={handleStartWalk}
                  disabled={startWalkMutation.isPending}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Start SafeWalk
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white text-rose-950 border border-rose-200 shadow-2xl animate-in slide-in-from-bottom-4">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center animate-pulse mb-4 border border-rose-200">
                  <HeartPulse className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-xl font-bold mb-2">Live Tracking Active</h3>
                <p className="text-gray-600 text-sm mb-6">
                  A private link has been created for your trusted contact.
                </p>
                <Button 
                  variant="default" 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md mb-2"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Live Link via WhatsApp
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full font-bold shadow-lg animate-pulse mb-4"
                  onClick={async () => {
                    if (!activeSession) return;
                    await updateWalkMutation.mutateAsync({
                      token: activeSession.token,
                      lat: currentPos![0],
                      lng: currentPos![1],
                      status: 'emergency'
                    });
                    toast.error("EMERGENCY ALERT SENT!");
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  EMERGENCY SOS
                </Button>
                <Button 
                  variant="ghost" 
                  className="mt-4 text-rose-700 hover:text-rose-950 hover:bg-rose-50"
                  onClick={() => setActiveSession(null)}
                >
                  End Session
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
