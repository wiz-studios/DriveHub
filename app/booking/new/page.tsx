'use client';

import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Calendar, MapPin, DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getVehicle, Vehicle } from '@/lib/db-service';
import { secureCreateBooking, ValidationError, AuthorizationError } from '@/lib/secure-db-service';
import toast from 'react-hot-toast';

export default function NewBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    }>
      <NewBookingForm />
    </Suspense>
  );
}

function NewBookingForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get('vehicleId');

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    pickupLocation: '',
    dropoffLocation: '',
    notes: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/vehicles');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadVehicle = async () => {
      if (!vehicleId) {
        toast.error('Vehicle not found');
        router.push('/vehicles');
        return;
      }

      try {
        const data = await getVehicle(vehicleId);
        if (!data) {
          toast.error('Vehicle not found');
          router.push('/vehicles');
          return;
        }
        setVehicle(data);
      } catch (error) {
        toast.error('Failed to load vehicle details');
        console.error('Error loading vehicle:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadVehicle();
    }
  }, [user, loading, vehicleId, router]);

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  const totalPrice = vehicle ? calculateDays() * vehicle.pricePerDay : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate || !formData.pickupLocation || !formData.dropoffLocation) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setBookingLoading(true);
    try {
      const bookingId = await secureCreateBooking(
        user!.uid,
        user!.uid,
        {
          vehicleId: vehicleId!,
          userId: user!.uid,
          startDate: formData.startDate,
          endDate: formData.endDate,
          pickupLocation: formData.pickupLocation,
          dropoffLocation: formData.dropoffLocation,
          totalPrice,
          status: 'pending',
          paymentStatus: 'unpaid',
          notes: formData.notes,
        }
      );

      toast.success('Booking created! Redirecting to payment...');
      router.push(`/payment/${bookingId}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        const firstError = error.errors[0];
        toast.error(`${firstError.field}: ${firstError.message}`);
      } else if (error instanceof AuthorizationError) {
        toast.error('You are not authorized to create this booking');
      } else {
        toast.error('Failed to create booking');
        console.error('Error creating booking:', error);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user || !vehicle) {
    return null;
  }

  return (
    <DashboardLayout title="New Booking">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Vehicle Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex gap-6">
            <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
              <img src={vehicle.image} alt={vehicle.name} className="w-full h-full object-cover rounded-lg" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{vehicle.name}</h2>
              <p className="text-gray-600">{vehicle.model} • {vehicle.year}</p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-blue-600" />
                  <span className="text-gray-700">{vehicle.location.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-blue-600" />
                  <span className="text-gray-700">${vehicle.pricePerDay} per day</span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Features</h4>
                <div className="flex flex-wrap gap-2">
                  {vehicle.features.map((feature, idx) => (
                    <span key={idx} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Booking Details</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location</label>
              <input
                type="text"
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                placeholder="E.g., Downtown Office"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dropoff Location</label>
              <input
                type="text"
                value={formData.dropoffLocation}
                onChange={(e) => setFormData({ ...formData, dropoffLocation: e.target.value })}
                placeholder="E.g., Airport Terminal A"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special requests or information..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Price Breakdown */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Price Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Rate:</span>
                  <span className="text-gray-900">${vehicle.pricePerDay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Number of Days:</span>
                  <span className="text-gray-900">{calculateDays()}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span className="text-gray-900">Total Price:</span>
                  <span className="text-blue-600 text-lg">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={bookingLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              {bookingLoading && <Loader2 size={20} className="animate-spin" />}
              {bookingLoading ? 'Processing...' : `Proceed to Payment - $${totalPrice.toFixed(2)}`}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
