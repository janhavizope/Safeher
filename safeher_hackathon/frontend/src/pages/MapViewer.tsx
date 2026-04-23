import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Layers, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { MapView } from "@/components/Map";

type LatLng = {
  lat: number;
  lng: number;
};

export default function MapViewer() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<any | null>(null);
  const volunteerMarkersRef = useRef<any[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [daysBack, setDaysBack] = useState("30");
  const [heatmapLayer, setHeatmapLayer] = useState<any | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const markersRef = useRef<any[]>([]);
  const lookbackDays = parseInt(daysBack, 10);
  const dateRange = useMemo(
    () => ({
      start: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000),
      end: new Date(),
    }),
    [lookbackDays]
  );

  const incidentsQuery = trpc.incidents.list.useQuery({
    types: selectedType === "all" ? undefined : [selectedType],
    dateRange,
    limit: 500,
  });

  const heatmapQuery = trpc.incidents.heatmapData.useQuery({
    daysBack: lookbackDays,
  });

  const volunteersQuery = trpc.safety.getNearbyVolunteers.useQuery(
    {
      lat: mapCenter?.lat ?? 19.076,
      lng: mapCenter?.lng ?? 72.8777,
    },
    {
      enabled: !!mapCenter,
    }
  );

  const handleMapReady = (map: any) => {
    mapRef.current = map;

    if (typeof map?.getCenter === "function") {
      const center = map.getCenter();
      if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
        setMapCenter({ lat: center.lat, lng: center.lng });
      }
    }

    if (typeof map?.on === "function") {
      map.on("moveend", () => {
        const center = map.getCenter?.();
        if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === "critical") return "#ef4444";
    if (severity === "high") return "#f97316";
    if (severity === "medium") return "#eab308";
    return "#3b82f6";
  };

  // Add markers when incidents load
  useEffect(() => {
    if (!mapRef.current || !incidentsQuery.data || !window.L) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => mapRef.current?.removeLayer(marker));
    markersRef.current = [];

    // Add new markers
    incidentsQuery.data.incidents.forEach((incident: any) => {
      const marker = window.L.circleMarker([incident.latitude, incident.longitude], {
        radius: 7,
        color: "#0f172a",
        weight: 1,
        fillColor: getSeverityColor(incident.severity),
        fillOpacity: 0.95,
      }).addTo(mapRef.current);

      marker.bindPopup(`
        <div style="color:#111827;padding:6px;">
          <strong>${incident.incidentType}</strong><br/>
          Severity: ${incident.severity}<br/>
          Reported: ${new Date(incident.reportedAt).toLocaleDateString()}
        </div>
      `);

      marker.on("click", () => {
        marker.openPopup();
      });

      markersRef.current.push(marker);
    });
  }, [incidentsQuery.data]);

  // Add Volunteer markers only when explicit coordinates are available.
  useEffect(() => {
    if (!mapRef.current || !volunteersQuery.data || !window.L) return;

    volunteerMarkersRef.current.forEach((marker) => mapRef.current?.removeLayer(marker));
    volunteerMarkersRef.current = [];

    volunteersQuery.data.volunteers.forEach((v: any) => {
      const lat = Number(v.latitude);
      const lng = Number(v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const marker = window.L.circleMarker([lat, lng], {
        radius: 6,
        color: "#059669",
        weight: 1,
        fillColor: "#10b981",
        fillOpacity: 0.8,
      }).addTo(mapRef.current);

      marker.bindPopup(`
        <div style="color:#064e3b;padding:4px;font-weight:bold;">
          Verified Support Nearby
        </div>
      `);

      volunteerMarkersRef.current.push(marker);
    });

    return () => {
      volunteerMarkersRef.current.forEach((marker) => mapRef.current?.removeLayer(marker));
      volunteerMarkersRef.current = [];
    };
  }, [volunteersQuery.data]);

  const recentIncidents = useMemo(() => {
    return [...(incidentsQuery.data?.incidents ?? [])]
      .sort((a: any, b: any) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 8);
  }, [incidentsQuery.data]);

  // Update heatmap when data changes
  useEffect(() => {
    if (!mapRef.current || !heatmapQuery.data || !window.L) return;

    // Remove old heatmap
    if (heatmapLayer) {
      mapRef.current.removeLayer(heatmapLayer);
    }

    if (!showHeatmap) return;

    // Render weighted circles as a lightweight heatmap approximation in Leaflet.
    const circles = heatmapQuery.data.heatmapPoints.map((point: any) =>
      window.L.circle([point.latitude, point.longitude], {
        radius: Math.min(500, 120 + point.weight * 40),
        color: "#f97316",
        weight: 0,
        fillColor: "#f97316",
        fillOpacity: Math.min(0.45, 0.08 + point.weight * 0.03),
      })
    );
    const newHeatmap = window.L.layerGroup(circles).addTo(mapRef.current);

    setHeatmapLayer(newHeatmap);
    return () => {
      if (mapRef.current) {
        mapRef.current.removeLayer(newHeatmap);
      }
    };
  }, [heatmapQuery.data, showHeatmap]);

  useEffect(() => {
    if (showHeatmap) return;
    if (!heatmapLayer) return;
    if (mapRef.current) {
      mapRef.current.removeLayer(heatmapLayer);
    }
  }, [showHeatmap, heatmapLayer]);

  const incidentTypes = [
    { value: "all", label: "All Types" },
    { value: "harassment", label: "Harassment" },
    { value: "assault", label: "Assault" },
    { value: "stalking", label: "Stalking" },
    { value: "theft", label: "Theft" },
    { value: "unsafe_area", label: "Unsafe Area" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col">
      {/* Header */}
      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/")} className="text-rose-950 hover:text-rose-900 hover:bg-rose-50">
          ← Back to Home
        </Button>
        <h1 className="text-2xl font-serif font-bold text-rose-950">Safety Map</h1>
        <div className="w-32"></div>
      </nav>

      <div className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <Card className="bg-white border-rose-100 shadow-sm h-[calc(100vh-14rem)] backdrop-blur-xl">
              <CardContent className="h-full p-0">
                <div className="h-full rounded-xl overflow-hidden bg-black/40">
                  <MapView initialZoom={12} onMapReady={handleMapReady} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Filters Card */}
            <Card className="bg-white border-rose-100 shadow-sm backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                  <Filter className="w-5 h-5 text-rose-700" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-gray-700 text-sm block mb-2 font-medium">Incident Type</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="bg-white border-rose-200 text-gray-900 focus-visible:ring-rose-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-rose-100 text-gray-900">
                      {incidentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-gray-700 text-sm block mb-2 font-medium">Time Range</label>
                  <Select value={daysBack} onValueChange={setDaysBack}>
                    <SelectTrigger className="bg-white border-rose-200 text-gray-900 focus-visible:ring-rose-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-rose-100 text-gray-900">
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  variant={showHeatmap ? "default" : "outline"}
                  className={`w-full ${showHeatmap ? "bg-rose-950 hover:bg-rose-900 text-white" : "border-rose-200 text-gray-700 bg-white hover:bg-rose-50"}`}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  {showHeatmap ? "Hide" : "Show"} Heatmap
                </Button>
              </CardContent>
            </Card>

            {/* Legend Card */}
            <Card className="bg-white border-rose-100 shadow-sm backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm flex items-center gap-2 font-bold tracking-wide">
                  <MapPin className="w-4 h-4 text-rose-700" />
                  Legend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                  <span className="text-gray-700 text-sm">Critical</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
                  <span className="text-gray-700 text-sm">High</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_8px_#eab308]"></div>
                  <span className="text-gray-700 text-sm">Medium</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>
                  <span className="text-gray-700 text-sm">Low</span>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-white border-rose-100 shadow-sm backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-rose-950">
                  <p className="text-4xl font-bold text-rose-950 mb-2 font-serif">
                    {incidentsQuery.data?.incidents.length ?? 0}
                  </p>
                  <p className="text-sm text-gray-500 uppercase tracking-widest font-medium">Incidents Reported</p>
                </div>
              </CardContent>
            </Card>

            {/* Report Button */}
            <Button
              onClick={() => setLocation("/report")}
              className="w-full bg-rose-950 hover:bg-rose-900 text-white font-bold h-14 rounded-xl text-md"
              size="lg"
            >
              <MapPin className="w-5 h-5 mr-3" />
              Report Incident
            </Button>

            <Card className="bg-white border-rose-100 shadow-sm backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Live Incident Feed</CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Click an entry to focus location on map
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentIncidents.length === 0 ? (
                  <p className="text-gray-500 text-sm">No incidents in selected range</p>
                ) : (
                  recentIncidents.map((incident: any) => (
                    <button
                      key={incident.id}
                      className="w-full text-left rounded-xl border border-rose-100 bg-white px-3 py-3 hover:border-rose-300 hover:bg-rose-50 transition-all shadow-sm"
                      onClick={() => {
                        if (!mapRef.current) return;
                        mapRef.current.setView([incident.latitude, incident.longitude], Math.max(mapRef.current.getZoom() || 12, 14));
                      }}
                    >
                      <p className="text-gray-900 text-sm font-bold capitalize mb-1">
                        {incident.incidentType.replace("_", " ")}
                      </p>
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider">
                        <span className="text-emerald-600 font-bold">{incident.severity}</span> • {new Date(incident.reportedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
