import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapView } from "@/components/Map";
import { Share2, Navigation, ShieldCheck, HeartPulse } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

const GPS_REJECT_ACCURACY_M = 800;
const GPS_POOR_ACCURACY_M = 250;
const GPS_TRACKING_THRESHOLD_M = 150;

function distanceMeters(a: [number, number], b: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function smoothFix(previous: [number, number] | null, next: [number, number], accuracy: number): [number, number] {
  if (!previous) {
    return next;
  }

  const alpha = accuracy <= 30 ? 0.9 : accuracy <= 80 ? 0.7 : accuracy <= 150 ? 0.5 : 0.3;
  return [
    previous[0] + (next[0] - previous[0]) * alpha,
    previous[1] + (next[1] - previous[1]) * alpha,
  ];
}

export default function SafeWalk() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const latestPosRef = useRef<[number, number] | null>(null);
  const latestAccuracyRef = useRef<number>(Infinity);
  const poorSignalToastAtRef = useRef<number>(0);

  const [activeSession, setActiveSession] = useState<{ token: string; destLat?: number; destLng?: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const startWalkMutation = trpc.safety.startSafeWalk.useMutation();
  const updateWalkMutation = trpc.safety.updateWalk.useMutation();

  const handleMapReady = (map: any) => {
    mapRef.current = map;
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error("Live GPS is not supported on this device.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const raw: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const accuracy = Math.max(1, pos.coords.accuracy || 9999);

        if (accuracy > GPS_REJECT_ACCURACY_M) {
          const now = Date.now();
          if (now - poorSignalToastAtRef.current > 30000) {
            poorSignalToastAtRef.current = now;
            toast.warning("Weak GPS signal. Move near a window/open area for better accuracy.");
          }
          return;
        }

        const previous = latestPosRef.current;
        if (previous && distanceMeters(previous, raw) < 4 && accuracy > GPS_POOR_ACCURACY_M) {
          return;
        }

        const coords = smoothFix(previous, raw, accuracy);
        latestPosRef.current = coords;
        latestAccuracyRef.current = accuracy;
        setGpsAccuracy(accuracy);
        setCurrentPos(coords);

        if (mapRef.current && !activeSession) {
          mapRef.current.setView(coords, 15);
        }
      },
      () => {
        // Keep current map state when a transient GPS read fails.
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      latestAccuracyRef.current = Infinity;
    };
  }, [activeSession]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const onMapClick = (e: any) => {
      if (activeSession) return;
      setDestination([e.latlng.lat, e.latlng.lng]);
    };

    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [activeSession]);

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
          iconAnchor: [6, 6],
        }),
      }).addTo(mapRef.current);
    }
  }, [currentPos]);

  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      const latest = latestPosRef.current;
      if (!latest) return;
      if (latestAccuracyRef.current > GPS_TRACKING_THRESHOLD_M) return;

      updateWalkMutation.mutate({
        token: activeSession.token,
        lat: latest[0],
        lng: latest[1],
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [activeSession, updateWalkMutation]);

  const handleStartWalk = async () => {
    if (!currentPos) {
      toast.error("Waiting for accurate GPS fix. Please try again in a few seconds.");
      return;
    }

    try {
      const session = await startWalkMutation.mutateAsync({
        startLat: currentPos[0],
        startLng: currentPos[1],
        destLat: destination?.[0],
        destLng: destination?.[1],
      });

      if (session) {
        setActiveSession({ token: session.secretToken! });
        toast.success("SafeWalk started with high-accuracy tracking.");
      }
    } catch {
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

  const qualityLabel =
    gpsAccuracy == null
      ? "Calibrating"
      : gpsAccuracy <= 30
      ? "Excellent"
      : gpsAccuracy <= 80
      ? "Good"
      : gpsAccuracy <= 150
      ? "Fair"
      : "Weak";

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

        {destination && !activeSession && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
            <div className="bg-rose-600 text-white p-2 rounded shadow-lg text-xs animate-bounce">Target Destination</div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-[1000]">
          <span className="rounded-full border border-rose-200 bg-white/95 px-3 py-1 text-xs font-semibold text-rose-900">
            GPS: {qualityLabel}{gpsAccuracy != null ? ` (${Math.round(gpsAccuracy)}m)` : ""}
          </span>
        </div>

        <div className="absolute bottom-8 left-4 right-4 z-[1000] space-y-4 max-w-md mx-auto">
          {!activeSession ? (
            <Card className="bg-white/95 backdrop-blur border-rose-100 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-rose-950">Set Destination</CardTitle>
                <CardDescription className="text-gray-500">Tap the map where you are going, then start your walk.</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button className="flex-1 bg-rose-950 hover:bg-rose-900 text-white" onClick={handleStartWalk} disabled={startWalkMutation.isPending}>
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
                <p className="text-gray-600 text-sm mb-6">A private link has been created for your trusted contact.</p>
                <Button variant="default" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md mb-2" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Live Link via WhatsApp
                </Button>
                <Button
                  variant="destructive"
                  className="w-full font-bold shadow-lg animate-pulse mb-4"
                  onClick={async () => {
                    if (!activeSession || !currentPos) return;
                    await updateWalkMutation.mutateAsync({
                      token: activeSession.token,
                      lat: currentPos[0],
                      lng: currentPos[1],
                      status: "emergency",
                    });
                    toast.error("EMERGENCY ALERT SENT!");
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  EMERGENCY SOS
                </Button>
                <Button variant="ghost" className="mt-4 text-rose-700 hover:text-rose-950 hover:bg-rose-50" onClick={() => setActiveSession(null)}>
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
