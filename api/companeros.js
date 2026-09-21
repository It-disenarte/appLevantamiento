import { q } from "./_lib/db.js";
import { manejar } from "./_lib/auth.js";

// Usuarios activos (sin datos sensibles) para elegir con quién compartir un proyecto.
export default manejar(async (req, res, u) => {
  const r = await q("SELECT id, nombre, correo, rol FROM usuarios WHERE activo ORDER BY nombre");
  res.json({ usuarios: r.rows.filter(x => x.id !== u.id) });
});
