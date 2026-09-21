import { q, tx } from "./_lib/db.js";
import { manejar, hashear, crearSesion, nid, publico, validarPassword } from "./_lib/auth.js";

// Llave fija para pg_advisory_xact_lock: serializa intentos simultáneos de configuración inicial.
const LLAVE = 73012027;

// Solo funciona una vez: crea la cuenta admin cuando no existe ninguna cuenta.
export default manejar(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const { nombre, correo, password } = req.body || {};
  const mal = validarPassword(password);
  if (!nombre || !correo || mal) return res.status(400).json({ error: mal || "Nombre y correo son obligatorios" });
  const id = nid("u");
  let creado;
  try {
    creado = await tx(async (c) => {
      await c("SELECT pg_advisory_xact_lock($1)", [LLAVE]);
      const n = await c("SELECT count(*)::int AS n FROM usuarios");
      if (n.rows[0].n > 0) return null;
      const r = await c(
        "INSERT INTO usuarios (id, nombre, correo, hash, rol, debe_cambiar, ultimo_acceso) VALUES ($1,$2,$3,$4,'admin',FALSE,now()) RETURNING *",
        [id, String(nombre).trim(), String(correo).trim().toLowerCase(), hashear(password)]
      );
      return r.rows[0];
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
  if (!creado) return res.status(409).json({ error: "La configuración inicial ya se realizó" });
  const token = await crearSesion(creado.id, req);
  res.json({ token, usuario: publico(creado) });
}, { auth: false });
