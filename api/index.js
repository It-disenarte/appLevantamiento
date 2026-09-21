// Una sola función serverless (límite de 12 en el plan Hobby de Vercel) que enruta /api/*.
// vercel.json reescribe /api/:ruta* → /api/index?ruta=:ruta*
import estado from "./_rutas/estado.js";
import setup from "./_rutas/setup.js";
import salud from "./_rutas/salud.js";
import login from "./_rutas/login.js";
import salir from "./_rutas/salir.js";
import yo from "./_rutas/yo.js";
import password from "./_rutas/password.js";
import companeros from "./_rutas/companeros.js";
import usuarios from "./_rutas/usuarios.js";
import usuario from "./_rutas/usuario.js";
import proyectos from "./_rutas/proyectos.js";
import proyecto from "./_rutas/proyecto.js";
import compartir from "./_rutas/compartir.js";
import archivo from "./_rutas/archivo.js";
import { leerCuerpo } from "./_lib/auth.js";

export const config = { api: { bodyParser: false } };

const FIJAS = { estado, setup, salud, login, salir, yo, password, companeros, usuarios, proyectos };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const query = Object.fromEntries(url.searchParams.entries());
  const ruta = (query.ruta || url.pathname.replace(/^\/api\/?/, "")).replace(/^\/+|\/+$/g, "");
  const partes = ruta.split("/").filter(Boolean);
  delete query.ruta;

  let fn = null;
  if (partes.length === 1 && FIJAS[partes[0]]) fn = FIJAS[partes[0]];
  else if (partes[0] === "usuarios" && partes.length === 2) { fn = usuario; query.id = partes[1]; }
  else if (partes[0] === "proyectos" && partes.length === 2) { fn = proyecto; query.id = partes[1]; }
  else if (partes[0] === "proyectos" && partes.length === 3 && partes[2] === "compartir") { fn = compartir; query.id = partes[1]; }
  else if (partes[0] === "archivos" && partes.length === 2) { fn = archivo; query.id = partes[1]; }
  if (!fn) { res.status(404).json({ error: "Ruta no encontrada: /api/" + ruta }); return; }

  req.query = query;
  // Los archivos (fotos/audio) leen el cuerpo binario ellos mismos; el resto es JSON.
  if (fn !== archivo && req.method !== "GET" && req.method !== "OPTIONS") {
    const ct = req.headers["content-type"] || "";
    const raw = await leerCuerpo(req);
    if (ct.includes("application/json") && raw.length) {
      try { req.body = JSON.parse(raw.toString("utf8")); } catch { res.status(400).json({ error: "JSON inválido" }); return; }
    } else req.body = {};
  }
  return fn(req, res);
}
