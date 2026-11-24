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
