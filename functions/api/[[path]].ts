type Env = {
  RADEON_API_ORIGIN?: string;
  RVSF_API_TOKEN?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  const origin = context.env.RADEON_API_ORIGIN?.replace(/\/$/, "");
  const token = context.env.RVSF_API_TOKEN;
  if (!origin || !token) {
    return Response.json(
      {
        error:
          "The Radeon API gateway is not configured. Set RADEON_API_ORIGIN and RVSF_API_TOKEN."
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

  const response = await fetch(
    new Request(upstream, {
      method: context.request.method,
      headers,
      body:
        context.request.method === "GET" ||
        context.request.method === "HEAD"
          ? undefined
          : context.request.body,
      redirect: "manual"
    })
  );

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.delete("set-cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
