'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Loader2, MapPin, Users, Zap, Shield, Clock, DollarSign } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MapPin className="text-blue-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-900">DriveHub</h1>
          </div>
          <div className="flex gap-4">
            <Link
              href="/auth/login"
              className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Premium Car Rental Service
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Find and rent the perfect vehicle for your journey. Fast, convenient, and reliable.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition"
        >
          Browse Vehicles
        </Link>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Choose DriveHub</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Zap className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Instant Booking</h4>
              <p className="text-gray-600">Book your car in minutes with our simple booking process.</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Shield className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Secure & Safe</h4>
              <p className="text-gray-600">All vehicles are inspected and fully insured for your peace of mind.</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Clock className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Flexible Rental</h4>
              <p className="text-gray-600">Hourly, daily, or weekly rentals - choose what works for you.</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <MapPin className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">GPS Tracking</h4>
              <p className="text-gray-600">Real-time vehicle tracking for complete visibility and control.</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <DollarSign className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Best Prices</h4>
              <p className="text-gray-600">Competitive rates with no hidden fees. Transparent pricing always.</p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Users className="text-blue-600 mb-4" size={32} />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">24/7 Support</h4>
              <p className="text-gray-600">Our customer support team is always available to help.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16 text-white text-center">
        <h3 className="text-3xl font-bold mb-4">Ready to rent a car?</h3>
        <p className="text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of satisfied customers and book your next vehicle today.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold transition"
        >
          Sign Up Now
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2024 DriveHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
