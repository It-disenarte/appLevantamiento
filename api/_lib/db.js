import pg from "pg";

// Reusar el pool entre invocaciones de la misma instancia en Vercel; chico para no agotar
// las conexiones de Postgres (max_connections = 100 por defecto).
const g = globalThis;
let listo;

export function db() {
  if (!g.__poolLev) {
    if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
    g.__poolLev = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "off" ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 3),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }
  return g.__poolLev;
}

export async function q(sql, params) {
  await esquema();
  return db().query(sql, params);
}

// Transacción con cliente dedicado: fn recibe (query) y corre dentro de BEGIN/COMMIT.
export async function tx(fn) {
  await esquema();
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const r = await fn((sql, params) => c.query(sql, params));
    await c.query("COMMIT");
    return r;
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }
}

export function esquema() {
  if (!listo) listo = db().query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'usuario',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      debe_cambiar BOOLEAN NOT NULL DEFAULT TRUE,
      ultimo_acceso TIMESTAMPTZ,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira TIMESTAMPTZ NOT NULL,
      user_agent TEXT,
      creado TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultimo_uso TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario_id);
    CREATE TABLE IF NOT EXISTS proyectos (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id),
      cliente TEXT NOT NULL DEFAULT '',
      sitio TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL DEFAULT '',
      datos JSONB NOT NULL,
      creado BIGINT NOT NULL,
      modificado BIGINT NOT NULL,
      borrado BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS proyectos_usuario ON proyectos(usuario_id);
    CREATE TABLE IF NOT EXISTS archivos (
      id TEXT PRIMARY KEY,
      proyecto_id TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'application/octet-stream',
      datos BYTEA NOT NULL,
      tam INTEGER NOT NULL,
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS archivos_proyecto ON archivos(proyecto_id);
  `).catch(e => { listo = null; throw e; });
  return listo;
}
