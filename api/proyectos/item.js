import { q } from "../_lib/db.js";
import { manejar } from "../_lib/auth.js";

export default manejar(async (req, res, u) => {
  const { id } = req.query;
  const r = await q("SELECT * FROM proyectos WHERE id = $1", [id]);
  const p = r.rows[0];
  const puede = !p || u.rol === "admin" || p.usuario_id === u.id;
  if (!puede) return res.status(403).json({ error: "Sin acceso a este proyecto" });

  if (req.method === "GET") {
    if (!p) return res.status(404).json({ error: "No existe" });
    const a = await q("SELECT id, tipo, tam FROM archivos WHERE proyecto_id = $1", [id]);
    return res.json({ proyecto: { ...p.datos, id: p.id, usuarioId: p.usuario_id, creado: Number(p.creado), modificado: Number(p.modificado), borrado: p.borrado }, archivos: a.rows });
  }
  if (req.method === "PUT") {
    const d = req.body && req.body.proyecto;
    if (!d || d.id !== id) return res.status(400).json({ error: "Proyecto inválido" });
    if (p && Number(p.modificado) > Number(d.modificado || 0)) {
      // El servidor tiene una versión más nueva: no se sobreescribe.
      const a = await q("SELECT id, tipo, tam FROM archivos WHERE proyecto_id = $1", [id]);
      return res.status(409).json({ error: "Versión más nueva en el servidor", proyecto: { ...p.datos, id: p.id, usuarioId: p.usuario_id, creado: Number(p.creado), modificado: Number(p.modificado) }, archivos: a.rows });
    }
    const { id: _i, usuarioId: _u, creado, modificado, borrado, ...datos } = d;
    await q(
      `INSERT INTO proyectos (id, usuario_id, cliente, sitio, fecha, datos, creado, modificado, borrado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
       ON CONFLICT (id) DO UPDATE SET cliente = $3, sitio = $4, fecha = $5, datos = $6, modificado = $8, borrado = FALSE`,
      [id, p ? p.usuario_id : u.id, d.cliente || "", d.sitio || "", d.fecha || "", JSON.stringify(datos), creado || Date.now(), modificado || Date.now()]
    );
    const a = await q("SELECT id FROM archivos WHERE proyecto_id = $1", [id]);
    return res.json({ ok: true, archivos: a.rows.map(x => x.id) });
  }
  if (req.method === "DELETE") {
    if (!p) return res.json({ ok: true });
    await q("DELETE FROM archivos WHERE proyecto_id = $1", [id]);
    await q("UPDATE proyectos SET borrado = TRUE, modificado = $2 WHERE id = $1", [id, Date.now()]);
    return res.json({ ok: true });
  }
  res.status(405).end();
});
