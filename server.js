// Servidor para la VPS (Easypanel): sirve la PWA y la API sin Vercel ni dependencias extra.
// Replica lo que hacía vercel.json: /api/* → api/index.js, cabeceras de sw.js, manifest e index.html.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/index.js";
import { db } from "./api/_lib/db.js";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.PORT || 3000);
const LIMITE_API_MS = Number(process.env.LIMITE_API_MS || 60000);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
// Solo se sirven archivos de la raíz con estas extensiones: nada de api/, scripts/, .env ni package.json.
const PRIVADOS = new Set(["server.js", "package.json", "package-lock.json"]);

const CABECERAS = {
  "/sw.js": { "Cache-Control": "no-cache, no-store, must-revalidate", "Service-Worker-Allowed": "/" },
  "/manifest.json": { "Content-Type": "application/manifest+json" },
  "/index.html": { "Cache-Control": "no-cache" }
};

// Los helpers de respuesta que Vercel agregaba (res.status, res.json).
function helpers(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (obj) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
}

function estatico(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end(); }
  let nombre = pathname === "/" ? "/index.html" : pathname;
  try { nombre = decodeURIComponent(nombre); } catch { res.statusCode = 400; return res.end(); }
  const base = nombre.slice(1);
  const ext = path.extname(base).toLowerCase();
  if (base.includes("/") || base.includes("\\") || base.startsWith(".") || PRIVADOS.has(base) || !TIPOS[ext]) {
    res.statusCode = 404; return res.end("No encontrado");
  }
  const archivo = path.join(RAIZ, base);
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; return res.end("No encontrado"); }
    res.setHeader("Content-Type", TIPOS[ext]);
    res.setHeader("Content-Length", st.size);
    if (!["/sw.js", "/index.html"].includes(nombre)) res.setHeader("Cache-Control", "public, max-age=3600");
    for (const [k, v] of Object.entries(CABECERAS[nombre] || {})) res.setHeader(k, v);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(archivo).pipe(res);
  });
}

const servidor = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    helpers(res);
    res.setTimeout(LIMITE_API_MS, () => { if (!res.headersSent) res.status(504).json({ error: "Tiempo agotado" }); });
    try { await handler(req, res); }
    catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: "Error del servidor" });
    }
    return;
  }
  estatico(req, res, pathname);
});

servidor.listen(PUERTO, () => console.log(`Levantamientos escuchando en :${PUERTO}`));

// Easypanel manda SIGTERM al redeployar: terminar peticiones en curso y cerrar el pool.
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => {
  console.log(s + ": cerrando…");
  servidor.close(() => Promise.resolve().then(() => db().end()).catch(() => {}).finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10000).unref();
});
