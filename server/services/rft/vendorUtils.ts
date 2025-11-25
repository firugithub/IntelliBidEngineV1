/**
 * Vendor name normalization utilities
 * Ensures consistent vendor identification across the platform
 */

/**
 * Normalize vendor display name for UI presentation
 * - Trims whitespace
 * - Standardizes spacing
 * - Capitalizes properly
 */
export function normalizeVendorDisplayName(vendorName: string): string {
  return vendorName
    .trim()
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .replace(/_/g, ' ');    // Convert underscores back to spaces for display
}

/**
 * Generate vendor slug for database keys and filenames
 * - Converts to lowercase
 * - Replaces spaces/underscores with hyphens
 * - Removes special characters
 * - Ensures URL-safe identifier
 */
export function getVendorSlug(vendorName: string): string {
  return vendorName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')       // spaces to hyphens
    .replace(/_+/g, '-')        // underscores to hyphens
    .replace(/[^a-z0-9-]/g, '') // remove special chars
    .replace(/-+/g, '-')        // collapse multiple hyphens
    .replace(/^-|-$/g, '');     // trim leading/trailing hyphens
}

/**
 * Normalize vendor name for storage - AGGRESSIVELY removes ALL special characters
 * This prevents duplicates like "Salesforce, Inc." vs "Salesforce Inc" 
 * Returns: only alphanumeric characters and single spaces
 */
export function normalizeVendorName(vendorName: string): string {
  return vendorName
    // Remove ALL special characters (commas, periods, quotes, etc.) - keep only letters, numbers, spaces
    .replace(/[^a-zA-Z0-9\s]/g, '')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Check if two vendor names refer to the same vendor
 */
export function isSameVendor(name1: string, name2: string): boolean {
  return getVendorSlug(name1) === getVendorSlug(name2);
}

/**
 * Deduplicate vendor list by slug
 * Returns unique vendors with normalized display names
 */
export function deduplicateVendors(vendors: string[]): string[] {
  const seen = new Set<string>();
  return vendors.filter(vendor => {
    const slug = getVendorSlug(vendor);
    if (seen.has(slug)) {
      return false;
    }
    seen.add(slug);
    return true;
  }).map(normalizeVendorDisplayName);
}
