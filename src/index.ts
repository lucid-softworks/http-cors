import { withHttpHeaders } from "@lucid-softworks/http-core";
import type { HttpMiddleware } from "@lucid-softworks/http-middleware";

export type CorsOptions = Readonly<{
  allowCredentials?: boolean;
  allowHeaders?: readonly string[];
  allowMethods?: readonly string[];
  exposeHeaders?: readonly string[];
  maxAge?: number;
  origin?:
    | "*"
    | string
    | RegExp
    | readonly string[]
    | ((origin: string) => boolean);
}>;

function allowsOrigin(
  configured: NonNullable<CorsOptions["origin"]>,
  origin: string,
): boolean {
  if (configured === "*") return true;
  if (typeof configured === "string") return configured === origin;
  if (configured instanceof RegExp)
    return new RegExp(configured.source, configured.flags).test(origin);
  if (typeof configured === "function") return configured(origin);
  return configured.includes(origin);
}

/** Creates CORS middleware with explicit origin and preflight policy. */
export function cors(options: CorsOptions = {}): HttpMiddleware {
  const configuredOrigin = options.origin ?? "*";
  const methods = options.allowMethods ?? [
    "GET",
    "HEAD",
    "PUT",
    "PATCH",
    "POST",
    "DELETE",
  ];
  return async (request, _context, next): Promise<Response> => {
    const origin = request.headers.get("origin");
    if (origin === null || !allowsOrigin(configuredOrigin, origin))
      return next();
    const headers = new Headers({
      "access-control-allow-origin": configuredOrigin === "*" ? "*" : origin,
      vary: "Origin",
    });
    if (options.allowCredentials === true) {
      headers.set("access-control-allow-credentials", "true");
    }
    if (options.exposeHeaders !== undefined) {
      headers.set(
        "access-control-expose-headers",
        options.exposeHeaders.join(", "),
      );
    }
    const preflight =
      request.method === "OPTIONS" &&
      request.headers.has("access-control-request-method");
    if (preflight) {
      headers.set("access-control-allow-methods", methods.join(", "));
      const requested = request.headers.get("access-control-request-headers");
      const allowedHeaders = options.allowHeaders?.join(", ") ?? requested;
      if (allowedHeaders !== null)
        headers.set("access-control-allow-headers", allowedHeaders);
      if (options.maxAge !== undefined) {
        headers.set(
          "access-control-max-age",
          String(Math.max(0, Math.trunc(options.maxAge))),
        );
      }
      return new Response(null, { headers, status: 204 });
    }
    return withHttpHeaders(await next(), headers);
  };
}
