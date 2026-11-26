import { assertEquals } from "jsr:@std/assert@1";
import { workerDispatchRetryDelay } from "./discord-redeem-dispatch.ts";

Deno.test("parses Supabase RateLimitError millisecond retry hint", () => {
    assertEquals(workerDispatchRetryDelay(null, "Rate limit exceeded. Retry after 13130ms.", 0, 1_000, () => 0.5), 13_630);
});
Deno.test("parses Supabase RateLimitError seconds retry hint", () => {
    assertEquals(workerDispatchRetryDelay(null, "Retry after 2.5 seconds", 1, 1_000, () => 0.5), 3_000);
});
Deno.test("uses Retry-After seconds header without capping server delay", () => {
    assertEquals(workerDispatchRetryDelay("45", "", 0, 1_000, () => 0.5), 45_500);
});
Deno.test("uses Retry-After HTTP date", () => {
    assertEquals(workerDispatchRetryDelay("Thu, 01 Jan 1970 00:00:11 GMT", "", 0, 1_000, () => 0.5), 10_500);
});
Deno.test("falls back to exponential delay plus jitter when no server hint exists", () => {
    assertEquals(workerDispatchRetryDelay(null, "temporary failure", 2, 1_000, () => 0.5), 6_500);
});


import { isAmbiguousEmptyRedeemResponse } from "./discord-redeem-dispatch.ts";

Deno.test("retries an empty upstream message with no error code", () => {
    assertEquals(isAmbiguousEmptyRedeemResponse({
        ok: true,
        status: 200,
        data: { msg: "" },
        __httpOk: true,
        __httpStatus: 200,
    }), true);
});

Deno.test("retries an empty upstream payload", () => {
    assertEquals(isAmbiguousEmptyRedeemResponse({
        ok: true,
        status: 200,
        data: {},
        __httpOk: true,
        __httpStatus: 200,
    }), true);
});

Deno.test("does not retry explicit upstream business results", () => {
    assertEquals(isAmbiguousEmptyRedeemResponse({
        data: { msg: "SUCCESS", err_code: 20000 },
        __httpOk: true,
        __httpStatus: 200,
    }), false);
    assertEquals(isAmbiguousEmptyRedeemResponse({
        data: { msg: "RECEIVED.", err_code: 40008 },
        __httpOk: true,
        __httpStatus: 200,
    }), false);
});

Deno.test("does not retry explicit errors or non-empty unknown payloads", () => {
    assertEquals(isAmbiguousEmptyRedeemResponse({
        error: "invalid_fid",
        __httpOk: true,
        __httpStatus: 200,
    }), false);
    assertEquals(isAmbiguousEmptyRedeemResponse({
        data: { raw: "upstream returned HTML" },
        __httpOk: true,
        __httpStatus: 200,
    }), false);
    assertEquals(isAmbiguousEmptyRedeemResponse({
        data: { msg: "" },
        __httpOk: false,
        __httpStatus: 502,
    }), false);
});
