import { q } from "./_lib/db.js";
import { manejar } from "./_lib/auth.js";

// Healthcheck: app + conexión a Postgres.
export default manejar(async (req, res) => {
  const t = Date.now();
  await q("SELECT 1");
  res.json({ ok: true, db: "ok", ms: Date.now() - t });
}, { auth: false });
