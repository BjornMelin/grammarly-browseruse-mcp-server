/**
 * Time-related utilities for async operations.
 */

/**
 * Sleep for a specified number of milliseconds.
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
