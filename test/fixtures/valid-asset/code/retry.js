export function shouldRetry(status) {
  return status === 408 || status === 429 || status >= 500;
}

export function retryDelay(attempt, baseMs = 100, capMs = 5000) {
  return Math.min(capMs, baseMs * (2 ** Math.max(0, attempt - 1)));
}
