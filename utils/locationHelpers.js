import * as Location from 'expo-location';
import { Platform } from 'react-native';
// had to use claude
/**
 * Enhanced location detection with improved accuracy and error handling
 */
export const getCurrentLocation = async () => {
  try {
    // Check if location services are enabled
    let { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== Location.PermissionStatus.GRANTED) {
      // Request permission if not granted
      const response = await Location.requestForegroundPermissionsAsync();
      status = response.status;
      
      if (status !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission not granted. Please enable location services in your device settings.');
      }
    }

    // Check if location services are enabled on the device
    const locationServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!locationServicesEnabled) {
      throw new Error('Location services are disabled. Please enable them in your device settings.');
    }

    // Get current position with high accuracy
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    // Validate the location data
    if (!location || !location.coords) {
      throw new Error('Unable to retrieve location coordinates.');
    }

    const { coords } = location;
    
    // Check accuracy
    if (coords.accuracy && coords.accuracy > 100) {
      console.warn(`Location accuracy is low: ${coords.accuracy}m. Consider improving GPS signal.`);
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy || undefined,
      altitude: coords.altitude || undefined,
      altitudeAccuracy: coords.altitudeAccuracy || undefined,
      heading: coords.heading || undefined,
      speed: coords.speed || undefined,
    };
  } catch (error) {
    console.error('Location error:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to get current location. Please ensure GPS is enabled and try again.');
    }
  }
};

/**
 * Calculate distance between two points using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000; // Earth's radius in meters
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
};

/**
 * Check if a point is within a given radius from another point
 */
export const isWithinRadius = (
  pointLat,
  pointLon,
  centerLat,
  centerLon,
  radiusMeters
) => {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
  return distance <= radiusMeters;
};

/**
 * Get location with multiple attempts for better accuracy
 */
export const getAccurateLocation = async (
  maxAttempts = 3,
  targetAccuracy = 10
) => {
  let bestLocation = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Location attempt ${attempt} of ${maxAttempts}`);
      
      const location = await getCurrentLocation();
      
      if (!bestLocation || 
          (location.accuracy && location.accuracy < (bestLocation.accuracy || Infinity))) {
        bestLocation = location;
      }
      
      // If we achieved target accuracy, return immediately
      if (location.accuracy && location.accuracy <= targetAccuracy) {
        console.log(`Target accuracy achieved: ${location.accuracy}m`);
        return location;
      }
      
      // Wait a bit before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.warn(`Location attempt ${attempt} failed:`, error);
      
      // If this is the last attempt and we have a previous location, use it
      if (attempt === maxAttempts && bestLocation) {
        console.warn('Using best available location');
        return bestLocation;
      }
    }
  }
  
  if (!bestLocation) {
    throw new Error('Unable to get location after multiple attempts');
  }
  
  return bestLocation;
};

/**
 * Start location tracking for real-time updates
 */
export const startLocationTracking = async (callback) => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== Location.PermissionStatus.GRANTED) {
      throw new Error('Location permission not granted');
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 2,
      },
      (location) => {
        if (location && location.coords) {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            altitudeAccuracy: location.coords.altitudeAccuracy || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
          });
        }
      }
    );

    return subscription;
  } catch (error) {
    console.error('Failed to start location tracking:', error);
    return null;
  }
};

/**
 * Request background location permissions for continuous tracking
 */
export const requestBackgroundLocationPermission = async () => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== Location.PermissionStatus.GRANTED) {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === Location.PermissionStatus.GRANTED;
  } catch (error) {
    console.error('Failed to request background location permission:', error);
    return false;
  }
};

/**
 * Geocode an address to get coordinates
 */
export const geocodeAddress = async (address) => {
  try {
    const results = await Location.geocodeAsync(address);
    
    if (results && results.length > 0) {
      const location = results[0];
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to get address
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    
    if (results && results.length > 0) {
      return results[0];
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
};

/**
 * Check if location is in a predefined area (useful for campus boundaries)
 */
export const isInArea = (location, areaBounds) => {
  return (
    location.latitude <= areaBounds.north &&
    location.latitude >= areaBounds.south &&
    location.longitude <= areaBounds.east &&
    location.longitude >= areaBounds.west
  );
};

/**
 * Get location accuracy description
 */
export const getAccuracyDescription = (accuracy) => {
  if (accuracy <= 5) return 'Excellent';
  if (accuracy <= 10) return 'Good';
  if (accuracy <= 20) return 'Fair';
  if (accuracy <= 50) return 'Poor';
  return 'Very Poor';
};

/**
 * Format coordinates for display
 */
export const formatCoordinates = (location) => {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
};

// ============================================================================
// CROSS-PLATFORM LOCATION HANDLING
// ============================================================================

/**
 * Get platform identifier for logging and cross-platform detection
 */
export const getPlatformIdentifier = () => {
  if (Platform.OS === 'web') return 'WEB';
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'UNKNOWN';
};

/**
 * Determine if we have a cross-platform scenario
 * Returns true only when one party is on web and the other is on mobile
 */
export const isCrossPlatform = (userPlatform, broadcasterPlatform) => {
  if (!userPlatform || !broadcasterPlatform) return false;
  
  const isUserWeb = userPlatform === 'WEB';
  const isBroadcasterWeb = broadcasterPlatform === 'WEB';
  
  // True cross-platform is web + mobile (not web + web or mobile + mobile)
  return isUserWeb !== isBroadcasterWeb;
};

/**
 * Get cross-platform buffer - only applies when one party is on web
 * Web geolocation API: ±100-500m accuracy
 * Mobile GPS: ±5-20m accuracy
 * Web-to-mobile variation: ~500m buffer
 */
export const getPlatformAccuracyBuffer = (userPlatform, broadcasterPlatform) => {
  // No buffer for app-to-app (both mobile)
  if (userPlatform !== 'WEB' && broadcasterPlatform !== 'WEB') {
    return 0;
  }
  
  // No buffer for web-to-web
  if (userPlatform === 'WEB' && broadcasterPlatform === 'WEB') {
    return 0;
  }
  
  // Apply buffer for any web-to-mobile or mobile-to-web scenario
  return 100; // 500m buffer for cross-platform tolerance
  
  
};

/**
 * Check if user is in range of broadcast with cross-platform tolerance
 */
export const isInRange = (broadcastData, userLocation, userPlatform = null, broadcasterPlatform = null) => {
  // If broadcast doesn't use location, it's always "open"
  if (!broadcastData.useLocation) {
    return true;
  }

  // If broadcast has no coordinates, treat as open
  if (!broadcastData.coordinates) {
    return true;
  }

  // If user location is not available, cannot determine range
  if (!userLocation) {
    return false;
  }

  const teacherLocation = broadcastData.coordinates;

  // Validate coordinates - handle both GeoPoint objects and plain objects
  let lat2, lon2;
  
  if (teacherLocation.latitude !== undefined && teacherLocation.longitude !== undefined) {
    lat2 = teacherLocation.latitude;
    lon2 = teacherLocation.longitude;
  } else if (teacherLocation._latitude !== undefined && teacherLocation._longitude !== undefined) {
    // Firestore GeoPoint format
    lat2 = teacherLocation._latitude;
    lon2 = teacherLocation._longitude;
  } else {
    return true; // Treat invalid coordinates as open
  }

  try {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      lat2,
      lon2
    );

    // Determine current platform if not provided
    const currentUserPlatform = userPlatform || getPlatformIdentifier();
    const currentBroadcasterPlatform = broadcasterPlatform || getPlatformIdentifier();

    // Get cross-platform buffer only when needed
    const crossPlatformBuffer = getPlatformAccuracyBuffer(currentUserPlatform, currentBroadcasterPlatform);
    
    const radiusWithBuffer = (broadcastData.radiusMeters || 0) + crossPlatformBuffer;

    console.log(`[${currentUserPlatform}] Distance check: ${Math.round(distance)}m vs Radius: ${broadcastData.radiusMeters}m (cross-platform buffer: ${crossPlatformBuffer}m, total: ${Math.round(radiusWithBuffer)}m)`);
    
    return distance <= radiusWithBuffer;
  } catch (error) {
    console.log('Error calculating distance:', error);
    return true; // Treat errors as open access
  }
};

/**
 * Format location data for storage with platform identifier
 */
export const formatLocationData = (latitude, longitude) => {
  return {
    latitude,
    longitude,
    platform: getPlatformIdentifier(),
    accuracy: Platform.OS === 'web' ? 'high' : 'precise',
    timestamp: new Date().toISOString(),
  };
};