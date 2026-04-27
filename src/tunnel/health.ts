/** Check whether the tunnel URL is reachable. */
export async function checkTunnelHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/sse`, { method: "GET", signal: AbortSignal.timeout(5_000) });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}
