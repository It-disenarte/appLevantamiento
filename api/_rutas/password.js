import { q } from "../_lib/db.js";
import { manejar, verificar, hashear, publico, validarPassword, cerrarSesiones, tokenDe } from "../_lib/auth.js";

export default manejar(async (req, res, u) => {
  if (req.method !== "POST") return res.status(405).end();
  const { actual, nueva } = req.body || {};
  const mal = validarPassword(nueva);
  if (mal) return res.status(400).json({ error: mal });
  const r = await q("SELECT hash, debe_cambiar FROM usuarios WHERE id = $1", [u.id]);
  if (!r.rows[0].debe_cambiar && !verificar(actual || "", r.rows[0].hash)) return res.status(401).json({ error: "La contraseña actual no coincide" });
  if (verificar(nueva, r.rows[0].hash)) return res.status(400).json({ error: "La nueva contraseña debe ser distinta" });
  const n = await q("UPDATE usuarios SET hash = $2, debe_cambiar = FALSE WHERE id = $1 RETURNING *", [u.id, hashear(nueva)]);
  await cerrarSesiones(u.id, tokenDe(req)); // cierra las demás sesiones de la cuenta
  res.json({ usuario: publico(n.rows[0]) });
}, { permitirCambioPendiente: true });
