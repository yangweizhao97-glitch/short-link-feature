import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import {
  JsonShortLinkRepository,
  getShortLinkByCode,
  postShortLinks,
  type ApiErrorBody,
  type ShortLinkRecord,
  type ShortLinkRepository,
} from "./short-links/index.js";

const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 1024 * 32;

export interface ShortLinkServerOptions {
  repository?: ShortLinkRepository;
}

export function createShortLinkServer(
  options: ShortLinkServerOptions = {},
): Server {
  const repository = options.repository ?? new JsonShortLinkRepository();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", getRequestOrigin(request));

      if (request.method === "GET" && url.pathname === "/") {
        writeHtml(response, 200, renderHomePage());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/short-links") {
        const body = await readJsonBody(request);
        const result = await postShortLinks(
          {
            method: request.method,
            body: asPostShortLinksBody(body),
          },
          {
            repository,
            shortLinkBaseUrl: getRequestOrigin(request),
          },
        );

        writeJson(response, result.status, result.body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "GET" && isShortCodePath(url.pathname)) {
        const result = await getShortLinkByCode(
          {
            method: request.method,
            params: {
              code: decodeURIComponent(url.pathname.slice(1)),
            },
          },
          {
            repository,
          },
        );

        if ("headers" in result) {
          response.writeHead(result.status, result.headers);
          response.end();
          return;
        }

        writeJson(response, result.status, result.body);
        return;
      }

      writeJson(response, 404, {
        code: "ROUTE_NOT_FOUND",
        message: "Route was not found.",
      });
    } catch (error) {
      if (error instanceof RequestBodyError) {
        writeJson(response, error.status, {
          code: error.code,
          message: error.message,
        });
        return;
      }

      writeJson(response, 500, {
        code: "INTERNAL_ERROR",
        message: "Internal server error.",
      });
    }
  });
}

function getRequestOrigin(request: IncomingMessage): string {
  const host = request.headers.host ?? `localhost:${DEFAULT_PORT}`;
  return `http://${host}`;
}

function isShortCodePath(pathname: string): boolean {
  return /^\/[^/]+$/.test(pathname);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";

  for await (const chunk of request) {
    body += chunk;

    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new RequestBodyError(
        413,
        "REQUEST_BODY_TOO_LARGE",
        "Request body is too large.",
      );
    }
  }

  if (body.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new RequestBodyError(400, "INVALID_JSON", "Request body is invalid JSON.");
  }
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: ShortLinkRecord | ApiErrorBody | Record<string, unknown>,
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function writeHtml(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(body);
}

function renderHomePage(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>短链接测试</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7f9;
        color: #1f2933;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }

      main {
        width: min(720px, calc(100vw - 32px));
        background: #ffffff;
        border: 1px solid #d8dde5;
        border-radius: 8px;
        padding: 28px;
        box-shadow: 0 16px 50px rgba(31, 41, 51, 0.08);
      }

      h1 {
        margin: 0 0 20px;
        font-size: 24px;
      }

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
      }

      .row {
        display: flex;
        gap: 10px;
      }

      input {
        flex: 1;
        min-width: 0;
        height: 42px;
        border: 1px solid #b8c0cc;
        border-radius: 6px;
        padding: 0 12px;
        font-size: 15px;
      }

      button {
        height: 44px;
        border: 0;
        border-radius: 6px;
        padding: 0 16px;
        background: #0f766e;
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      pre {
        min-height: 120px;
        margin: 20px 0 0;
        padding: 16px;
        overflow: auto;
        border-radius: 6px;
        background: #111827;
        color: #e5e7eb;
        font-size: 13px;
        line-height: 1.5;
      }

      a {
        color: #0f766e;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>短链接测试</h1>
      <form id="form">
        <label for="url">长链接</label>
        <div class="row">
          <input id="url" name="url" type="url" value="https://example.com/articles/very-long-url?from=browser" required>
          <button id="submit" type="submit">生成</button>
        </div>
      </form>
      <pre id="output">等待生成短链接...</pre>
    </main>
    <script>
      const form = document.querySelector("#form");
      const input = document.querySelector("#url");
      const button = document.querySelector("#submit");
      const output = document.querySelector("#output");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        button.disabled = true;
        output.textContent = "请求中...";

        try {
          const response = await fetch("/api/short-links", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              url: input.value
            })
          });
          const data = await response.json();

          if (!response.ok) {
            output.textContent = JSON.stringify(data, null, 2);
            return;
          }

          output.innerHTML =
            JSON.stringify(data, null, 2)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;") +
            "\\n\\n打开短链接：<a href=\\"" + data.shortUrl + "\\" target=\\"_blank\\">" + data.shortUrl + "</a>";
        } catch (error) {
          output.textContent = error instanceof Error ? error.message : String(error);
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

function asPostShortLinksBody(body: unknown): { url?: unknown } | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  return body as { url?: unknown };
}

class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

function shouldStartServer(): boolean {
  return (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (shouldStartServer()) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createShortLinkServer();

  server.listen(port, () => {
    console.log(`Short link service listening on http://localhost:${port}`);
  });
}
