'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { getBooking, Booking, updateBooking, updatePayment } from '@/lib/db-service';
import toast from 'react-hot-toast';

export default function PaymentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadBooking = async () => {
      if (!bookingId) {
        toast.error('Booking not found');
        router.push('/bookings');
        return;
      }

      try {
        const data = await getBooking(bookingId);
        if (!data) {
          toast.error('Booking not found');
          router.push('/bookings');
          return;
        }
        setBooking(data);
      } catch (error) {
        toast.error('Failed to load booking details');
        console.error('Error loading booking:', error);
      } finally {
        setPageLoading(false);
      }
    };

    if (user && !loading) {
      loadBooking();
    }
  }, [user, loading, bookingId, router]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardData.cardNumber || !cardData.cardName || !cardData.expiryDate || !cardData.cvv) {
      toast.error('Please fill in all card details');
      return;
    }

    setProcessing(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update booking status
      await updateBooking(bookingId, {
        paymentStatus: 'paid',
        status: 'confirmed',
      });

      toast.success('Payment successful! Your booking is confirmed.');
      router.push('/bookings');
    } catch (error) {
      toast.error('Payment failed. Please try again.');
      console.error('Error processing payment:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user || !booking) {
    return null;
  }

  return (
    <DashboardLayout title="Payment">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h3>

          <div className="space-y-3 border-b pb-4 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Booking ID</span>
              <span className="font-medium text-gray-900">#{booking.id.slice(0, 12)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rental Amount</span>
              <span className="font-medium text-gray-900">${booking.totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Insurance (Optional)</span>
              <span className="font-medium text-gray-900">$0.00</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Amount</span>
            <span className="text-3xl font-bold text-blue-600">${booking.totalPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard size={24} className="text-blue-600" />
            Payment Details
          </h3>

          <form onSubmit={handlePayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
              <input
                type="text"
                value={cardData.cardName}
                onChange={(e) => setCardData({ ...cardData, cardName: e.target.value })}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
              <input
                type="text"
                value={cardData.cardNumber}
                onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value.replace(/\s/g, '') })}
                placeholder="4532 1234 5678 9010"
                maxLength={16}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                <input
                  type="text"
                  value={cardData.expiryDate}
                  onChange={(e) => setCardData({ ...cardData, expiryDate: e.target.value })}
                  placeholder="MM/YY"
                  maxLength={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                <input
                  type="password"
                  value={cardData.cvv}
                  onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                  placeholder="123"
                  maxLength={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
              <Lock className="text-blue-600 flex-shrink-0" size={20} />
              <p className="text-sm text-blue-800">
                Your payment information is encrypted and secure. We use industry-standard SSL technology.
              </p>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              {processing && <Loader2 size={20} className="animate-spin" />}
              {processing ? 'Processing Payment...' : `Pay $${booking.totalPrice.toFixed(2)}`}
            </button>

            <p className="text-xs text-gray-600 text-center">
              By completing this purchase, you agree to our terms and conditions.
            </p>
          </form>
        </div>

        {/* Test Card Info */}
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
          <h4 className="font-semibold text-amber-900 mb-2">Demo Mode - Test Card</h4>
          <p className="text-sm text-amber-800">
            Use card number <code className="bg-amber-100 px-2 py-1 rounded">4532123456789010</code> with any future expiry date and any 3-digit CVV
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
