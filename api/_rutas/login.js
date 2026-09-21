import { q } from "../_lib/db.js";
import { manejar, verificar, crearSesion, publico } from "../_lib/auth.js";

export default manejar(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { correo, password } = req.body || {};
  if (!correo || !password) return res.status(400).json({ error: "Correo y contraseña" });
  const r = await q("SELECT * FROM usuarios WHERE correo = $1", [String(correo).trim().toLowerCase()]);
  const u = r.rows[0];
  if (!u || !verificar(password, u.hash)) return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  if (!u.activo) return res.status(403).json({ error: "La cuenta está desactivada" });
  const token = await crearSesion(u.id, req);
  res.json({ token, usuario: publico(u) });
}, { auth: false });
