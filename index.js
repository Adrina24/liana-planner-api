export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      if (url.pathname === "/api/signup" && request.method === "POST") {
        const { email, password } = await request.json();
        if (!email || !password || password.length < 6) return json({ error: "invalid" }, 400, cors);
        const key = "auth:" + email.toLowerCase();
        const existing = await env.PLANNER_KV.get(key);
        if (existing) return json({ error: "exists" }, 400, cors);
        const salt = randHex(16);
        const hash = await hashPass(password, salt);
        await env.PLANNER_KV.put(key, JSON.stringify({ salt, hash }));
        const token = await makeToken(email.toLowerCase(), env.AUTH_SECRET);
        return json({ token, email: email.toLowerCase() }, 200, cors);
      }

      if (url.pathname === "/api/login" && request.method === "POST") {
        const { email, password } = await request.json();
        const key = "auth:" + (email || "").toLowerCase();
        const recRaw = await env.PLANNER_KV.get(key);
        if (!recRaw) return json({ error: "nouser" }, 400, cors);
        const rec = JSON.parse(recRaw);
        const hash = await hashPass(password, rec.salt);
        if (hash !== rec.hash) return json({ error: "wrongpass" }, 400, cors);
        const token = await makeToken(email.toLowerCase(), env.AUTH_SECRET);
        return json({ token, email: email.toLowerCase() }, 200, cors);
      }

      if (url.pathname === "/api/data" && (request.method === "GET" || request.method === "PUT")) {
        const email = await verifyToken(request, env.AUTH_SECRET);
        if (!email) return json({ error: "unauthorized" }, 401, cors);
        const dataKey = "data:" + email;
        if (request.method === "GET") {
          const data = await env.PLANNER_KV.get(dataKey);
          return json({ data: data ? JSON.parse(data) : null }, 200, cors);
        } else {
          const body = await request.json();
          await env.PLANNER_KV.put(dataKey, JSON.stringify(body));
          return json({ ok: true }, 200, cors);
        }
      }

      return json({ error: "notfound" }, 404, cors);
    } catch (e) {
      return json({ error: "server", message: String(e) }, 500, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function randHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashPass(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + ":" + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hmac(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function makeToken(email, secret) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = email + "|" + exp;
  const sig = await hmac(payload, secret);
  return btoa(payload) + "." + sig;
}
async function verifyToken(request, secret) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  let payload;
  try { payload = atob(b64); } catch (e) { return null; }
  const expectedSig = await hmac(payload, secret);
  if (expectedSig !== sig) return null;
  const [email, exp] = payload.split("|");
  if (Date.now() > Number(exp)) return null;
  return email;
}
