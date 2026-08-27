'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Navigation, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getUserBookings, getVehicle, Vehicle, Booking } from '@/lib/db-service';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components
const Map = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 flex items-center justify-center">Loading map...</div>,
});

export default function TrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/tracking');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadBookings = async () => {
      if (!user) return;

      try {
        const data = await getUserBookings(user.uid);
        const active = data.filter(
          (b) =>
            new Date(b.startDate) <= new Date() &&
            new Date(b.endDate) >= new Date() &&
            b.status !== 'cancelled'
        );
        setBookings(data);
        if (active.length > 0) {
          setActiveBooking(active[0]);
          const vehicleData = await getVehicle(active[0].vehicleId);
          setVehicle(vehicleData);
        }
      } catch (error) {
        toast.error('Failed to load bookings');
        console.error('Error loading bookings:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadBookings();
    }
  }, [user, loading]);

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const activeRentals = bookings.filter(
    (b) =>
      new Date(b.startDate) <= new Date() &&
      new Date(b.endDate) >= new Date() &&
      b.status !== 'cancelled'
  );

  return (
    <DashboardLayout title="GPS Tracking">
      <div className="space-y-6">
        {/* Active Rentals Selector */}
        {activeRentals.length > 0 ? (
          <>
            {/* Booking Selector */}
            {activeRentals.length > 1 && (
              <div className="bg-white rounded-lg shadow p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Active Rental</label>
                <select
                  value={activeBooking?.id || ''}
                  onChange={(e) => {
                    const selected = activeRentals.find((b) => b.id === e.target.value);
                    setActiveBooking(selected || null);
                    if (selected) {
                      getVehicle(selected.vehicleId).then(setVehicle);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {activeRentals.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      Booking #{booking.id.slice(0, 8)} - From {new Date(booking.startDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Map */}
            {activeBooking && vehicle && (
              <>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="h-96 w-full">
                    <Map
                      center={[vehicle.location.lat, vehicle.location.lng]}
                      vehicleId={activeBooking.vehicleId}
                      vehicleName={vehicle.name}
                    />
                  </div>
                </div>

                {/* Booking Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Details</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-semibold text-gray-900">{vehicle.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">License Plate</p>
                        <p className="font-semibold text-gray-900">{vehicle.licensePlate}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Current Location</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Navigation className="text-blue-600" size={16} />
                          <p className="font-semibold text-gray-900">{vehicle.location.address}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Mileage</p>
                        <p className="font-semibold text-gray-900">{vehicle.mileage} miles</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Rental Details</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Rental Start</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(activeBooking.startDate).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Rental End</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(activeBooking.endDate).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Pickup Location</p>
                        <p className="font-semibold text-gray-900">{activeBooking.pickupLocation}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dropoff Location</p>
                        <p className="font-semibold text-gray-900">{activeBooking.dropoffLocation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={40} />
            <p className="text-gray-600 text-lg mb-4">No active rentals to track.</p>
            <button
              onClick={() => router.push('/vehicles')}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Browse Vehicles
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
