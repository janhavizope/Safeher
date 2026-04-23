import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Share, Alert } from 'react-native';

interface SOSButtonProps {
  location: { lat: number; lng: number } | null;
}

export default function SOSButton({ location }: SOSButtonProps) {
  const handleSOS = async () => {
    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
    const message = `🚨 SOS! Emergency assistance needed!\nMy location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}\n${mapLink}\n\n- SafeHer Safety App`;

    try {
      await Share.share({
        message,
        title: 'Emergency Location',
      });
    } catch (error: any) {
      Alert.alert('Share failed', error.message);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleSOS}>
      <Text style={styles.text}>🆘 SOS</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 200,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
