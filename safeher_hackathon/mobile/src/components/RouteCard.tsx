import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RouteCardProps {
  route: any;
  distance: number;
  duration: number;
  risk: number;
}

export default function RouteCard({ route, distance, duration, risk }: RouteCardProps) {
  const getRiskColor = (score: number) => {
    if (score < 20) return '#27ae60'; // Green
    if (score < 50) return '#f39c12'; // Orange
    return '#e74c3c'; // Red
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.distance}>{distance.toFixed(1)} km</Text>
          <Text style={styles.label}>Distance</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.duration}>{duration} min</Text>
          <Text style={styles.label}>Duration</Text>
        </View>

        <View style={[styles.info, { borderLeftWidth: 1, borderLeftColor: '#eee' }]}>
          <Text style={[styles.risk, { color: getRiskColor(risk) }]}>
            Risk: {risk}%
          </Text>
          <Text style={styles.label}>Safety</Text>
        </View>
      </View>

      {route.instructions && route.instructions.length > 0 && (
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Directions:</Text>
          {route.instructions.slice(0, 3).map((instr: string, idx: number) => (
            <Text key={idx} style={styles.instruction}>
              {idx + 1}. {instr}
            </Text>
          ))}
          {route.instructions.length > 3 && (
            <Text style={styles.more}>+{route.instructions.length - 3} more</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  info: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  distance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  duration: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3498db',
  },
  risk: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  instructions: {
    marginTop: 12,
  },
  instructionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 12,
    color: '#555',
    marginBottom: 6,
    lineHeight: 16,
  },
  more: {
    fontSize: 11,
    color: '#3498db',
    fontWeight: '500',
    marginTop: 4,
  },
});
