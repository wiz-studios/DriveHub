'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getRental, submitReturnRequest } from '@/lib/rental-service';
import { Rental } from '@/lib/rental-service';
import toast from 'react-hot-toast';

interface ReturnFormData {
  returnOdometer: string;
  damageDescription: string;
  returnPhotos: string[];
}

export default function ReturnPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const rentalId = params.rentalId as string;

  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [formData, setFormData] = useState<ReturnFormData>({
    returnOdometer: '',
    damageDescription: '',
    returnPhotos: [],
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadRental = async () => {
      if (!user) return;

      try {
        const data = await getRental(rentalId);
        if (!data) {
          toast.error('Rental not found');
          router.push('/bookings');
          return;
        }

        if (data.userId !== user.uid) {
          toast.error('Unauthorized');
          router.push('/bookings');
          return;
        }

        if (data.status !== 'active') {
          toast.error('This rental is not active');
          router.push('/bookings');
          return;
        }

        setRental(data);
      } catch (error) {
        console.error('[v0] Error loading rental:', error);
        toast.error('Failed to load rental details');
      } finally {
        setLoading(false);
      }
    };

    loadRental();
  }, [user, rentalId, router]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // In production, upload to Firebase Storage
      // For now, we'll use a mock storage reference
      const photoCount = formData.returnPhotos.length + files.length;
      if (photoCount > 10) {
        toast.error('Maximum 10 photos allowed');
        return;
      }

      // Create mock URLs (in production, these would be Firebase Storage URLs)
      const newPhotos = Array.from(files).map((file) => {
        return URL.createObjectURL(file);
      });

      setFormData({
        ...formData,
        returnPhotos: [...formData.returnPhotos, ...newPhotos],
      });
      setPhotoCount(photoCount);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updatedPhotos = formData.returnPhotos.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      returnPhotos: updatedPhotos,
    });
    setPhotoCount(updatedPhotos.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rental || !user) return;

    if (!formData.returnOdometer) {
      toast.error('Please enter the return mileage');
      return;
    }

    const returnOdometer = parseInt(formData.returnOdometer);
    if (returnOdometer < rental.pickupOdometer) {
      toast.error('Return mileage cannot be less than pickup mileage');
      return;
    }

    if (formData.returnPhotos.length === 0) {
      toast.error('Please upload at least one photo of the vehicle');
      return;
    }

    setSubmitting(true);

    try {
      // In production, this would be a Cloud Function call
      // For now, we'll directly update the rental
      const gpsDistance = 45; // Mock GPS distance (Phase 3 will use real GPS)

      await submitReturnRequest(
        rentalId,
        returnOdometer,
        formData.returnPhotos,
        gpsDistance
      );

      toast.success('Return submitted for inspection!');
      router.push(`/rental/${rentalId}/inspection`);
    } catch (error) {
      console.error('[v0] Error submitting return:', error);
      toast.error('Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  if (!rental) {
    return null;
  }

  const distance = rental.pickupOdometer
    ? parseInt(formData.returnOdometer) - rental.pickupOdometer
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Return Vehicle</h1>

        {/* Rental summary */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rental Summary</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Pickup Mileage</p>
              <p className="text-2xl font-bold text-gray-900">{rental.pickupOdometer} km</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estimated Distance</p>
              <p className="text-2xl font-bold text-blue-600">{distance} km</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Odometer reading */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Current Mileage (km) *
            </label>
            <input
              type="number"
              min={rental.pickupOdometer}
              value={formData.returnOdometer}
              onChange={(e) =>
                setFormData({ ...formData, returnOdometer: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter current mileage"
              disabled={submitting}
            />
            <p className="mt-1 text-sm text-gray-500">
              Must be at least {rental.pickupOdometer} km
            </p>
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Return Photos ({photoCount}/10) *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Camera className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600 mb-4">
                Take photos of the vehicle condition at return
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoCapture}
                disabled={submitting || photoCount >= 10}
                className="hidden"
                id="photo-input"
              />
              <label htmlFor="photo-input">
                <button
                  type="button"
                  onClick={() => document.getElementById('photo-input')?.click()}
                  disabled={submitting}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Upload Photos
                </button>
              </label>
            </div>

            {/* Photo gallery */}
            {formData.returnPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                {formData.returnPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Return photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Damage description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Damage Description (optional)
            </label>
            <textarea
              value={formData.damageDescription}
              onChange={(e) =>
                setFormData({ ...formData, damageDescription: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe any damages to the vehicle"
              rows={4}
              disabled={submitting}
            />
          </div>

          {/* Information box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Before submitting:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Record accurate mileage reading</li>
                <li>Take photos from all angles</li>
                <li>Document any existing damages</li>
                <li>Return vehicle with full tank (if applicable)</li>
              </ul>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || !formData.returnOdometer || photoCount === 0}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Submit Return Request
              </>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
