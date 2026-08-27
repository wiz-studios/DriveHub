'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, DollarSign, Calendar, Users } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getAllBookings, getAllVehicles, Booking, Vehicle } from '@/lib/db-service';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    totalVehicles: 0,
    occupancyRate: 0,
    averageBookingValue: 0,
    completedBookings: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [bookingsData, vehiclesData] = await Promise.all([getAllBookings(), getAllVehicles()]);

        setBookings(bookingsData);
        setVehicles(vehiclesData);

        // Calculate stats
        const totalBookings = bookingsData.length;
        const completedBookings = bookingsData.filter((b) => b.status === 'completed').length;
        const totalRevenue = bookingsData
          .filter((b) => b.paymentStatus === 'paid')
          .reduce((sum, b) => sum + b.totalPrice, 0);
        const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        const rentedVehicles = vehiclesData.filter((v) => v.status === 'rented').length;
        const occupancyRate = vehiclesData.length > 0 ? (rentedVehicles / vehiclesData.length) * 100 : 0;

        setStats({
          totalBookings,
          totalRevenue,
          totalVehicles: vehiclesData.length,
          occupancyRate,
          averageBookingValue,
          completedBookings,
        });
      } catch (error) {
        toast.error('Failed to load analytics');
        console.error('Error loading analytics:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadAnalytics();
    }
  }, [user, loading]);

  // Check if user is admin
  const isAdmin = user?.email?.includes('admin');

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <DashboardLayout title="Analytics">
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
          <p className="text-red-800 font-semibold">Access Denied</p>
          <p className="text-red-700 text-sm mt-2">You need administrator privileges to view analytics.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics Dashboard">
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalBookings}</p>
              </div>
              <Calendar className="text-blue-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="text-green-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg. Booking Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${stats.averageBookingValue.toFixed(2)}</p>
              </div>
              <TrendingUp className="text-purple-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Vehicles</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalVehicles}</p>
              </div>
              <Users className="text-orange-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Occupancy Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.occupancyRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="text-red-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Completed Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completedBookings}</p>
              </div>
              <TrendingUp className="text-green-600 opacity-50" size={40} />
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Bookings</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Booking ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 10).map((booking) => (
                  <tr key={booking.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">#{booking.id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          booking.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : booking.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">${booking.totalPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(booking.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Fleet */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Fleet Status</h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {vehicles.slice(0, 4).map((vehicle) => (
              <div key={vehicle.id} className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-900">{vehicle.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{vehicle.model} • {vehicle.year}</p>

                <div className="mt-3">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                      vehicle.status === 'available'
                        ? 'bg-green-100 text-green-700'
                        : vehicle.status === 'rented'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {vehicle.status}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-3">
                  <strong>${vehicle.pricePerDay}</strong>/day
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
