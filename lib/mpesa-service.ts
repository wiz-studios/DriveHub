// M-Pesa Payment Integration Service
// Supports Daraja API for Kenya-based payments

import axios, { AxiosError } from 'axios';
import { db } from './firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

export interface MpesaPaymentRequest {
  phoneNumber: string;
  amount: number;
  description: string;
  bookingId: string;
  userId: string;
}

export interface MpesaPaymentResponse {
  success: boolean;
  transactionId?: string;
  message: string;
  checkoutUrl?: string;
}

export interface MpesaCallback {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  resultCode: number;
  resultDesc: string;
  bookingId: string;
  timestamp: number;
}

// M-Pesa configuration (load from environment)
const MPESA_CONFIG = {
  shortCode: process.env.NEXT_PUBLIC_MPESA_SHORT_CODE || '174379',
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  daraja_url: process.env.MPESA_DARAJA_URL || 'https://sandbox.safaricom.co.ke',
  callback_url: process.env.NEXT_PUBLIC_MPESA_CALLBACK_URL || '',
};

// Get OAuth token from M-Pesa
async function getMpesaToken(): Promise<string> {
  try {
    const auth = Buffer.from(
      `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
    ).toString('base64');

    const response = await axios.get(
      `${MPESA_CONFIG.daraja_url}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('[v0] Error getting M-Pesa token:', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

// Initiate STK push (payment prompt on user's phone)
export async function initiateStkPush(
  request: MpesaPaymentRequest
): Promise<MpesaPaymentResponse> {
  try {
    // Format phone number to 254XXXXXXXXX format
    let phoneNumber = request.phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber;
    }

    // Create payment record in Firestore
    const paymentRef = doc(db, 'payments', `${request.bookingId}_mpesa`);
    await setDoc(paymentRef, {
      bookingId: request.bookingId,
      userId: request.userId,
      amount: request.amount,
      method: 'mpesa',
      phoneNumber,
      description: request.description,
      status: 'pending',
      createdAt: Date.now(),
    });

    // Get OAuth token
    const token = await getMpesaToken();

    // Prepare STK push request
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .substring(0, 14);

    const password = Buffer.from(
      `${MPESA_CONFIG.shortCode}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: MPESA_CONFIG.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(request.amount), // M-Pesa expects whole numbers
      PartyA: phoneNumber,
      PartyB: MPESA_CONFIG.shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: MPESA_CONFIG.callback_url,
      AccountReference: request.bookingId,
      TransactionDesc: request.description,
    };

    const response = await axios.post(
      `${MPESA_CONFIG.daraja_url}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.ResponseCode === '0') {
      return {
        success: true,
        transactionId: response.data.CheckoutRequestID,
        message: 'Payment prompt sent to your phone',
      };
    } else {
      throw new Error(response.data.ResponseDescription);
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('[v0] M-Pesa error:', axiosError.response?.data || error);

    // Update payment status to failed
    try {
      const paymentRef = doc(
        db,
        'payments',
        `${request.bookingId}_mpesa`
      );
      await updateDoc(paymentRef, {
        status: 'failed',
        error: axiosError.message,
        updatedAt: Date.now(),
      });
    } catch (updateError) {
      console.error('[v0] Error updating payment status:', updateError);
    }

    return {
      success: false,
      message:
        (axiosError.response?.data as any)?.errorMessage ||
        'Failed to initiate payment. Please try again.',
    };
  }
}

// Query transaction status
export async function queryTransactionStatus(
  checkoutRequestId: string
): Promise<{ status: string; transactionId?: string }> {
  try {
    const token = await getMpesaToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .substring(0, 14);

    const password = Buffer.from(
      `${MPESA_CONFIG.shortCode}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: MPESA_CONFIG.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await axios.post(
      `${MPESA_CONFIG.daraja_url}/mpesa/stkpushquery/v1/query`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      status: response.data.ResultCode === '0' ? 'completed' : 'pending',
      transactionId: response.data.MerchantRequestID,
    };
  } catch (error) {
    console.error('[v0] Error querying transaction status:', error);
    throw error;
  }
}

// Process M-Pesa callback from Daraja API
export async function processMpesaCallback(
  callback: MpesaCallback
): Promise<void> {
  try {
    const paymentRef = doc(db, 'payments', `${callback.bookingId}_mpesa`);

    if (callback.resultCode === 0) {
      // Payment successful
      await updateDoc(paymentRef, {
        status: 'succeeded',
        transactionId: callback.transactionId,
        processedAt: Date.now(),
      });

      // TODO: Update booking status (will be done by Cloud Function)
    } else {
      // Payment failed
      await updateDoc(paymentRef, {
        status: 'failed',
        error: callback.resultDesc,
        processedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('[v0] Error processing M-Pesa callback:', error);
    throw error;
  }
}

// Refund M-Pesa payment
export async function refundMpesaPayment(
  transactionId: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getMpesaToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .substring(0, 14);

    const payload = {
      Initiator: process.env.MPESA_INITIATOR_NAME || 'testapi',
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
      CommandID: 'Reversal',
      TransactionID: transactionId,
      Amount: Math.ceil(amount),
      ReceiverParty: MPESA_CONFIG.shortCode,
      RecieverIdentifierType: '4',
      Remarks: 'Rental refund',
      QueueTimeoutURL: MPESA_CONFIG.callback_url,
      ResultURL: MPESA_CONFIG.callback_url,
      Occasion: 'Rental refund',
    };

    const response = await axios.post(
      `${MPESA_CONFIG.daraja_url}/mpesa/reversal/v1/request`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.ResponseCode === '0') {
      return {
        success: true,
        message: 'Refund processed successfully',
      };
    } else {
      throw new Error(response.data.ResponseDescription);
    }
  } catch (error) {
    console.error('[v0] M-Pesa refund error:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Refund processing failed',
    };
  }
}
