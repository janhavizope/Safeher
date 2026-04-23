import { useState, useCallback } from 'react';
import { mapplsService } from '../services/mappls';

export interface Route {
  distanceKm: number;
  durationMin: number;
  riskScore: number;
  geometry: string;
  instructions: string[];
  polylineCoords: Array<{ lat: number; lng: number }>;
}

export const useRoute = () => {
  const [route, setRoute] = useState<Route | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decodePolyline = (encoded: string, precision: number = 5): Array<{ lat: number; lng: number }> => {
    const factor = Math.pow(10, precision);
    let index = 0, lat = 0, lng = 0;
    const coordinates: Array<{ lat: number; lng: number }> = [];

    while (index < encoded.length) {
      let result = 0, shift = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coordinates.push({
        lat: lat / factor,
        lng: lng / factor,
      });
    }

    return coordinates;
  };

  const planRoute = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number }
    ) => {
      setIsPlanning(true);
      setError(null);

      try {
        const response = await mapplsService.getDirections(origin, destination, 'driving', true);

        if (response.routes && response.routes.length > 0) {
          const bestRoute = response.routes[0]; // Mappls service returns them sorted by quality

          // Parse distance and duration
          const distanceKm = (bestRoute.distance || 0) / 1000;
          const durationMin = Math.round((bestRoute.duration || 0) / 60);

          // Decode polyline
          const polylineCoords = decodePolyline(bestRoute.geometry);

          // Extract turn-by-turn instructions
          const instructions: string[] = [];
          if (bestRoute.legs) {
            bestRoute.legs.forEach((leg: any) => {
              if (leg.steps) {
                leg.steps.forEach((step: any) => {
                  if (step.instruction) {
                    instructions.push(step.instruction);
                  }
                });
              }
            });
          }

          setRoute({
            distanceKm,
            durationMin,
            riskScore: 0, // Would integrate with incident heatmap here
            geometry: bestRoute.geometry,
            instructions,
            polylineCoords,
          });
        } else {
          setError('No route found');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Route planning failed');
      } finally {
        setIsPlanning(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
  }, []);

  return {
    route,
    isPlanning,
    error,
    planRoute,
    clearRoute,
  };
};
