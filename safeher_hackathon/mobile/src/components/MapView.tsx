import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapViewProps {
  location: { lat: number; lng: number } | null;
  route: any;
  isLoading?: boolean;
}

// Placeholder MapView - will integrate actual Mappls SDK
export default function MapView({ location, route, isLoading }: MapViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {location
          ? `📍 Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
          : 'Getting location...'}
      </Text>
      {route && (
        <Text style={styles.text}>
          Route: {route.distanceKm.toFixed(1)} km • {route.durationMin} min
        </Text>
      )}
      {isLoading && <Text style={styles.loading}>Planning route...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  loading: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 20,
  },
});
