export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationResult {
  constructor(public isValid: boolean, public errors: ValidationError[] = []) {}

  static valid() {
    return new ValidationResult(true, []);
  }

  static invalid(errors: ValidationError[]) {
    return new ValidationResult(false, errors);
  }

  addError(field: string, message: string) {
    this.errors.push({ field, message });
    this.isValid = false;
  }
}

// User validation
export function validateUserEmail(email: string): ValidationResult {
  const result = new ValidationResult(true);
  if (!email || typeof email !== 'string') {
    result.addError('email', 'Email is required');
    return result;
  }
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    result.addError('email', 'Invalid email format');
  }
  return result;
}

export function validateUserPassword(password: string): ValidationResult {
  const result = new ValidationResult(true);
  if (!password || typeof password !== 'string') {
    result.addError('password', 'Password is required');
    return result;
  }
  if (password.length < 8) {
    result.addError('password', 'Password must be at least 8 characters');
  }
  return result;
}

export function validateUserProfile(data: any): ValidationResult {
  const result = new ValidationResult(true);

  if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.length === 0) {
    result.addError('firstName', 'First name is required');
  }
  if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.length === 0) {
    result.addError('lastName', 'Last name is required');
  }
  if (data.phone && !data.phone.match(/^\+?[1-9]\d{1,14}$/)) {
    result.addError('phone', 'Invalid phone number');
  }
  if (data.licenseNumber && typeof data.licenseNumber !== 'string') {
    result.addError('licenseNumber', 'Invalid license number');
  }

  return result;
}

// Booking validation
export function validateBookingDates(startDate: any, endDate: any): ValidationResult {
  const result = new ValidationResult(true);

  if (!startDate || !(startDate instanceof Date || typeof startDate === 'number')) {
    result.addError('startDate', 'Valid start date is required');
    return result;
  }
  if (!endDate || !(endDate instanceof Date || typeof endDate === 'number')) {
    result.addError('endDate', 'Valid end date is required');
    return result;
  }

  const start = typeof startDate === 'number' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'number' ? new Date(endDate) : endDate;

  if (start >= end) {
    result.addError('endDate', 'End date must be after start date');
  }
  if (start < new Date()) {
    result.addError('startDate', 'Start date cannot be in the past');
  }

  return result;
}

export function validateBooking(data: any): ValidationResult {
  const result = new ValidationResult(true);

  if (!data.vehicleId || typeof data.vehicleId !== 'string') {
    result.addError('vehicleId', 'Vehicle must be selected');
  }
  if (!data.userId || typeof data.userId !== 'string') {
    result.addError('userId', 'User ID is required');
  }

  const dateValidation = validateBookingDates(data.startDate, data.endDate);
  if (!dateValidation.isValid) {
    result.errors.push(...dateValidation.errors);
    result.isValid = false;
  }

  if (!data.pickupLocation || typeof data.pickupLocation !== 'string') {
    result.addError('pickupLocation', 'Pickup location is required');
  }
  if (!data.dropoffLocation || typeof data.dropoffLocation !== 'string') {
    result.addError('dropoffLocation', 'Dropoff location is required');
  }

  return result;
}

// Payment validation
export function validatePayment(data: any): ValidationResult {
  const result = new ValidationResult(true);

  if (!data.bookingId || typeof data.bookingId !== 'string') {
    result.addError('bookingId', 'Booking ID is required');
  }
  if (!data.userId || typeof data.userId !== 'string') {
    result.addError('userId', 'User ID is required');
  }
  if (typeof data.amount !== 'number' || data.amount <= 0) {
    result.addError('amount', 'Valid amount is required');
  }
  if (data.amount > 1000000) {
    result.addError('amount', 'Amount is too large');
  }

  return result;
}

// GPS location validation
export function validateGPSLocation(data: any): ValidationResult {
  const result = new ValidationResult(true);

  if (typeof data.lat !== 'number' || data.lat < -90 || data.lat > 90) {
    result.addError('lat', 'Invalid latitude');
  }
  if (typeof data.lng !== 'number' || data.lng < -180 || data.lng > 180) {
    result.addError('lng', 'Invalid longitude');
  }
  if (typeof data.speed !== 'number' || data.speed < 0) {
    result.addError('speed', 'Invalid speed');
  }
  if (typeof data.heading !== 'number' || data.heading < 0 || data.heading >= 360) {
    result.addError('heading', 'Invalid heading');
  }
  if (typeof data.accuracy !== 'number' || data.accuracy < 0) {
    result.addError('accuracy', 'Invalid accuracy');
  }

  return result;
}

// Review validation
export function validateReview(data: any): ValidationResult {
  const result = new ValidationResult(true);

  if (!data.vehicleId || typeof data.vehicleId !== 'string') {
    result.addError('vehicleId', 'Vehicle ID is required');
  }
  if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
    result.addError('rating', 'Rating must be between 1 and 5');
  }
  if (data.comment && typeof data.comment !== 'string') {
    result.addError('comment', 'Comment must be text');
  }
  if (data.comment && data.comment.length > 1000) {
    result.addError('comment', 'Comment is too long');
  }

  return result;
}
