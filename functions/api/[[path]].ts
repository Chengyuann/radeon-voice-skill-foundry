import {
  resolveRadeonOrigins,
  type RadeonOriginEnv
} from "../../shared/cloudflare-origin.js";

type PagesContext = {
  request: Request;
  env: RadeonOriginEnv;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  return proxyRadeonRequest(context.request, context.env);
}

export async function proxyRadeonRequest(
  request: Request,
  env: RadeonOriginEnv,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const origins = await resolveRadeonOrigins(env);
  const token = env.RVSF_API_TOKEN;
  if (!origins.length || !token) {
    return Response.json(
      {
        error:
          "The Radeon API gateway is not configured. Set an origin registry value or RADEON_API_ORIGIN, plus RVSF_API_TOKEN."
      },
      { status: 503 }
    );
  }

  const incoming = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.set("x-rvsf-api-token", token);

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const retryable =
    method === "GET" ||
    method === "HEAD" ||
    (method === "POST" && incoming.pathname === "/api/verify");
  const requestOrigins =
    !retryable && origins.length > 1
      ? await selectHealthyOrigin(origins, headers, fetcher)
      : origins;
  if (!requestOrigins.length) {
    return Response.json(
      { error: "No healthy Radeon origin is available" },
      { status: 503 }
    );
  }
  const bufferedBody = hasBody ? await request.arrayBuffer() : undefined;
  const createUpstreamRequest = (origin: string) => {
    const upstream = new URL(
      `${incoming.pathname}${incoming.search}`,
      origin
    );
    return new Request(upstream, {
      method: request.method,
      headers,
      body: hasBody ? bufferedBody?.slice(0) : undefined,
      redirect: "manual"
    });
  };

  let response: Response | undefined;
  let selectedOrigin: string | undefined;
  let lastError: unknown;
  for (const [index, origin] of requestOrigins.entries()) {
    try {
      response = await fetcher(createUpstreamRequest(origin));
      if (
        retryable &&
        index < requestOrigins.length - 1 &&
        [404, 502, 503, 504, 530].includes(response.status)
      ) {
        await response.body?.cancel();
        response = undefined;
        continue;
      }
      selectedOrigin = origin;
      break;
    } catch (error) {
      lastError = error;
      response = undefined;
      if (!retryable || index === requestOrigins.length - 1) break;
    }
  }
  if (!response) {
    throw lastError || new Error("Radeon origins unavailable");
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "no-store");
  if (selectedOrigin) {
    responseHeaders.set(
      "x-rvsf-origin-kind",
      selectedOrigin.includes(".radeon.firstdg.ai")
        ? "rc-tunnel"
        : "quick-tunnel"
    );
  }
  responseHeaders.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

async function selectHealthyOrigin(
  origins: string[],
  headers: Headers,
  fetcher: typeof fetch
): Promise<string[]> {
  for (const origin of origins) {
    try {
      const response = await fetcher(
        new Request(new URL("/api/health", origin), {
          method: "GET",
          headers,
          redirect: "manual"
        })
      );
      await response.body?.cancel();
      if (response.ok) return [origin];
    } catch {
      // Continue to the next independently managed tunnel.
    }
  }
  return [];
}
