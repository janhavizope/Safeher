import { useEffect, useRef } from "react";
import { useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

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

type LatLng = { lat: number; lng: number };

const LEAFLET_CSS_ID = "leaflet-css";
const LEAFLET_JS_ID = "leaflet-js";
const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

async function loadMapplsScript(mapKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.MapmyIndia && window.L) {
      resolve();
      return;
    }

    const existing = document.getElementById("mappls-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Mappls SDK failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "mappls-sdk";
    script.src = `https://apis.mapmyindia.com/advancedmaps/v1/${encodeURIComponent(mapKey)}/map_load?v=1.5`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mappls SDK failed to load"));
    document.head.appendChild(script);
  });
}

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

async function loadLeafletFallback() {
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

interface MapViewProps {
  className?: string;
  initialCenter?: LatLng;
  initialZoom?: number;
  onMapReady?: (map: any) => void;
  onMapError?: (error: string) => void;
}

function getBrowserLocation(timeoutMs = 10000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
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
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60_000,
      }
    );
  });
}

function clearLeafletContainer(container: HTMLDivElement | null) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  delete (container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
}

function safeRemoveMap(instance: any) {
  try {
    if (instance && typeof instance.remove === "function") {
      instance.remove();
    }
  } catch {
    // Ignore Leaflet teardown errors during React strict-mode remounts.
  }
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [resolvedCenter, setResolvedCenter] = useState<LatLng>(initialCenter);
  const [isFallbackMap, setIsFallbackMap] = useState(false);

  const getMapplsKey = async (): Promise<string> => {
    const envKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
    if (envKey) {
      return envKey;
    }

    const response = await fetch("/api/maps/config");
    if (!response.ok) {
      return "";
    }
    const data = (await response.json()) as {
      mapplsMapApiKey?: string;
      mapplsRestApiKey?: string;
      mapsApiKey?: string;
    };
    return data.mapplsMapApiKey || data.mapplsRestApiKey || data.mapsApiKey || "";
  };

  const init = usePersistFn(async () => {
    const userLocation = await getBrowserLocation();
    const center = userLocation ?? initialCenter;
    setResolvedCenter(center);

    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }

    safeRemoveMap(map.current);
    clearLeafletContainer(mapContainer.current);
    map.current = null;
    setIsFallbackMap(false);

    const mapKey = await getMapplsKey();

    if (mapKey) {
      await loadMapplsScript(mapKey);
      if (!window.MapmyIndia) {
        const err = "Mappls SDK could not be loaded. Check your key and API settings.";
        setMapError(err);
        if (onMapError) onMapError(err);
        return;
      }

      map.current = new window.MapmyIndia.Map(mapContainer.current, {
        center: [center.lat, center.lng],
        zoom: initialZoom,
        zoomControl: true,
        hybrid: false,
        traffic: false,
      });

      if (userLocation && map.current && window.L) {
        window.L.marker([userLocation.lat, userLocation.lng], {
          title: "Your current location",
        }).addTo(map.current);

        map.current.setView([userLocation.lat, userLocation.lng], Math.max(initialZoom, 14));
      }

      if (onMapReady) {
        onMapReady(map.current);
      }
      setMapError(null);
      return;
    }

    await loadLeafletFallback();
    if (!window.L) {
      const err = "Leaflet fallback could not be loaded.";
      setMapError(err);
      if (onMapError) onMapError(err);
      return;
    }

    setIsFallbackMap(true);
    map.current = window.L.map(mapContainer.current).setView([center.lat, center.lng], initialZoom);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);

    const locationMarker = window.L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: "#0f172a",
      weight: 2,
      fillColor: "#22c55e",
      fillOpacity: 0.95,
    }).addTo(map.current);

    locationMarker.bindPopup(
      userLocation
        ? "Your live location"
        : "Location access unavailable. Showing the best available center."
    );

    window.L.circle([center.lat, center.lng], {
      radius: 120,
      color: "#22c55e",
      weight: 1,
      fillColor: "#22c55e",
      fillOpacity: 0.08,
    }).addTo(map.current);

    if (userLocation) {
      map.current.setView([userLocation.lat, userLocation.lng], Math.max(initialZoom, 14));
    }

    if (onMapReady) {
      onMapReady(map.current);
    }
    setMapError(null);
  });

  useEffect(() => {
    init();
    return () => {
      safeRemoveMap(map.current);
      clearLeafletContainer(mapContainer.current);
      map.current = null;
    };
  }, [init]);

  if (mapError) {
    return (
      <div
        className={cn(
          "relative w-full h-full min-h-[400px] rounded-lg border border-rose-200 bg-rose-50 text-rose-950 p-3",
          className
        )}
      >
        <span className="absolute right-5 top-5 z-10 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-300">
          Live Location Map
        </span>
        <div className="w-full h-full min-h-[370px] rounded-md overflow-hidden border border-rose-200 bg-white">
          <div ref={mapContainer} className="w-full h-full min-h-[320px]" />
          <div className="px-3 py-2 border-t border-rose-200 bg-rose-50 text-sm">
            <p className="font-semibold">Map running in live fallback mode</p>
            <p>{mapError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-full", className)} style={{ minHeight: "400px" }}>
      <span className="absolute right-2 top-2 z-[999] rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-300">
        {isFallbackMap ? "Live Location Map" : "Map Ready"}
      </span>
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "400px" }} />
    </div>
  );
}
