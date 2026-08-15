import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
const port = Number(process.env.PORT ?? 8787);
const allowedOrigin = process.env.CORS_ORIGIN ?? "*";

createServer((request, response) => {
  void route(request, response);
}).listen(port, () => {
  console.log(`ApplyBoard API listening on http://localhost:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    setCors(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? redact(error.message) : "Unknown error"
    });
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function setCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function redact(message: string): string {
  return message.replace(/(secret|token|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]");
}
