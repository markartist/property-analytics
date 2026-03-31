import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import app from "../../src/index";
import type { Env } from "../../src/env";

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks);
  return new Request(url.toString(), {
    method: req.method,
    headers: requestHeaders(req),
    body,
  });
}

async function sendResponse(res: ServerResponse, response: Response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

export async function startPlatformHttpServer(
  env: Env,
  options: { port?: number; host?: string } = {}
): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const server = createServer(async (req, res) => {
    try {
      const request = await toRequest(req);
      const response = await app.fetch(request, env as never, {});
      await sendResponse(res, response);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            code: "TEST_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Unknown test server error",
            details: [],
          },
        })
      );
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
