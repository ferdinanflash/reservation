export function workerDispatchRetryDelay(
    retryAfterHeader: string | null,
    errorMessage: string,
    attempt: number,
    now = Date.now(),
    random = Math.random,
): number {
    let serverDelayMs: number | null = null;
    const millisecondsMatch = errorMessage.match(/retry\s+after\s+(\d+(?:\.\d+)?)\s*ms/i);
    const secondsMatch = errorMessage.match(/retry\s+after\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/i);
    if (millisecondsMatch) {
        serverDelayMs = Number(millisecondsMatch[1]);
    } else if (secondsMatch) {
        serverDelayMs = Number(secondsMatch[1]) * 1000;
    }

    if (serverDelayMs === null && retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        const retryAt = Number.isFinite(seconds)
            ? now + Math.max(0, seconds) * 1000
            : Date.parse(retryAfterHeader);
        if (Number.isFinite(retryAt)) serverDelayMs = Math.max(0, retryAt - now);
    }

    // Jitter is added after the server's minimum wait, never before it.
    const jitterMs = 250 + Math.floor(Math.min(0.999999, Math.max(0, random())) * 501);
    if (serverDelayMs !== null && Number.isFinite(serverDelayMs)) {
        return Math.ceil(serverDelayMs) + jitterMs;
    }
    return Math.min(20_000, 1_500 * (2 ** attempt)) + jitterMs;
}
