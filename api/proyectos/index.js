import { q } from "../_lib/db.js";
import { manejar } from "../_lib/auth.js";

// Lista (sin fotos): los propios, o todos si es admin y pide ?todos=1
export default manejar(async (req, res, u) => {
  if (req.method !== "GET") return res.status(405).end();
  const todos = u.rol === "admin" && req.query.todos === "1";
  const r = await q(
    `SELECT p.id, p.usuario_id, u.nombre AS usuario_nombre, p.cliente, p.sitio, p.fecha, p.creado, p.modificado, p.borrado,
            (SELECT count(*)::int FROM archivos a WHERE a.proyecto_id = p.id) AS archivos
       FROM proyectos p JOIN usuarios u ON u.id = p.usuario_id
      WHERE ${todos ? "TRUE" : "p.usuario_id = $1"}
      ORDER BY p.modificado DESC`,
    todos ? [] : [u.id]
  );
  res.json({ proyectos: r.rows.map(x => ({ id: x.id, usuarioId: x.usuario_id, usuarioNombre: x.usuario_nombre, cliente: x.cliente, sitio: x.sitio, fecha: x.fecha, creado: Number(x.creado), modificado: Number(x.modificado), borrado: x.borrado, archivos: x.archivos })) });
});
