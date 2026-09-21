import { q } from "../_lib/db.js";
import { manejar, hashear, nid, publico, passwordAleatoria } from "../_lib/auth.js";

export default manejar(async (req, res) => {
  if (req.method === "GET") {
    const r = await q(`SELECT u.*, (SELECT count(*)::int FROM proyectos p WHERE p.usuario_id = u.id AND NOT p.borrado) AS proyectos
                       FROM usuarios u ORDER BY rol = 'admin' DESC, nombre`);
    return res.json({ usuarios: r.rows.map(x => ({ ...publico(x), proyectos: x.proyectos })) });
  }
  if (req.method === "POST") {
    const { nombre, correo, rol } = req.body || {};
    if (!nombre || !correo) return res.status(400).json({ error: "Nombre y correo" });
    const c = String(correo).trim().toLowerCase();
    const dup = await q("SELECT 1 FROM usuarios WHERE correo = $1", [c]);
    if (dup.rowCount) return res.status(409).json({ error: "Ese correo ya tiene cuenta" });
    const temporal = passwordAleatoria();
    const r = await q(
      "INSERT INTO usuarios (id, nombre, correo, hash, rol, debe_cambiar) VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *",
      [nid("u"), nombre.trim(), c, hashear(temporal), rol === "admin" ? "admin" : "usuario"]
    );
    return res.json({ usuario: publico(r.rows[0]), passwordTemporal: temporal });
  }
  res.status(405).end();
}, { admin: true });
