'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Home,
  Car,
  Calendar,
  BarChart3,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title = 'Dashboard' }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard', end: true },
    { href: '/vehicles', icon: Car, label: 'Browse Vehicles' },
    { href: '/bookings', icon: Calendar, label: 'My Bookings' },
    { href: '/tracking', icon: MapPin, label: 'GPS Tracking' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics', admin: true },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-lg shadow"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <MapPin className="text-blue-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-900">DriveHub</h1>
          </Link>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white shadow-sm p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {children}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
