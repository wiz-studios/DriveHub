'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, User, Phone, FileText, MapPin, Save } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getUser, updateUser, User as UserType } from '@/lib/db-service';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserType | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
    address: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/settings');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const profile = await getUser(user.uid);
        if (profile) {
          setUserProfile(profile);
          setFormData({
            name: profile.name || '',
            phone: profile.phone || '',
            licenseNumber: profile.licenseNumber || '',
            licenseExpiry: profile.licenseExpiry || '',
            address: profile.address || '',
          });
        }
      } catch (error) {
        toast.error('Failed to load profile');
        console.error('Error loading profile:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadProfile();
    }
  }, [user, loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.licenseNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await updateUser(user!.uid, {
        name: formData.name,
        phone: formData.phone,
        licenseNumber: formData.licenseNumber,
        licenseExpiry: formData.licenseExpiry,
        address: formData.address,
      });

      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

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
    <DashboardLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline mr-2" size={16} />
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline mr-2" size={16} />
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline mr-2" size={16} />
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, New York, NY"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* License Information */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Driver&apos;s License Information
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Number *</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="D123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Expiry Date</label>
                  <input
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={20} className="animate-spin" />}
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Account Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              Your account is secured with Firebase Authentication. You can change your password using the forgot password feature on the login page.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Account Status:</strong> Active
            </p>
            <p className="text-sm text-gray-600">
              <strong>Member Since:</strong> {userProfile ? new Date(userProfile.createdAt).toLocaleDateString() : 'Loading...'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Role:</strong> {userProfile?.role === 'admin' ? 'Administrator' : 'User'}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
