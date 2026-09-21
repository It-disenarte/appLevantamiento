import { q } from "../_lib/db.js";
import { manejar, leerCuerpo } from "../_lib/auth.js";

export const config = { api: { bodyParser: false } };

// GET  /api/archivos/:id          → binario (foto o audio)
// PUT  /api/archivos/:id?proyecto=:pid  cuerpo binario, Content-Type del archivo
export default manejar(async (req, res, u) => {
  const { id } = req.query;
  if (req.method === "GET") {
    const r = await q("SELECT a.tipo, a.datos, p.usuario_id FROM archivos a JOIN proyectos p ON p.id = a.proyecto_id WHERE a.id = $1", [id]);
    const a = r.rows[0];
    if (!a) return res.status(404).end();
    if (u.rol !== "admin" && a.usuario_id !== u.id) return res.status(403).end();
    res.setHeader("Content-Type", a.tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.status(200).end(a.datos);
  }
  if (req.method === "PUT") {
    const pid = req.query.proyecto;
    const p = await q("SELECT usuario_id FROM proyectos WHERE id = $1", [pid]);
    if (!p.rowCount) return res.status(404).json({ error: "Primero sube el proyecto" });
    if (u.rol !== "admin" && p.rows[0].usuario_id !== u.id) return res.status(403).json({ error: "Sin acceso" });
    const datos = await leerCuerpo(req);
    if (!datos.length) return res.status(400).json({ error: "Archivo vacío" });
    await q(
      "INSERT INTO archivos (id, proyecto_id, tipo, datos, tam) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET tipo = $3, datos = $4, tam = $5",
      [id, pid, req.headers["content-type"] || "application/octet-stream", datos, datos.length]
    );
    return res.json({ ok: true, tam: datos.length });
  }
  res.status(405).end();
});
