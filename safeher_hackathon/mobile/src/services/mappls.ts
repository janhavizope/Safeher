import axios from 'axios';
import Config from 'react-native-config';

const API_BASE_URL = Config.API_BASE_URL || 'http://localhost:3000';

export interface DirectionsResponse {
  code: number;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: string;
    legs: any[];
    steps: any[];
  }>;
}

export interface AutosuggestResponse {
  code: number;
  results: Array<{
    name: string;
    latitude: number;
    longitude: number;
    placeAddress: string;
  }>;
}

export interface NearbyResponse {
  code: number;
  results: Array<{
    place: string;
    latitude: number;
    longitude: number;
    type: string;
  }>;
}

class MapplsService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  async searchPlaces(query: string, lat?: number, lng?: number): Promise<AutosuggestResponse> {
    try {
      const params: any = { query };
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
      }

      const response = await this.apiClient.get('/api/mappls/autosuggest', { params });
      return response.data;
    } catch (error) {
      console.error('Search places error:', error);
      throw error;
    }
  }

  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    profile: 'driving' | 'walking' = 'driving',
    alternatives: boolean = true
  ): Promise<DirectionsResponse> {
    try {
      const body = {
        origin,
        destination,
        profile,
        alternatives,
        steps: true,
      };

      const response = await this.apiClient.post('/api/mappls/directions', body);
      return response.data;
    } catch (error) {
      console.error('Directions error:', error);
      throw error;
    }
  }

  async getNearbyPlaces(
    lat: number,
    lng: number,
    keywords: string = 'police,hospital,fire_station',
    radius: number = 5000
  ): Promise<NearbyResponse> {
    try {
      const params = {
        lat,
        lng,
        keywords,
        radius,
      };

      const response = await this.apiClient.get('/api/mappls/nearby', { params });
      return response.data;
    } catch (error) {
      console.error('Nearby places error:', error);
      throw error;
    }
  }
}

export const mapplsService = new MapplsService();
