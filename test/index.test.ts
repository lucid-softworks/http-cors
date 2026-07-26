import { createHttpContext } from "@lucid-softworks/http-core";
import { describe, expect, it, vi } from "vitest";

import { cors } from "../src/index.js";

const run = (
  middleware: ReturnType<typeof cors>,
  request: Request,
  next = vi.fn<() => Promise<Response>>(async () => new Response("ok")),
): Promise<Response> =>
  Promise.resolve(middleware(request, createHttpContext(), next));

describe("HTTP CORS", () => {
  it("passes through requests without an allowed origin", async () => {
    const next = vi.fn<() => Promise<Response>>(async () => new Response("ok"));
    expect(
      (
        await run(
          cors({ origin: "https://allowed.test" }),
          new Request("https://api.test"),
          next,
        )
      ).headers.get("access-control-allow-origin"),
    ).toBeNull();
    expect(
      (
        await run(
          cors({ origin: ["https://other.test"] }),
          new Request("https://api.test", {
            headers: { origin: "https://blocked.test" },
          }),
        )
      ).headers.get("access-control-allow-origin"),
    ).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it("supports wildcard, string, regex, array, and callback origins", async () => {
    const request = new Request("https://api.test", {
      headers: { origin: "https://web.test" },
    });
    const policies = [
      "*",
      "https://web.test",
      /^https:\/\/web/u,
      ["https://web.test"],
      (origin: string): boolean => origin.endsWith(".test"),
    ] as const;
    const responses = await Promise.all(
      policies.map(async (origin) => run(cors({ origin }), request.clone())),
    );
    responses.forEach((response, index) => {
      expect(response.headers.get("access-control-allow-origin")).toBe(
        policies[index] === "*" ? "*" : "https://web.test",
      );
    });
  });

  it("answers detailed and reflected preflights", async () => {
    const request = new Request("https://api.test", {
      headers: {
        "access-control-request-headers": "x-token",
        "access-control-request-method": "POST",
        origin: "https://web.test",
      },
      method: "OPTIONS",
    });
    const detailed = await run(
      cors({
        allowCredentials: true,
        allowHeaders: ["authorization"],
        allowMethods: ["GET", "POST"],
        exposeHeaders: ["x-request-id"],
        maxAge: -2,
        origin: "https://web.test",
      }),
      request.clone(),
    );
    expect(detailed.status).toBe(204);
    expect(Object.fromEntries(detailed.headers)).toMatchObject({
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization",
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-origin": "https://web.test",
      "access-control-expose-headers": "x-request-id",
      "access-control-max-age": "0",
    });
    const reflected = await run(cors(), request);
    expect(reflected.headers.get("access-control-allow-headers")).toBe(
      "x-token",
    );
  });

  it("omits optional preflight headers when absent", async () => {
    const response = await run(
      cors(),
      new Request("https://api.test", {
        headers: { "access-control-request-method": "GET", origin: "x" },
        method: "OPTIONS",
      }),
    );
    expect(response.headers.has("access-control-allow-headers")).toBe(false);
    expect(response.headers.has("access-control-max-age")).toBe(false);
  });
});
