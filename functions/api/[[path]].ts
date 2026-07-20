import {
  resolveRadeonOrigin,
  type RadeonOriginEnv
} from "../../shared/cloudflare-origin.js";

type PagesContext = {
  request: Request;
  env: RadeonOriginEnv;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  const origin = await resolveRadeonOrigin(context.env);
  const token = context.env.RVSF_API_TOKEN;
  if (!origin || !token) {
    return Response.json(
      {
        error:
          "The Radeon API gateway is not configured. Set an origin registry value or RADEON_API_ORIGIN, plus RVSF_API_TOKEN."
      },
      { status: 503 }
    );
  }

  const incoming = new URL(context.request.url);
  const upstream = new URL(`${incoming.pathname}${incoming.search}`, origin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.set("x-rvsf-api-token", token);

  const method = context.request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const retryable =
    method === "GET" ||
    method === "HEAD" ||
    (method === "POST" && incoming.pathname === "/api/verify");
  const bufferedBody =
    retryable && hasBody ? await context.request.arrayBuffer() : undefined;
  const createUpstreamRequest = () =>
    new Request(upstream, {
      method: context.request.method,
      headers,
      body: hasBody
        ? retryable
          ? bufferedBody?.slice(0)
          : context.request.body
        : undefined,
      redirect: "manual"
    });

  let response: Response;
  try {
    response = await fetch(createUpstreamRequest());
  } catch (error) {
    if (!retryable) throw error;
    await retryDelay();
    response = await fetch(createUpstreamRequest());
  }
  if (retryable && [502, 503, 504].includes(response.status)) {
    await response.body?.cancel();
    await retryDelay();
    response = await fetch(createUpstreamRequest());
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

function retryDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}
