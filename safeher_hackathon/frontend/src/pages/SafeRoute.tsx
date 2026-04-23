import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Navigation, ShieldAlert, Moon, Sun, MapPin, Route, Clock, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LatLng = {
  lat: number;
  lng: number;
};

type NearbyPlace = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  latitude?: number | string;
  longitude?: number | string;
};

type Suggestion = {
  placeName?: string;
  placeAddress?: string;
  eLoc?: string;
  latitude?: number | string;
  longitude?: number | string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: LatLng };
};

type DirectionStep = {
  distance?: number;
  duration?: number;
  instruction?: string;
  maneuver?: {
    instruction?: string;
    modifier?: string;
    type?: string;
  };
  name?: string;
};

type DirectionRoute = {
  distance?: number;
  duration?: number;
  geometry?: string;
  legs?: Array<{
    distance?: number;
    duration?: number;
    steps?: DirectionStep[];
  }>;
};

declare global {
  interface Window {
    MapmyIndia?: {
      Map: new (
        container: string | HTMLElement,
        options?: {
          center?: [number, number];
          zoom?: number;
          zoomControl?: boolean;
          hybrid?: boolean;
          traffic?: boolean;
        },
      ) => any;
    };
    L?: any;
  }
}

const REROUTE_DISTANCE_METERS = 120;
const REROUTE_COOLDOWN_MS = 8000;

function decodePolyline(encoded: string, precision = 5): LatLng[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: LatLng[] = [];
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({ lat: lat / factor, lng: lng / factor });
  }

  return coordinates;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const r = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * r * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function projectToMeters(point: LatLng, referenceLat: number) {
  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.cos(toRadians(referenceLat)) * 111320;
  return {
    x: point.lng * metersPerDegLng,
    y: point.lat * metersPerDegLat,
  };
}

function pointToSegmentDistanceMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const refLat = (start.lat + end.lat + point.lat) / 3;
  const p = projectToMeters(point, refLat);
  const a = projectToMeters(start, refLat);
  const b = projectToMeters(end, refLat);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abSq = abx * abx + aby * aby;

  if (abSq === 0) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abSq));
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToPathMeters(point: LatLng, routePath: LatLng[]): number {
  if (routePath.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < routePath.length - 1; i += 1) {
    const segmentDistance = pointToSegmentDistanceMeters(point, routePath[i], routePath[i + 1]);
    minDistance = Math.min(minDistance, segmentDistance);
  }

  return minDistance;
}

function parseLatLng(candidate: Suggestion): LatLng | null {
  const lat = Number(candidate.latitude);
  const lng = Number(candidate.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  const geometryLocation = candidate.geometry?.location;
  if (geometryLocation && Number.isFinite(geometryLocation.lat) && Number.isFinite(geometryLocation.lng)) {
    return {
      lat: Number(geometryLocation.lat),
      lng: Number(geometryLocation.lng),
    };
  }

  return null;
}

function normalizeSuggestionLabel(item: Suggestion): string {
  return item.placeName || item.name || item.placeAddress || item.formatted_address || "Selected destination";
}

async function geocodeWithNominatim(query: string): Promise<LatLng | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = results[0];
  if (!first?.lat || !first?.lon) {
    return null;
  }

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

const LEAFLET_CSS_ID = "safe-route-leaflet-css";
const LEAFLET_JS_ID = "safe-route-leaflet-js";
const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function ensureLeafletCss() {
  if (document.getElementById(LEAFLET_CSS_ID)) {
    return;
  }

  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_HREF;
  document.head.appendChild(link);
}

async function loadLeaflet(): Promise<void> {
  ensureLeafletCss();
  if (window.L) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(LEAFLET_JS_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_JS_ID;
    script.src = LEAFLET_JS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
}

export default function SafeRoute() {
  const [, setLocation] = useLocation();

  const [nightMode, setNightMode] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<LatLng | null>(null);
  const [selectedDestinationLabel, setSelectedDestinationLabel] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [turnByTurn, setTurnByTurn] = useState<DirectionStep[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [rerouteMessage, setRerouteMessage] = useState<string>("");

  const mapRef = useRef<any | null>(null);
  const userMarkerRef = useRef<any | null>(null);
  const destinationMarkerRef = useRef<any | null>(null);
  const routePolylineRef = useRef<any | null>(null);
  const nearbyMarkersRef = useRef<any[]>([]);
  const heatmapLayerRef = useRef<any | null>(null);
  const routePathRef = useRef<LatLng[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const lastRerouteAtRef = useRef<number>(0);

  const incidentsQuery = trpc.incidents.heatmapData.useQuery(
    { daysBack: 30 },
    {
      refetchOnWindowFocus: false,
    },
  );

  const renderUserMarker = (position: LatLng) => {
    const leaflet = window.L;
    if (!leaflet || !mapRef.current) {
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = leaflet.marker([position.lat, position.lng], {
        title: "Your live location",
      }).addTo(mapRef.current);
      return;
    }

    userMarkerRef.current.setLatLng([position.lat, position.lng]);
  };

  const clearRouteLayers = () => {
    if (routePolylineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    for (const marker of nearbyMarkersRef.current) {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    }
    nearbyMarkersRef.current = [];
  };

  const renderHeatmapOverlay = () => {
    const leaflet = window.L;
    if (!leaflet || !mapRef.current) {
      return;
    }

    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    const points = incidentsQuery.data?.heatmapPoints ?? [];
    if (points.length === 0) {
      return;
    }

    const layers = points.map((point: any) =>
      leaflet.circle([point.latitude, point.longitude], {
        radius: Math.min(500, 120 + point.weight * 45),
        color: nightMode ? "#f97316" : "#dc2626",
        weight: 0,
        fillColor: nightMode ? "#fb7185" : "#f97316",
        fillOpacity: Math.min(0.42, 0.08 + point.weight * 0.03),
      })
    );

    heatmapLayerRef.current = leaflet.layerGroup(layers).addTo(mapRef.current);
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const updatedLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCurrentLocation(updatedLocation);
        renderUserMarker(updatedLocation);
        if (mapRef.current) {
          mapRef.current.setView([updatedLocation.lat, updatedLocation.lng], Math.max(mapRef.current.getZoom(), 14));
        }
        toast.success("Using your live GPS location as source.");
      },
      () => {
        toast.error("Could not read your GPS location right now.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  const placeDestinationMarker = (destination: LatLng) => {
    const leaflet = window.L;
    if (!leaflet || !mapRef.current) {
      return;
    }

    if (destinationMarkerRef.current) {
      mapRef.current.removeLayer(destinationMarkerRef.current);
    }

    destinationMarkerRef.current = leaflet.marker([destination.lat, destination.lng], {
      title: "Destination",
    }).addTo(mapRef.current);
  };

  const getRouteRiskScore = (polylineCoords: LatLng[]) => {
    const points = incidentsQuery.data?.heatmapPoints ?? [];
    if (points.length === 0 || polylineCoords.length < 2) {
      return 0;
    }

    let score = 0;
    for (const point of points) {
      const incident = { lat: point.latitude, lng: point.longitude };
      const nearest = distanceToPathMeters(incident, polylineCoords);
      if (nearest <= 220) {
        const weightedRisk = point.weight * (1 - nearest / 220);
        score += Math.max(0, weightedRisk);
      }
    }

    return score;
  };

  const extractSteps = (route: DirectionRoute): DirectionStep[] => {
    const firstLeg = route.legs?.[0];
    if (!firstLeg?.steps || firstLeg.steps.length === 0) {
      return [];
    }
    return firstLeg.steps;
  };

  const chooseSafestRoute = (routes: DirectionRoute[]): { route: DirectionRoute; path: LatLng[] } | null => {
    let best:
      | {
          route: DirectionRoute;
          path: LatLng[];
          score: number;
        }
      | null = null;

    for (const route of routes) {
      if (!route.geometry) {
        continue;
      }

      const path = decodePolyline(route.geometry);
      if (path.length < 2) {
        continue;
      }

      const riskScore = getRouteRiskScore(path);
      const durationPenalty = (route.duration ?? 0) / 600;
      const combinedScore = riskScore + durationPenalty;

      if (!best || combinedScore < best.score) {
        best = {
          route,
          path,
          score: combinedScore,
        };
      }
    }

    if (!best) {
      return null;
    }

    return {
      route: best.route,
      path: best.path,
    };
  };

  const renderNearbyMarkers = (places: NearbyPlace[]) => {
    const leaflet = window.L;
    if (!leaflet || !mapRef.current) {
      return;
    }

    for (const place of places) {
      const lat = Number(place.latitude);
      const lng = Number(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      const marker = leaflet.circleMarker([lat, lng], {
        radius: 5,
        color: "#22d3ee",
        fillColor: "#22d3ee",
        fillOpacity: 0.8,
      }).addTo(mapRef.current);

      marker.bindPopup(`<b>${place.placeName || "Safety point"}</b><br/>${place.placeAddress || ""}`);
      nearbyMarkersRef.current.push(marker);
    }
  };

  const fetchNearbyAlongRoute = async (path: LatLng[]) => {
    const midpoint = path[Math.floor(path.length / 2)] || currentLocation;
    if (!midpoint) {
      return;
    }

    const params = new URLSearchParams({
      lat: String(midpoint.lat),
      lng: String(midpoint.lng),
      keywords: "police station;hospital;fire station",
      radius: "5000",
    });

    const response = await fetch(`/api/mappls/nearby?${params.toString()}`);
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { suggestedLocations?: NearbyPlace[] };
    const places = (data.suggestedLocations || []).slice(0, 12);
    setNearbyPlaces(places);
    renderNearbyMarkers(places);
  };

  const renderRoute = (path: LatLng[], route: DirectionRoute) => {
    const leaflet = window.L;
    if (!leaflet || !mapRef.current) {
      return;
    }

    clearRouteLayers();

    routePathRef.current = path;

    routePolylineRef.current = leaflet.polyline(
      path.map((p) => [p.lat, p.lng]),
      {
        color: "#f97316",
        weight: 6,
        opacity: 0.9,
      },
    ).addTo(mapRef.current);

    mapRef.current.fitBounds(routePolylineRef.current.getBounds(), {
      padding: [40, 40],
    });

    setRouteDistanceKm((route.distance ?? 0) / 1000);
    setRouteEtaMin((route.duration ?? 0) / 60);
    setTurnByTurn(extractSteps(route));
  };

  const planSafeRoute = async (destination: LatLng, isReroute = false) => {
    if (!currentLocation) {
      return;
    }

    setIsRouting(true);
    setRerouteMessage(isReroute ? "Rerouting to keep you on the safest path..." : "Planning safest route...");

    try {
      const response = await fetch("/api/mappls/directions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: currentLocation,
          destination,
          profile: "walking",
          alternatives: true,
          steps: true,
          avoidUnsafe: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Directions API failed");
      }

      const data = (await response.json()) as { routes?: DirectionRoute[] };
      const routes = data.routes || [];
      const best = chooseSafestRoute(routes);

      if (!best) {
        throw new Error("No valid route found");
      }

      renderRoute(best.path, best.route);
      await fetchNearbyAlongRoute(best.path);
      setRerouteMessage(isReroute ? "Route updated based on your live position." : "Safest route ready.");
    } catch (error) {
      console.error(error);
      setRerouteMessage("Unable to fetch route from Mappls right now.");
      toast.error("Could not fetch route from Mappls API.");
    } finally {
      setIsRouting(false);
    }
  };

  const handleDestinationSelect = async (item: Suggestion) => {
    const parsed = parseLatLng(item);
    if (!parsed) {
      toast.error("This destination does not include coordinates. Try another result.");
      return;
    }

    setSelectedDestination(parsed);
    const label = normalizeSuggestionLabel(item);
    setSelectedDestinationLabel(label);
    setDestinationQuery(label);
    setSuggestions([]);

    placeDestinationMarker(parsed);
  };

  const resolveDestinationFromQuery = async (): Promise<LatLng | null> => {
    const query = destinationQuery.trim();
    if (query.length < 3) {
      return null;
    }

    const queryVariants = [
      query,
      `${query}, Pune`,
      `${query}, Maharashtra`,
      `${query}, India`,
    ];

    for (const variant of queryVariants) {
      const geocoded = await geocodeWithNominatim(variant);
      if (!geocoded) {
        continue;
      }

      setSelectedDestination(geocoded);
      setSelectedDestinationLabel(variant);
      setDestinationQuery(variant);
      setSuggestions([]);
      placeDestinationMarker(geocoded);
      return geocoded;
    }

    const geocoded = await geocodeWithNominatim(query);
    if (geocoded) {
      setSelectedDestination(geocoded);
      setSelectedDestinationLabel(query);
      setDestinationQuery(query);
      setSuggestions([]);
      placeDestinationMarker(geocoded);
      return geocoded;
    }

    return null;
  };

  const handleFindSafestRoute = async () => {
    if (!currentLocation) {
      toast.error("Please enable GPS source location first.");
      return;
    }

    let destination = selectedDestination;
    if (!destination) {
      destination = await resolveDestinationFromQuery();
    }

    if (!destination) {
      toast.error("Enter a valid destination or choose one from suggestions.");
      return;
    }

    await planSafeRoute(destination);
  };

  useEffect(() => {
    let mounted = true;

    const setupMap = async () => {
      try {
        const configResp = await fetch("/api/maps/config");
        if (!configResp.ok) {
          throw new Error("Map config unavailable");
        }

        const config = (await configResp.json()) as {
          mapplsMapApiKey?: string;
          mapplsRestApiKey?: string;
          mapsApiKey?: string;
        };

        console.log("[SafeRoute] Map config loaded", {
          mapplsMapApiKey: config.mapplsMapApiKey ? "SET" : "EMPTY",
          mapplsRestApiKey: config.mapplsRestApiKey ? "SET" : "EMPTY",
        });

        const initialPosition = await new Promise<LatLng>((resolve) => {
          if (!navigator.geolocation) {
            resolve({ lat: 19.076, lng: 72.8777 });
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            () => {
              // Do not block map init if GPS permission is denied/unavailable.
              resolve({ lat: 19.076, lng: 72.8777 });
            },
            {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 15000,
            }
          );
        });

        await loadLeaflet();
        if (!mounted) {
          return;
        }

        if (!window.L) {
          throw new Error("Leaflet did not initialize.");
        }

        const map = window.L.map("safe-route-map", {
          zoomControl: true,
        }).setView([initialPosition.lat, initialPosition.lng], 14);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        mapRef.current = map;
        setCurrentLocation(initialPosition);
        renderUserMarker(initialPosition);
        renderHeatmapOverlay();
        setIsMapReady(true);

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const updatedLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            setCurrentLocation(updatedLocation);
            renderUserMarker(updatedLocation);

            if (!selectedDestination || routePathRef.current.length < 2) {
              return;
            }

            const offRouteDistance = distanceToPathMeters(updatedLocation, routePathRef.current);
            const now = Date.now();

            if (
              offRouteDistance > REROUTE_DISTANCE_METERS &&
              now - lastRerouteAtRef.current > REROUTE_COOLDOWN_MS
            ) {
              lastRerouteAtRef.current = now;
              void planSafeRoute(selectedDestination, true);
            }
          },
          () => {
            // Ignore transient watch errors but keep map active.
          },
          {
            enableHighAccuracy: true,
            maximumAge: 12000,
            timeout: 10000,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Map setup failed.";
        setMapError(message);
        setIsMapReady(false);
      }
    };

    void setupMap();

    return () => {
      mounted = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (heatmapLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatmapLayerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    renderHeatmapOverlay();
  }, [incidentsQuery.data, nightMode]);

  const handleSOS = async () => {
    if (!currentLocation) {
      toast.error("Live location unavailable right now.");
      return;
    }

    const link = `https://www.mappls.com/@${currentLocation.lat},${currentLocation.lng}`;
    const message = `SOS! I need help. Live location: ${link}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Emergency SOS",
          text: message,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success("SOS message copied with your live location.");
      }
    } catch {
      toast.error("Could not share SOS right now.");
    }
  };

  return (
    <div className={`min-h-screen ${nightMode ? "bg-slate-950 text-slate-100" : "bg-stone-50 text-stone-900"}`}>
      <nav className={`border-b ${nightMode ? "border-slate-800 bg-slate-900/90" : "border-rose-100 bg-white/90"} backdrop-blur`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setLocation("/")}>
            ← Back
          </Button>

          <h1 className="text-lg md:text-xl font-semibold tracking-wide">Mappls Safety Route Finder</h1>

          <Button variant="outline" onClick={() => setNightMode((v) => !v)}>
            {nightMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {nightMode ? "Day" : "Night"}
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-4 grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-4">
        <div className="space-y-4">
          <Card className={nightMode ? "bg-slate-900 border-slate-800" : "bg-white border-rose-100"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="w-4 h-4" />
                Plan Safe Route
              </CardTitle>
              <CardDescription>
                Destination search uses Mappls Autosuggest and routing prioritizes lower-risk paths.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`rounded-lg p-3 ${nightMode ? "bg-slate-800" : "bg-sky-50"}`}>
                <p className="text-xs uppercase tracking-wide opacity-70">Source Location (GPS)</p>
                <p className="text-sm mt-1">
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                    : "Source not locked yet"}
                </p>
                <Button
                  variant="outline"
                  onClick={requestCurrentLocation}
                  className="w-full mt-2"
                >
                  <Crosshair className="w-4 h-4 mr-2" />
                  Use My Live GPS
                </Button>
              </div>

              <div>
                <label className="text-sm opacity-80 mb-2 block">Destination</label>
                <Input
                  value={destinationQuery}
                  onChange={(event) => setDestinationQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleFindSafestRoute();
                    }
                  }}
                  placeholder="Search address / place"
                />
                {suggestions.length > 0 && (
                  <div className={`mt-2 rounded-md border max-h-56 overflow-auto ${nightMode ? "border-slate-700 bg-slate-950" : "border-rose-100 bg-white"}`}>
                    {suggestions.map((item, index) => (
                      <button
                        key={`${item.eLoc || item.placeName || "suggestion"}-${index}`}
                        onClick={() => void handleDestinationSelect(item)}
                        className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${nightMode ? "border-slate-800 hover:bg-slate-800" : "border-rose-100 hover:bg-rose-50"}`}
                      >
                        <p className="text-sm font-medium">{normalizeSuggestionLabel(item)}</p>
                        <p className="text-xs opacity-75">{item.placeAddress || item.formatted_address || ""}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`rounded-lg p-3 ${nightMode ? "bg-slate-800" : "bg-amber-50"}`}>
                <p className="text-xs uppercase tracking-wide opacity-70">Route Summary</p>
                <p className="text-sm mt-1">{selectedDestinationLabel || "Select a destination to begin"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 ${nightMode ? "bg-slate-700" : "bg-white border"}`}>
                    <MapPin className="w-3 h-3 mr-1" />
                    {routeDistanceKm ? `${routeDistanceKm.toFixed(2)} km` : "Distance pending"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 ${nightMode ? "bg-slate-700" : "bg-white border"}`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {routeEtaMin ? `${Math.round(routeEtaMin)} min ETA` : "ETA pending"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 ${nightMode ? "bg-slate-700" : "bg-white border"}`}>
                    <Navigation className="w-3 h-3 mr-1" />
                    {isRouting ? "Routing..." : "Live reroute active"}
                  </span>
                </div>
                <p className="text-xs mt-2 opacity-80">{rerouteMessage}</p>
              </div>

              <Button
                onClick={() => void handleFindSafestRoute()}
                disabled={!currentLocation || destinationQuery.trim().length < 3 || isRouting}
                className="w-full bg-rose-700 hover:bg-rose-600 text-white"
              >
                <Route className="w-4 h-4 mr-2" />
                {isRouting ? "Finding Safest Route..." : "Find Safest Route"}
              </Button>

              <Button
                onClick={handleSOS}
                className="w-full bg-red-600 hover:bg-red-500 text-white"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                SOS - Share Live Location
              </Button>
            </CardContent>
          </Card>

          <Card className={nightMode ? "bg-slate-900 border-slate-800" : "bg-white border-rose-100"}>
            <CardHeader>
              <CardTitle className="text-sm">Turn-by-Turn Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-auto">
              {turnByTurn.length === 0 && <p className="text-sm opacity-70">Instructions will appear after route planning.</p>}
              {turnByTurn.map((step, index) => {
                const text =
                  step.maneuver?.instruction ||
                  step.instruction ||
                  step.name ||
                  "Continue on route";
                const distanceLabel = step.distance ? `${Math.max(1, Math.round(step.distance))} m` : "";

                return (
                  <div
                    key={`step-${index}`}
                    className={`rounded-md p-2 ${nightMode ? "bg-slate-800" : "bg-stone-100"}`}
                  >
                    <p className="text-sm">{index + 1}. {text}</p>
                    {distanceLabel && <p className="text-xs opacity-70 mt-1">Distance: {distanceLabel}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className={nightMode ? "bg-slate-900 border-slate-800" : "bg-white border-rose-100"}>
            <CardHeader>
              <CardTitle className="text-sm">Nearby Safety Landmarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-60 overflow-auto">
              {nearbyPlaces.length === 0 && <p className="text-sm opacity-70">No landmarks loaded yet.</p>}
              {nearbyPlaces.map((place, index) => (
                <div
                  key={`${place.placeName || "place"}-${index}`}
                  className={`rounded-md p-2 ${nightMode ? "bg-slate-800" : "bg-cyan-50"}`}
                >
                  <p className="text-sm font-medium">{place.placeName || "Safety Landmark"}</p>
                  <p className="text-xs opacity-75">{place.placeAddress || ""}</p>
                  {typeof place.distance === "number" && (
                    <p className="text-xs opacity-75 mt-1">Approx. {Math.round(place.distance)} m away</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className={`relative rounded-xl overflow-hidden border ${nightMode ? "border-slate-800" : "border-rose-100"}`}>
          <div
            id="safe-route-map"
            className={`w-full min-h-[55vh] xl:min-h-[calc(100vh-130px)] ${nightMode ? "[filter:brightness(0.72)_contrast(1.05)]" : ""}`}
          />

          {!isMapReady && (
            <div className="absolute inset-0 bg-black/45 text-white flex flex-col items-center justify-center gap-2">
              <Crosshair className="w-6 h-6 animate-pulse" />
              <p className="text-sm">Loading map and GPS...</p>
              {mapError && <p className="text-xs text-red-200 max-w-md text-center px-4">{mapError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
