'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, Car, Calendar, MapPin, DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getAllVehicles, getUserBookings } from '@/lib/db-service';
import Link from 'next/link';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [stats, setStats] = useState({
    activeRentals: 0,
    upcomingBookings: 0,
    totalSpent: 0,
  });
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      try {
        const allVehicles = await getAllVehicles();
        const userBookings = await getUserBookings(user.uid);

        setVehicles(allVehicles.length);
        setBookings(userBookings.length);

        // Calculate stats
        const now = new Date();
        const active = userBookings.filter(
          (b) => new Date(b.startDate) <= now && new Date(b.endDate) >= now && b.status !== 'cancelled'
        ).length;
        const upcoming = userBookings.filter(
          (b) => new Date(b.startDate) > now && b.status !== 'cancelled'
        ).length;
        const spent = userBookings.reduce((sum, b) => sum + b.totalPrice, 0);

        setStats({
          activeRentals: active,
          upcomingBookings: upcoming,
          totalSpent: spent,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadStats();
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

  return (
    <DashboardLayout title="Welcome to DriveHub">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Available Vehicles</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{vehicles}</p>
              </div>
              <Car className="text-blue-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Your Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{bookings}</p>
              </div>
              <Calendar className="text-green-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Rentals</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeRentals}</p>
              </div>
              <MapPin className="text-orange-600 opacity-50" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${stats.totalSpent.toFixed(2)}</p>
              </div>
              <DollarSign className="text-purple-600 opacity-50" size={40} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/vehicles"
              className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition text-center"
            >
              <h4 className="font-semibold text-gray-900">Browse Vehicles</h4>
              <p className="text-sm text-gray-600 mt-1">Find and book your next car</p>
            </Link>
            <Link
              href="/bookings"
              className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition text-center"
            >
              <h4 className="font-semibold text-gray-900">My Bookings</h4>
              <p className="text-sm text-gray-600 mt-1">View and manage your rentals</p>
            </Link>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-8 text-white">
          <h3 className="text-2xl font-bold mb-2">Hello, {user.email}!</h3>
          <p className="text-blue-100">
            Welcome to DriveHub. Start exploring our fleet of vehicles and book your next rental today.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
