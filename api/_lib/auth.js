import crypto from "node:crypto";
import { q } from "./db.js";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
const DIAS = Number(process.env.SESION_DIAS || 30);
const b64 = (b) => Buffer.from(b).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url");

export const nid = (p) => p + "-" + Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");

// scrypt (nativo de Node, sin dependencias). Parámetros explícitos para que no cambien.
const SCRYPT = { N: 32768, r: 8, p: 1 };
export function hashear(password) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(password, sal, 64, SCRYPT);
  return "scrypt$" + b64(sal) + "$" + b64(h);
}
export function verificar(password, guardado) {
  const [, sal, h] = (guardado || "").split("$");
  if (!sal || !h) return false;
  try {
    const calc = crypto.scryptSync(password, unb64(sal), 64, SCRYPT);
    const ref = unb64(h);
    return calc.length === ref.length && crypto.timingSafeEqual(calc, ref);
  } catch { return false; }
}
export function validarPassword(p) {
  if (typeof p !== "string" || p.length < PASSWORD_MIN) return "La contraseña debe tener al menos " + PASSWORD_MIN + " caracteres";
  if (p.length > PASSWORD_MAX) return "La contraseña es demasiado larga";
  return null;
}
export function passwordAleatoria() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.randomBytes(12);
  return [...b].map(x => A[x % A.length]).join("").replace(/(.{6})/, "$1-");
}

// Sesiones en BD: se pueden cerrar desde el servidor (desactivar cuenta, restablecer contraseña).
export async function crearSesion(usuarioId, req) {
  const token = b64(crypto.randomBytes(32));
  await q("INSERT INTO sesiones (token, usuario_id, expira, user_agent) VALUES ($1,$2,now() + ($3 || ' days')::interval,$4)",
    [token, usuarioId, String(DIAS), (req.headers["user-agent"] || "").slice(0, 300)]);
  await q("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [usuarioId]);
  return token;
}
export function cerrarSesiones(usuarioId, exceptoToken) {
  return exceptoToken
    ? q("DELETE FROM sesiones WHERE usuario_id = $1 AND token <> $2", [usuarioId, exceptoToken])
    : q("DELETE FROM sesiones WHERE usuario_id = $1", [usuarioId]);
}
export function tokenDe(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}
export async function usuarioDe(req) {
  const token = tokenDe(req);
  if (!token) return null;
  const r = await q(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.activo, u.debe_cambiar, s.expira
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = $1 AND s.expira > now()`, [token]);
  const u = r.rows[0];
  if (!u || !u.activo) return null;
  q("UPDATE sesiones SET ultimo_uso = now() WHERE token = $1", [token]).catch(() => {});
  return u;
}

export function publico(u) {
  return u ? { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, debeCambiar: u.debe_cambiar, ultimoAcceso: u.ultimo_acceso || null, creado: u.creado || null } : null;
}

export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ORIGEN_PERMITIDO || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

/**
 * Envuelve un handler: CORS, sesión, rol y bloqueo por contraseña temporal
 * (mientras debe_cambiar = true solo se permiten las rutas con permitirCambioPendiente).
 */
export function manejar(fn, { auth = true, admin = false, permitirCambioPendiente = false } = {}) {
  return async (req, res) => {
    if (cors(req, res)) return;
    try {
      let u = null;
      if (auth) {
        u = await usuarioDe(req);
        if (!u) return res.status(401).json({ error: "Sesión inválida" });
        if (u.debe_cambiar && !permitirCambioPendiente) return res.status(403).json({ error: "Debes cambiar tu contraseña antes de continuar", codigo: "CAMBIO_PENDIENTE" });
        if (admin && u.rol !== "admin") return res.status(403).json({ error: "Solo admin" });
      }
      await fn(req, res, u);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || "Error del servidor" });
    }
  };
}

export function leerCuerpo(req) {
  return new Promise((res, rej) => {
    const partes = [];
    req.on("data", c => partes.push(c));
    req.on("end", () => res(Buffer.concat(partes)));
    req.on("error", rej);
  });
}
