import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  let watchId: number | null = null;

  const startTracking = () => {
    if (isTracking) return;

    setIsTracking(true);

    // Get initial position
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
        setError(null);
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
    watchId = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        });
        setError(null);
      },
      (err) => {
        console.error('Watch position error:', err);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // Update every 5 meters
        interval: 5000, // Android: update every 5 seconds
        fastestInterval: 2000,
        useSignificantChanges: false,
      }
    );
  };

  const stopTracking = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
};
