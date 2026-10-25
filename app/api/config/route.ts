import os from "node:os";

/**
 * Tells the browser where the backend API is running.
 *
 * The FastAPI server and the Next dev server live on the same machine, so the
 * first non-loopback IPv4 address of this machine is also the backend's
 * reachable address from any device on the LAN.
 */
export function GET() {
  const ip =
    Object.values(os.networkInterfaces())
      .flat()
      .filter((n) => n && n.family === "IPv4" && !n.internal)
      .map((n) => n!.address)[0] ?? "127.0.0.1";

  return Response.json({ backendUrl: `http://${ip}:8000` });
}
