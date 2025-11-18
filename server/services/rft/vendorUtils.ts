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
 * Normalize vendor name for storage
 * Returns consistent format: spaces (not underscores)
 */
export function normalizeVendorName(vendorName: string): string {
  return normalizeVendorDisplayName(vendorName);
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
