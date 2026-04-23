import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapView } from "@/components/Map";
import { MapPin, Navigation, ShieldCheck, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";

export default function PublicTrack() {
  const { token } = useParams();
  const mapRef = useRef<any>(null);
  const friendMarkerRef = useRef<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const walkQuery = trpc.safety.getPublicWalk.useQuery(
    { token: token! },
    { 
      refetchInterval: 5000, // Refresh every 5 seconds
      enabled: !!token
    }
  );

  const handleMapReady = (map: any) => {
    mapRef.current = map;
  };

  /**
   * Update Marker Position
   */
  const pathRef = useRef<any>(null);
  const [pathCoords, setPathCoords] = useState<[number, number][]>([]);

  /**
   * Update Marker Position and Path
   */
  useEffect(() => {
    if (!mapRef.current || !walkQuery.data || !window.L) return;
    
    const { currentLat, currentLng } = walkQuery.data;
    if (!currentLat || !currentLng) return;

    const coords: [number, number] = [parseFloat(currentLat.toString()), parseFloat(currentLng.toString())];
    
    // Check if coords are valid numbers
    if (isNaN(coords[0]) || isNaN(coords[1])) {
      console.error("Invalid coordinates received:", currentLat, currentLng);
      return;
    }

    // Update Marker
    if (friendMarkerRef.current) {
      friendMarkerRef.current.setLatLng(coords);
    } else {
      friendMarkerRef.current = window.L.marker(coords, {
        icon: window.L.divIcon({
          className: "friend-pos-icon",
          html: `
            <div style="position:relative;width:14px;height:14px;">
              <div style="background:#be123c;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 15px rgba(190,18,60,0.6)"></div>
              <div style="position:absolute;top:-35px;left:50%;transform:translateX(-50%);background:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;white-space:nowrap;border:1px solid #be123c;color:#be123c;box-shadow:0 2px 4px rgba(0,0,0,0.1)">Her Location</div>
            </div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(mapRef.current);
    }
    
    // Update Path
    setPathCoords(prev => {
      const last = prev[prev.length - 1];
      if (last && last[0] === coords[0] && last[1] === coords[1]) return prev;
      const next = [...prev, coords];
      
      if (pathRef.current) {
        pathRef.current.setLatLngs(next);
      } else {
        pathRef.current = window.L.polyline(next, {
          color: '#be123c',
          weight: 4,
          opacity: 0.6,
          dashArray: '8, 8',
          lineJoin: 'round'
        }).addTo(mapRef.current);
      }
      return next;
    });

    // Auto-center map
    mapRef.current.panTo(coords, { animate: true });
    
    setLastUpdate(new Date());
  }, [walkQuery.data]);

  if (walkQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col items-center justify-center text-rose-950">
        <div className="w-16 h-16 border-4 border-rose-950 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-serif text-gray-600">Locating your friend...</p>
      </div>
    );
  }

  if (walkQuery.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-100 border border-rose-200 p-6 rounded-full mb-6">
          <ShieldCheck className="w-16 h-16 text-rose-700" />
        </div>
        <h1 className="text-2xl font-bold text-rose-950 mb-2">SafeWalk Session Ended</h1>
        <p className="text-gray-600 mb-6">This link has expired or the user has safely reached their destination.</p>
        <div className="w-full max-w-md h-1 bg-gradient-to-r from-transparent via-rose-200 to-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col">
      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur px-4 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-rose-950 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-rose-700" />
            Watch Safely
          </h1>
          <div className="flex items-center gap-2 text-rose-700 bg-rose-100 border border-rose-200 px-3 py-1 rounded-full text-sm">
            <Clock className="w-4 h-4" />
            Live Updates
          </div>
        </div>
      </nav>

      <div className="flex-1 relative">
        {walkQuery.data ? (
          <MapView 
            onMapReady={handleMapReady} 
            initialZoom={16} 
            initialCenter={{ 
              lat: parseFloat(walkQuery.data.currentLat.toString()), 
              lng: parseFloat(walkQuery.data.currentLng.toString()) 
            }} 
          />
        ) : (
          <div className="w-full h-full bg-rose-50 flex flex-col items-center justify-center p-6 text-center">
             <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
             <p className="text-gray-500 font-medium">Connecting to live stream...</p>
          </div>
        )}

        {/* Status Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[1000] max-w-md mx-auto">
          <Card className="bg-white/95 backdrop-blur border-rose-100 shadow-xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-full border border-rose-200">
                <Navigation className="w-6 h-6 text-rose-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-bold text-gray-900">Your friend is moving</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </CardDescription>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                  walkQuery.data?.status === 'emergency' ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {walkQuery.data?.status === 'emergency' ? 'Alert Active' : 'Status: Normal'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] w-full px-4 max-w-md">
           <div className="bg-white text-rose-950 p-4 rounded-xl shadow-xl border border-rose-200 text-center">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-1">PROUDLY POWERED BY</p>
              <h2 className="text-lg font-serif">SafeHer Tracker</h2>
           </div>
        </div>
      </div>
    </div>
  );
}
