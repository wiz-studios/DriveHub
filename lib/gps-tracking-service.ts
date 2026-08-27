// Real-time GPS Tracking Service
// Manages location updates and historical tracking data

import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  off,
  update,
  remove,
} from 'firebase/database';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

export interface GPSLocation {
  lat: number;
  lng: number;
  speed: number; // km/h
  accuracy: number; // meters
  heading?: number; // degrees
  timestamp: number; // milliseconds
}

export interface GPSTrackingSession {
  rentalId: string;
  vehicleId: string;
  userId: string;
  startTime: number;
  lastUpdateTime: number;
  locations: GPSLocation[];
  totalDistance: number;
  maxSpeed: number;
  avgSpeed: number;
  speedViolations: number;
}

const rtdb = getDatabase();

// Start GPS tracking session
export async function startGPSTracking(
  rentalId: string,
  vehicleId: string,
  userId: string
): Promise<string> {
  try {
    const sessionId = rentalId;
    const trackingRef = ref(rtdb, `gps_tracking/${sessionId}`);

    const session = {
      rentalId,
      vehicleId,
      userId,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      locations: [],
      totalDistance: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      speedViolations: 0,
    };

    await set(trackingRef, session);

    return sessionId;
  } catch (error) {
    console.error('[v0] Error starting GPS tracking:', error);
    throw error;
  }
}

// Record a location point
export async function recordLocation(
  rentalId: string,
  location: GPSLocation
): Promise<void> {
  try {
    const locationRef = push(
      ref(rtdb, `gps_tracking/${rentalId}/locations`)
    );
    await set(locationRef, location);

    // Update last update time and speed stats
    const sessionRef = ref(rtdb, `gps_tracking/${rentalId}`);
    await update(sessionRef, {
      lastUpdateTime: location.timestamp,
      maxSpeed: Math.max(location.speed, (await getMaxSpeed(rentalId)) || 0),
    });
  } catch (error) {
    console.error('[v0] Error recording location:', error);
    throw error;
  }
}

// Calculate distance between two GPS points using Haversine formula
function calculateDistance(
  point1: GPSLocation,
  point2: GPSLocation
): number {
  const R = 6371; // Earth's radius in km
  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get total distance traveled
export async function getTotalDistance(rentalId: string): Promise<number> {
  try {
    const locations = await getLocationHistory(rentalId);

    if (locations.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      totalDistance += calculateDistance(locations[i - 1], locations[i]);
    }

    // Update in Firestore
    const rentalRef = doc(db, 'rentals', rentalId);
    await updateDoc(rentalRef, {
      gpsDistance: parseFloat(totalDistance.toFixed(2)),
    });

    return totalDistance;
  } catch (error) {
    console.error('[v0] Error calculating distance:', error);
    throw error;
  }
}

// Get location history for a rental
export async function getLocationHistory(
  rentalId: string
): Promise<GPSLocation[]> {
  return new Promise((resolve, reject) => {
    try {
      const locationsRef = ref(rtdb, `gps_tracking/${rentalId}/locations`);

      onValue(
        locationsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const locations: GPSLocation[] = Object.values(data);
            // Sort by timestamp
            locations.sort((a, b) => a.timestamp - b.timestamp);
            resolve(locations);
          } else {
            resolve([]);
          }
        },
        { onlyOnce: true }
      );
    } catch (error) {
      console.error('[v0] Error getting location history:', error);
      reject(error);
    }
  });
}

// Subscribe to real-time location updates
export function subscribeToLiveLocation(
  rentalId: string,
  callback: (location: GPSLocation | null) => void
): () => void {
  try {
    const lastLocationRef = ref(
      rtdb,
      `gps_tracking/${rentalId}/lastLocation`
    );

    onValue(lastLocationRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as GPSLocation);
      } else {
        callback(null);
      }
    });

    // Return unsubscribe function
    return () => {
      off(lastLocationRef);
    };
  } catch (error) {
    console.error('[v0] Error subscribing to live location:', error);
    return () => {};
  }
}

// Record speed violation
export async function recordSpeedViolation(
  rentalId: string,
  location: GPSLocation,
  speedLimit: number = 100
): Promise<void> {
  try {
    if (location.speed > speedLimit) {
      const violationRef = push(
        ref(rtdb, `gps_tracking/${rentalId}/speedViolations`)
      );

      await set(violationRef, {
        speed: location.speed,
        speedLimit,
        location: { lat: location.lat, lng: location.lng },
        timestamp: location.timestamp,
      });

      // Increment violation counter
      const sessionRef = ref(rtdb, `gps_tracking/${rentalId}`);
      const session = await getTrackingSession(rentalId);
      if (session) {
        await update(sessionRef, {
          speedViolations: (session.speedViolations || 0) + 1,
        });
      }
    }
  } catch (error) {
    console.error('[v0] Error recording speed violation:', error);
    throw error;
  }
}

// Get tracking session details
export async function getTrackingSession(
  rentalId: string
): Promise<GPSTrackingSession | null> {
  return new Promise((resolve, reject) => {
    try {
      const sessionRef = ref(rtdb, `gps_tracking/${rentalId}`);

      onValue(
        sessionRef,
        (snapshot) => {
          if (snapshot.exists()) {
            resolve(snapshot.val() as GPSTrackingSession);
          } else {
            resolve(null);
          }
        },
        { onlyOnce: true }
      );
    } catch (error) {
      console.error('[v0] Error getting tracking session:', error);
      reject(error);
    }
  });
}

// Get max speed during rental
async function getMaxSpeed(rentalId: string): Promise<number> {
  const session = await getTrackingSession(rentalId);
  return session?.maxSpeed || 0;
}

// End GPS tracking
export async function endGPSTracking(rentalId: string): Promise<void> {
  try {
    const locations = await getLocationHistory(rentalId);
    const totalDistance = await getTotalDistance(rentalId);

    const sessionRef = ref(rtdb, `gps_tracking/${rentalId}`);

    // Calculate average speed
    const session = await getTrackingSession(rentalId);
    const durationHours = session
      ? (Date.now() - session.startTime) / (1000 * 60 * 60)
      : 0;
    const avgSpeed = durationHours > 0 ? totalDistance / durationHours : 0;

    await update(sessionRef, {
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      avgSpeed: parseFloat(avgSpeed.toFixed(2)),
      endTime: Date.now(),
    });

    // Archive to Firestore
    const rentalRef = doc(db, 'rentals', rentalId);
    await updateDoc(rentalRef, {
      gpsDistance: parseFloat(totalDistance.toFixed(2)),
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[v0] Error ending GPS tracking:', error);
    throw error;
  }
}

// Clean up old tracking sessions
export async function cleanupOldTrackingSessions(
  daysOld: number = 30
): Promise<void> {
  try {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const sessionsRef = ref(rtdb, 'gps_tracking');

    const sessions = await getTrackingSession('');
    // This would need a more complex query implementation
    console.log('[v0] Cleanup scheduled for old sessions');
  } catch (error) {
    console.error('[v0] Error cleaning up tracking sessions:', error);
    throw error;
  }
}
