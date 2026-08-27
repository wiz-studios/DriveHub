'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Camera,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import {
  getPendingInspections,
  approveRental,
  Rental,
} from '@/lib/rental-service';
import { canApproveRental } from '@/lib/rbac';
import toast from 'react-hot-toast';

interface InspectionItem {
  rental: Rental;
  selectedForApproval: boolean;
  damageCharge: number;
}

export default function RentalInspectionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [selectedRental, setSelectedRental] = useState<string | null>(null);
  const [damageAmount, setDamageAmount] = useState('0');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadInspections = async () => {
      if (!user) return;

      // Check if user is authorized
      if (!canApproveRental(user)) {
        toast.error('Not authorized to approve rentals');
        router.push('/dashboard');
        return;
      }

      try {
        const pending = await getPendingInspections();
        setInspections(
          pending.map((rental) => ({
            rental,
            selectedForApproval: false,
            damageCharge: 0,
          }))
        );
      } catch (error) {
        console.error('[v0] Error loading inspections:', error);
        toast.error('Failed to load inspections');
      } finally {
        setLoading(false);
      }
    };

    loadInspections();
  }, [user, router]);

  const handleApprove = async (rentalId: string, damageCharge: number) => {
    if (!user) return;

    setApproving(true);

    try {
      await approveRental(rentalId, user.uid, damageCharge);
      setInspections((prev) =>
        prev.filter((item) => item.rental.id !== rentalId)
      );
      toast.success('Rental approved!');
      setSelectedRental(null);
      setDamageAmount('0');
    } catch (error) {
      console.error('[v0] Error approving rental:', error);
      toast.error('Failed to approve rental');
    } finally {
      setApproving(false);
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

  if (inspections.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Rental Inspections
          </h1>
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <CheckCircle2 className="mx-auto text-green-600 mb-4" size={48} />
            <p className="text-lg text-gray-900 font-medium">
              All pending inspections completed!
            </p>
            <p className="text-gray-600">No rentals awaiting approval at this time.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Rental Inspections ({inspections.length})
        </h1>

        <div className="space-y-4">
          {inspections.map((item) => (
            <div
              key={item.rental.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                {/* Booking info */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Booking ID
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {item.rental.bookingId.slice(0, 8)}
                  </p>
                </div>

                {/* Distance info */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Distance
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      Calculated: {item.rental.calculatedDistance} km
                    </p>
                    <p className="text-sm text-gray-600">
                      GPS: {item.rental.gpsDistance} km
                    </p>
                    {item.rental.calculatedDistance &&
                      item.rental.gpsDistance &&
                      Math.abs(
                        item.rental.calculatedDistance -
                          item.rental.gpsDistance
                      ) > 10 && (
                        <p className="text-xs text-amber-600 font-medium">
                          ⚠️ Mismatch detected
                        </p>
                      )}
                  </div>
                </div>

                {/* Late fees */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Late Fees
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {item.rental.lateFeeCharge
                      ? `KES ${item.rental.lateFeeCharge.toLocaleString()}`
                      : 'None'}
                  </p>
                </div>

                {/* Mileage info */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Mileage
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {item.rental.pickupOdometer} → {item.rental.returnOdometer} km
                  </p>
                </div>
              </div>

              {/* Return photos */}
              {item.rental.returnPhotos && item.rental.returnPhotos.length > 0 && (
                <div className="mb-4 border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera size={18} className="text-gray-600" />
                    <p className="font-medium text-gray-900">
                      Return Photos ({item.rental.returnPhotos.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {item.rental.returnPhotos.slice(0, 4).map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Return photo ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Damage assessment */}
              {selectedRental === item.rental.id ? (
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Damage Charges (KES)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={damageAmount}
                      onChange={(e) => setDamageAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter damage charges"
                    />
                  </div>

                  {/* Total charges */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-gray-600">Late fees:</p>
                      <p className="font-medium text-gray-900">
                        KES {(item.rental.lateFeeCharge || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-gray-600">Damage charges:</p>
                      <p className="font-medium text-gray-900">
                        KES {parseInt(damageAmount).toLocaleString()}
                      </p>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <p className="font-semibold text-gray-900">Total:</p>
                      <p className="text-xl font-bold text-blue-600">
                        KES{' '}
                        {(
                          (item.rental.lateFeeCharge || 0) +
                          parseInt(damageAmount)
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleApprove(
                          item.rental.id,
                          parseInt(damageAmount)
                        )
                      }
                      disabled={approving}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                    >
                      {approving ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          Approve & Close
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRental(null);
                        setDamageAmount('0');
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <button
                    onClick={() => {
                      setSelectedRental(item.rental.id);
                      setDamageAmount('0');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                  >
                    <DollarSign size={16} />
                    Review & Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
