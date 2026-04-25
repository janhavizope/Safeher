import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import MapView from './components/MapView';
import SearchBar from './components/SearchBar';
import RouteCard from './components/RouteCard';
import SOSButton from './components/SOSButton';
import { useLocation } from './hooks/useLocation';
import { useRoute } from './hooks/useRoute';

export default function App() {
  const [loading] = useState(false);
  const { location, startTracking } = useLocation();
  const { route, planRoute, isPlanning } = useRoute();

  useEffect(() => {
    // Request location permission on app start
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await check(permission);

      if (result === RESULTS.DENIED) {
        const requestResult = await request(permission);
        if (requestResult === RESULTS.GRANTED) {
          startTracking();
        }
      } else if (result === RESULTS.GRANTED) {
        startTracking();
      }
    } catch (error) {
      Alert.alert('Permission Error', 'Could not check location permission');
    }
  };

  const handleDestinationSelect = (place: any) => {
    if (!location) {
      Alert.alert('Location unavailable', 'Waiting for your current GPS fix. Try again in a moment.');
      return;
    }

    const lat = Number(place?.geometry?.location?.lat);
    const lng = Number(place?.geometry?.location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Invalid destination', 'Could not read destination coordinates from search result.');
      return;
    }

    planRoute(location, { lat, lng });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Map */}
      <MapView 
        location={location} 
        route={route}
        isLoading={isPlanning}
      />

      {/* Search Bar */}
      <SearchBar onSelectPlace={handleDestinationSelect} />

      {/* Route Info Card */}
      {route && (
        <RouteCard 
          route={route}
          distance={route.distanceKm}
          duration={route.durationMin}
          risk={route.riskScore}
        />
      )}

      {/* SOS Button */}
      <SOSButton location={location} />

      {/* Loading Indicator */}
      {(isPlanning || loading) && (
        <View style={{ position: 'absolute', top: '50%', left: '50%' }}>
          <ActivityIndicator size="large" color="#e74c3c" />
        </View>
      )}
    </View>
  );
}
