import { q } from "./_lib/db.js";
import { manejar, publico } from "./_lib/auth.js";

export default manejar(async (req, res, u) => {
  await q("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [u.id]);
  res.json({ usuario: publico(u) });
}, { permitirCambioPendiente: true });
