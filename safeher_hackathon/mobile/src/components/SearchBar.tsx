import React, { useState } from 'react';
import { View, TextInput, StyleSheet, FlatList, Text, TouchableOpacity } from 'react-native';
import { mapplsService } from '../services/mappls';

interface SearchBarProps {
  onSelectPlace: (place: any) => void;
}

export default function SearchBar({ onSelectPlace }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);

    if (text.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await mapplsService.searchPlaces(text);
      setResults(response.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (place: any) => {
    onSelectPlace(place);
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search destination..."
        value={query}
        onChangeText={handleSearch}
        editable={!isSearching}
      />

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => idx.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.result} onPress={() => handleSelectResult(item)}>
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultAddress}>{item.placeAddress}</Text>
            </TouchableOpacity>
          )}
          scrollEnabled={false}
          style={styles.resultsList}
        />
      )}

      {isSearching && <Text style={styles.searching}>Searching...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    left: 10,
    right: 10,
    zIndex: 10,
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 14,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  resultsList: {
    marginTop: 5,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  result: {
    padding: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  searching: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
