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
  preferBrowserLocation?: boolean;
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
  initialCenter = { lat: 19.076, lng: 72.8777 },
  initialZoom = 12,
  preferBrowserLocation = true,
  onMapReady,
  onMapError,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any | null>(null);
  const locationMarkerRef = useRef<any | null>(null);
  const accuracyCircleRef = useRef<any | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const init = usePersistFn(async () => {
    const userLocation = preferBrowserLocation ? await getBrowserLocation() : null;
    const center = userLocation ?? initialCenter;

    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }

    safeRemoveMap(map.current);
    clearLeafletContainer(mapContainer.current);
    map.current = null;

    await loadLeafletFallback();
    if (!window.L) {
      const err = "Leaflet fallback could not be loaded.";
      setMapError(err);
      if (onMapError) onMapError(err);
      return;
    }

    map.current = window.L.map(mapContainer.current).setView([center.lat, center.lng], initialZoom);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);

    locationMarkerRef.current = window.L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: "#0f172a",
      weight: 2,
      fillColor: "#22c55e",
      fillOpacity: 0.95,
    }).addTo(map.current);

    locationMarkerRef.current.bindPopup(
      userLocation
        ? "Your live location"
        : "Selected map location"
    );

    accuracyCircleRef.current = window.L.circle([center.lat, center.lng], {
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

    if (preferBrowserLocation && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (!map.current || !window.L) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.max(20, Math.min(2000, position.coords.accuracy || 120));

          if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng([lat, lng]);
          }
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng([lat, lng]);
            accuracyCircleRef.current.setRadius(accuracy);
          }
        },
        () => {
          // Keep existing center if watch updates fail.
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    }

    setMapError(null);
  });

  useEffect(() => {
    init();
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      locationMarkerRef.current = null;
      accuracyCircleRef.current = null;
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
        Live Location Map
      </span>
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: "400px" }} />
    </div>
  );
}
