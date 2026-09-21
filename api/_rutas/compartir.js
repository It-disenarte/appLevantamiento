import { q, tx } from "../_lib/db.js";
import { manejar, nid } from "../_lib/auth.js";

// POST /api/proyectos/:id/compartir  { usuarios: [ids] }
// Envía una COPIA independiente del proyecto a cada usuario elegido (con sus fotos y audios).
// El original no cambia; cada destinatario recibe su propio proyecto editable.
export default manejar(async (req, res, u) => {
  const { id } = req.query;
  if (req.method !== "POST") return res.status(405).end();
  const p = (await q("SELECT * FROM proyectos WHERE id = $1 AND NOT borrado", [id])).rows[0];
  if (!p) return res.status(404).json({ error: "No existe" });
  if (u.rol !== "admin" && p.usuario_id !== u.id) return res.status(403).json({ error: "Solo quien creó el proyecto (o un admin) puede compartirlo" });
  const ids = [...new Set((req.body && req.body.usuarios) || [])].filter(x => typeof x === "string" && x !== p.usuario_id);
  if (!ids.length) return res.status(400).json({ error: "Elige al menos una persona" });
  const destinos = (await q("SELECT id, nombre FROM usuarios WHERE activo AND id = ANY($1)", [ids])).rows;
  const archivos = (await q("SELECT id FROM archivos WHERE proyecto_id = $1", [id])).rows.map(x => x.id);
  const ahora = Date.now();
  const enviados = [];

  for (const d of destinos) {
    const mapa = {}; // id viejo → id nuevo (elementos, marcas y archivos)
    const nuevo = (viejo, pref) => (mapa[viejo] = mapa[viejo] || nid(pref));
    const datos = JSON.parse(JSON.stringify(p.datos));
    (datos.hojas || []).forEach(h => {
      h.id = nid("h");
      (h.elementos || []).forEach(e => {
        const ne = nuevo(e.id, "e");
        if (e.archivoId) e.archivoId = e.archivoId === e.id ? ne : nuevo(e.archivoId, "a");
        e.id = ne;
        (e.marcas || []).forEach(m => {
          const nm = nuevo(m.id, "m");
          if (m.archivoAudioId) m.archivoAudioId = m.archivoAudioId === m.id + "-a" ? nm + "-a" : nuevo(m.archivoAudioId, "a");
          m.id = nm;
        });
      });
    });
    const npid = nid("p");
    datos.origen = { proyectoId: p.id, de: u.nombre, fecha: ahora };
    await tx(async (c) => {
      await c(
        `INSERT INTO proyectos (id, usuario_id, cliente, sitio, fecha, datos, creado, modificado, borrado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,FALSE)`,
        [npid, d.id, p.cliente, p.sitio, p.fecha, JSON.stringify(datos), ahora]
      );
      for (const a of archivos) {
        // el archivo de un pin es "<idMarca>-a": su nuevo id sale del nuevo id de la marca
        const base = a.endsWith("-a") ? a.slice(0, -2) : a;
        const nuevoId = mapa[base] ? (a.endsWith("-a") ? mapa[base] + "-a" : mapa[base]) : (mapa[a] || nid("a"));
        await c("INSERT INTO archivos (id, proyecto_id, tipo, datos, tam) SELECT $1, $2, tipo, datos, tam FROM archivos WHERE id = $3", [nuevoId, npid, a]);
      }
    });
    enviados.push({ usuarioId: d.id, nombre: d.nombre, proyectoId: npid });
  }
  res.json({ ok: true, enviados });
});
