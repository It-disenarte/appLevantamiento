import { q } from "../_lib/db.js";
import { manejar, PASSWORD_MIN } from "../_lib/auth.js";

export default manejar(async (req, res) => {
  const r = await q("SELECT count(*)::int AS n FROM usuarios");
  res.json({ ok: true, necesitaAdmin: r.rows[0].n === 0, passwordMin: PASSWORD_MIN });
}, { auth: false });
