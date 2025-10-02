/**
 * Mobile subscription compliance utilities
 * Handles App Store and Play Store policies for in-app subscription management
 * 
 * @source Extracted from ScheduleBoard v2
 * @license MIT
 * 
 * IMPORTANT: When using this in your app, update the base URL to your domain
 */
import { Capacitor } from '@capacitor/core';

/**
 * Detects if the app is running as a native mobile app
 * and handles subscription flows appropriately for App Store compliance
 */
export function isMobileApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Handles subscription upgrade in a mobile-compliant way
 * Redirects to web version for payment processing to comply with App Store policies
 * 
 * @param tier - The subscription tier to upgrade to
 * @param baseUrl - Your app's base URL (e.g., 'https://yourapp.com')
 */
export function handleMobileSubscriptionUpgrade(
  tier: string,
  baseUrl: string = 'https://yourapp.com' // TODO: Update this to your domain
) {
  if (isMobileApp()) {
    // Open web version in system browser for subscription management
    const subscribeUrl = `${baseUrl}/subscribe?tier=${tier}&source=mobile`;
    
    if (Capacitor.getPlatform() === 'ios') {
      // iOS - open in Safari
      window.open(subscribeUrl, '_system');
    } else if (Capacitor.getPlatform() === 'android') {
      // Android - open in default browser
      window.open(subscribeUrl, '_system');
    }
    
    return true; // Indicates we handled it
  }
  
  return false; // Let normal flow continue
}

/**
 * Gets platform-appropriate subscription management text
 */
export function getSubscriptionText() {
  if (isMobileApp()) {
    return {
      upgradeButton: "Manage Subscription",
      upgradeDescription: "Tap to manage your subscription in the web browser",
      paymentNote: "Subscription management is handled through our website for security and compliance."
    };
  }
  
  return {
    upgradeButton: "Upgrade Plan",
    upgradeDescription: "Upgrade to unlock more features",
    paymentNote: "Secure payment processing powered by Stripe"
  };
}
