'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Star } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getAllVehicles, Vehicle } from '@/lib/db-service';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function VehiclesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filtered, setFiltered] = useState<Vehicle[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/vehicles');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await getAllVehicles();
        setVehicles(data);
        setFiltered(data);
      } catch (error) {
        toast.error('Failed to load vehicles');
        console.error('Error loading vehicles:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadVehicles();
    }
  }, [user, loading]);

  useEffect(() => {
    let result = vehicles;

    if (typeFilter !== 'all') {
      result = result.filter((v) => v.type === typeFilter);
    }

    if (priceFilter !== 'all') {
      const [min, max] = priceFilter.split('-').map(Number);
      result = result.filter((v) => v.pricePerDay >= min && v.pricePerDay <= max);
    }

    setFiltered(result);
  }, [typeFilter, priceFilter, vehicles]);

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
    <DashboardLayout title="Browse Vehicles">
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Range (per day)</label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Prices</option>
                <option value="0-50">$0 - $50</option>
                <option value="50-100">$50 - $100</option>
                <option value="100-150">$100 - $150</option>
                <option value="150-99999">$150+</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vehicles Grid */}
        {filtered.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((vehicle) => (
              <div key={vehicle.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                {/* Vehicle Image */}
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  <img src={vehicle.image} alt={vehicle.name} className="w-full h-full object-cover" />
                </div>

                {/* Vehicle Details */}
                <div className="p-4">
                  <h4 className="text-lg font-semibold text-gray-900">{vehicle.name}</h4>
                  <p className="text-sm text-gray-600">{vehicle.model} • {vehicle.year}</p>

                  {/* Features */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {vehicle.features.slice(0, 2).map((feature, idx) => (
                      <span key={idx} className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Location */}
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} />
                    {vehicle.location.address}
                  </div>

                  {/* Rating */}
                  <div className="mt-3 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>

                  {/* Price and Status */}
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">${vehicle.pricePerDay}</p>
                      <p className="text-xs text-gray-600">per day</p>
                    </div>
                    <div>
                      {vehicle.status === 'available' ? (
                        <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                          Available
                        </span>
                      ) : (
                        <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                          Not Available
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Book Button */}
                  <Link
                    href={`/booking/new?vehicleId=${vehicle.id}`}
                    className="mt-4 w-full block text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition disabled:bg-gray-400"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg">No vehicles found matching your filters.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
