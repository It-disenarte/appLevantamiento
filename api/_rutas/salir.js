import { q } from "../_lib/db.js";
import { manejar, tokenDe } from "../_lib/auth.js";

export default manejar(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await q("DELETE FROM sesiones WHERE token = $1", [tokenDe(req)]);
  res.json({ ok: true });
}, { permitirCambioPendiente: true });
