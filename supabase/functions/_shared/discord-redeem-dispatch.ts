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


/**
 * An HTTP-successful Edge Function call can still contain an empty upstream
 * payload. Treat only responses with no message/code as ambiguous; explicit
 * business outcomes (including err_code) must never be retried here.
 */
export function isAmbiguousEmptyRedeemResponse(result: unknown): boolean {
    if (!result || typeof result !== "object" || Array.isArray(result)) return false;
    const response = result as Record<string, unknown>;
    if (response.__httpOk === false) return false;
    if (typeof response.error === "string" && response.error.trim()) return false;

    if (response.data === undefined || response.data === null) {
        const status = Number(response.__httpStatus);
        return response.__httpOk === true && status >= 200 && status < 300;
    }
    if (typeof response.data !== "object" || Array.isArray(response.data)) return false;

    const data = response.data as Record<string, unknown>;
    const message = String(data.msg ?? data.message ?? "").trim();
    if (message) return false;
    if (data.err_code !== undefined && data.err_code !== null && data.err_code !== "") return false;

    return Object.entries(data).every(([key, value]) =>
        key === "msg" || key === "message" || value === null || value === undefined || value === ""
    );
}
