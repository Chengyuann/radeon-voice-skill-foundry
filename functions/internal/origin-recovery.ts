import {
  handleOriginRecovery,
  type RadeonOriginEnv
} from "../../shared/cloudflare-origin.js";

type PagesContext = {
  request: Request;
  env: RadeonOriginEnv;
};

export function onRequest(context: PagesContext): Promise<Response> {
  return handleOriginRecovery(context.request, context.env);
}
