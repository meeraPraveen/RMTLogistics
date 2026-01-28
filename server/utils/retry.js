/**
 * Retry Utility
 * Provides retry logic with exponential backoff for async operations
 */

/**
 * Execute an async function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable (default: always retry)
 * @param {Function} options.onRetry - Callback called before each retry attempt
 * @returns {Promise<any>} - Result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry({
          attempt: attempt + 1,
          maxRetries,
          delay,
          error
        });
      }

      console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms...`);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if an Auth0 error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
export const isRetryableAuth0Error = (error) => {
  // Don't retry 4xx errors (except rate limiting)
  if (error.statusCode >= 400 && error.statusCode < 500) {
    // 429 = Rate limited, should retry
    if (error.statusCode === 429) return true;
    // 404 = Not found, no point retrying
    // 400, 401, 403 = Client errors, no point retrying
    return false;
  }

  // Retry 5xx errors (server errors)
  if (error.statusCode >= 500) return true;

  // Retry network errors
  if (error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED') {
    return true;
  }

  // Default: retry unknown errors
  return true;
};

export default {
  withRetry,
  sleep,
  isRetryableAuth0Error
};
