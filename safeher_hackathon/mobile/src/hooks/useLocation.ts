import { useCallback, useEffect, useRef, useState } from 'react';
import Geolocation from 'react-native-geolocation-service';

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

const MAX_ACCEPTABLE_ACCURACY_M = 250;
const MIN_MOVEMENT_M = 4;

function distanceMeters(a: Location, b: Location): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function smoothFix(previous: Location | null, next: Location): Location {
  if (!previous) {
    return next;
  }

  const accuracy = next.accuracy ?? MAX_ACCEPTABLE_ACCURACY_M;
  const alpha = accuracy <= 20 ? 0.9 : accuracy <= 60 ? 0.75 : 0.55;

  return {
    ...next,
    lat: previous.lat + (next.lat - previous.lat) * alpha,
    lng: previous.lng + (next.lng - previous.lng) * alpha,
  };
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<Location | null>(null);

  const acceptFix = useCallback((next: Location) => {
    const accuracy = Math.max(1, next.accuracy ?? MAX_ACCEPTABLE_ACCURACY_M + 1);
    const previous = lastAcceptedRef.current;

    if (accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
      return;
    }

    if (previous) {
      const moved = distanceMeters(previous, next);
      if (moved < MIN_MOVEMENT_M && accuracy > 80) {
        return;
      }
    }

    const smoothed = smoothFix(previous, {
      ...next,
      accuracy,
      timestamp: next.timestamp ?? Date.now(),
    });

    lastAcceptedRef.current = smoothed;
    setLocation(smoothed);
    setError(null);
  }, []);

  const startTracking = useCallback(() => {
    if (isTracking) return;

    setIsTracking(true);

    // Get initial position
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        acceptFix({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
      },
      (err) => {
        setError(err.message);
        console.error('Geolocation error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        forceRequestLocation: true,
      }
    );

    // Watch position for continuous updates
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        acceptFix({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
      },
      (err) => {
        console.error('Watch position error:', err);
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 3,
        interval: 2500,
        fastestInterval: 2000,
        useSignificantChanges: false,
        showsBackgroundLocationIndicator: false,
      }
    );
  }, [acceptFix, isTracking]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
};
