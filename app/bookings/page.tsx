'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getUserBookings, Booking, updateBooking } from '@/lib/db-service';
import toast from 'react-hot-toast';

export default function BookingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/bookings');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadBookings = async () => {
      if (!user) return;

      try {
        const data = await getUserBookings(user.uid);
        setBookings(data.sort((a, b) => b.createdAt - a.createdAt));
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

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await updateBooking(bookingId, { status: 'cancelled' });
      toast.success('Booking cancelled successfully');
      setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
    } catch (error) {
      toast.error('Failed to cancel booking');
      console.error('Error cancelling booking:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'unpaid':
        return 'bg-red-100 text-red-700';
      case 'refunded':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filtered = bookings.filter((booking) => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

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

  return (
    <DashboardLayout title="My Bookings">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((booking) => (
              <div key={booking.id} className="bg-white rounded-lg shadow p-6">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {/* Booking Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Booking #{booking.id.slice(0, 8)}</h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-gray-700">
                          {new Date(booking.startDate).toLocaleDateString()} -{' '}
                          {new Date(booking.endDate).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-gray-700">{booking.pickupLocation}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-gray-400" />
                        <span className="text-gray-700">${booking.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <div className="flex gap-2 mb-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(booking.paymentStatus)}`}>
                        {booking.paymentStatus === 'unpaid' ? 'Unpaid' : booking.paymentStatus === 'paid' ? 'Paid' : 'Refunded'}
                      </span>
                    </div>

                    {booking.notes && (
                      <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-500 mt-3">
                        <p className="text-sm text-gray-700">{booking.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.paymentStatus !== 'paid' && (
                    <button
                      onClick={() => router.push(`/payment/${booking.id}`)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
                    >
                      Pay Now
                    </button>
                  )}
                  {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="px-4 py-2 border border-red-500 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/booking/${booking.id}`)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={40} />
            <p className="text-gray-600 text-lg mb-4">No bookings found.</p>
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
