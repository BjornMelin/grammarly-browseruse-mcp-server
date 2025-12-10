/**
 * Timeout utilities for async operations.
 */

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Execute an async function with a timeout.
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param onTimeout - Optional callback executed when timeout occurs (before throwing)
 * @returns The result of the function
 * @throws TimeoutError if the operation times out
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   () => fetch(url),
 *   5000,
 *   () => console.log("Request timed out")
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          onTimeout?.();
          reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
