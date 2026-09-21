import { q } from "../_lib/db.js";
import { manejar, hashear, publico, passwordAleatoria, cerrarSesiones } from "../_lib/auth.js";

export default manejar(async (req, res, admin) => {
  const { id } = req.query;
  if (req.method !== "PATCH") return res.status(405).end();
  const { activo, nombre, rol, resetPassword } = req.body || {};
  if (id === admin.id && (activo === false || (rol && rol !== "admin"))) return res.status(400).json({ error: "No puedes desactivarte ni quitarte el rol admin a ti mismo" });
  let temporal = null;
  if (typeof activo === "boolean") {
    await q("UPDATE usuarios SET activo = $2 WHERE id = $1", [id, activo]);
    if (!activo) await cerrarSesiones(id);
  }
  if (nombre) await q("UPDATE usuarios SET nombre = $2 WHERE id = $1", [id, String(nombre).trim()]);
  if (rol === "admin" || rol === "usuario") await q("UPDATE usuarios SET rol = $2 WHERE id = $1", [id, rol]);
  if (resetPassword) {
    temporal = passwordAleatoria();
    await q("UPDATE usuarios SET hash = $2, debe_cambiar = TRUE WHERE id = $1", [id, hashear(temporal)]);
    await cerrarSesiones(id);
  }
  const r = await q("SELECT * FROM usuarios WHERE id = $1", [id]);
  if (!r.rowCount) return res.status(404).json({ error: "No existe" });
  res.json({ usuario: publico(r.rows[0]), passwordTemporal: temporal });
}, { admin: true });
