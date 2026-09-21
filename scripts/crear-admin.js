#!/usr/bin/env node
/**
 * Crea una cuenta admin o recupera el acceso de una existente, directo en la base.
 * Úsalo si perdiste la contraseña del admin o si todas las cuentas admin quedaron desactivadas.
 *
 *   node scripts/crear-admin.js
 *
 * Requiere DATABASE_URL en .env (la URL pública de la base de producción).
 * La contraseña se escribe oculta y no se guarda en ningún archivo ni variable.
 */
import fs from "node:fs";
import { createInterface } from "node:readline/promises";
import { q, db } from "../api/_lib/db.js";
import { hashear, nid, validarPassword, cerrarSesiones, PASSWORD_MIN } from "../api/_lib/auth.js";

// .env mínimo sin dependencias
if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL en .env"); process.exit(1); }

function leerOculto(pregunta) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("Ejecuta el comando en una terminal interactiva."));
    stdout.write(pregunta); stdin.setRawMode(true); stdin.setEncoding("utf8"); stdin.resume();
    let v = "";
    const fin = () => { stdin.off("data", tecla); stdin.setRawMode(false); stdin.pause(); stdout.write("\n"); };
    function tecla(d) {
      for (const c of d) {
        if (c === "\r" || c === "\n") { fin(); return resolve(v); }
        if (c === "\u0003") { fin(); return reject(new Error("Cancelado.")); }
        if (c === "\u007f" || c === "\b") { if (v) { v = v.slice(0, -1); stdout.write("\b \b"); } continue; }
        v += c; stdout.write("*");
      }
    }
    stdin.on("data", tecla);
  });
}

const u = new URL(process.env.DATABASE_URL);
console.log("\nCrear o recuperar cuenta admin\nBase de datos: " + u.hostname + ":" + (u.port || "5432") + u.pathname + "\n");
const rl = createInterface({ input: process.stdin, output: process.stdout });
const correo = (await rl.question("Correo: ")).trim().toLowerCase();
const ex = (await q("SELECT id, nombre, rol, activo FROM usuarios WHERE correo = $1", [correo])).rows[0];
let nombre;
if (ex) {
  console.log("\nYa existe la cuenta de " + ex.nombre + " (" + ex.rol + ", " + (ex.activo ? "activa" : "desactivada") + ").\nSe le asignará una contraseña nueva, quedará activa con rol admin y se cerrarán sus sesiones.");
  const r = (await rl.question("¿Continuar? (s/N): ")).trim().toLowerCase();
  if (!["s", "si", "sí"].includes(r)) { rl.close(); console.log("Sin cambios."); process.exit(0); }
  nombre = ex.nombre;
} else nombre = (await rl.question("Nombre: ")).trim();
rl.close();

const pass = await leerOculto("Contraseña (mínimo " + PASSWORD_MIN + " caracteres): ");
const mal = validarPassword(pass); if (mal) { console.error("✖ " + mal); process.exit(1); }
if (pass !== await leerOculto("Confirmar contraseña: ")) { console.error("✖ Las contraseñas no coinciden."); process.exit(1); }

if (ex) {
  await q("UPDATE usuarios SET hash = $2, rol = 'admin', activo = TRUE, debe_cambiar = FALSE WHERE id = $1", [ex.id, hashear(pass)]);
  await cerrarSesiones(ex.id);
  console.log("\n✔ Acceso recuperado para " + correo + ".");
} else {
  await q("INSERT INTO usuarios (id, nombre, correo, hash, rol, debe_cambiar) VALUES ($1,$2,$3,$4,'admin',FALSE)", [nid("u"), nombre, correo, hashear(pass)]);
  console.log("\n✔ Cuenta admin creada para " + correo + ".");
}
await db().end();
