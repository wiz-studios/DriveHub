import { createVehicle, getAllVehicles } from './db-service';
import { SAMPLE_VEHICLES } from './sample-vehicles';

export async function initializeSampleData() {
  try {
    const existing = await getAllVehicles();
    
    // Only initialize if database is empty
    if (existing.length === 0) {
      console.log('Initializing sample vehicles...');
      for (const vehicle of SAMPLE_VEHICLES) {
        await createVehicle(vehicle);
      }
      console.log('Sample vehicles initialized successfully!');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error initializing sample data:', error);
    throw error;
  }
}
