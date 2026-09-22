# Libreta de Levantamientos — Diseñarte México

PWA de campo para levantamientos de señalética, rotulación y branding de interiores.
Frontend estático (`index.html`) + API serverless en `api/` (Node, sin build) + Postgres.

## Arquitectura
- **Vercel**: sirve la PWA y ejecuta las funciones de `api/`.
- **Postgres** (Easypanel en la VPS): usuarios, proyectos (JSON) y archivos (fotos y audios en bytea).
- **Offline primero**: la app guarda en el dispositivo (IndexedDB) y sincroniza al tener señal.
  Cada proyecto pertenece a un usuario; el admin ve, edita y exporta los de todos.
- **Seguridad** (mismo criterio que el Cotizador): sesiones en BD (se cierran al desactivar una cuenta o
  restablecer su contraseña), contraseñas de mínimo 10 caracteres con scrypt, configuración inicial protegida con
  `pg_advisory_xact_lock`, bloqueo de toda la API mientras la contraseña sea temporal, el admin no puede
  desactivarse a sí mismo, y `npm run crear-admin` para recuperar el acceso.

## 1. Postgres en Easypanel
1. Proyecto `hub_disenarte` › **+ Service › Postgres**: nombre `levantamientos-db`, base `levantamientos`, usuario `levantamientos`, contraseña vacía (se genera).
2. En el servicio › **Credentials** activa **Expose** (puerto externo). Vercel se conecta desde internet, así que este puerto debe estar abierto en el firewall de la VPS.
3. Copia la **External Connection URL**. Ejemplo:
   `postgres://levantamientos:PASSWORD@2.24.221.180:PUERTO/levantamientos`
4. La API crea las tablas sola en la primera petición (no hay migraciones que correr).

> Si la conexión falla por SSL, la API ya usa `ssl: { rejectUnauthorized: false }`. Si el Postgres de
> Easypanel no tiene SSL activo, agrega la variable `PGSSL=off`.

## 2. Vercel
1. Sube esta carpeta a GitHub e importa el repo en Vercel (preset **Other**, sin build).
2. **Settings › Environment Variables** (ver `.env.example`):
   - `DATABASE_URL` = la URL externa del paso anterior
   - `SESION_DIAS` = 30 (opcional)
   - **Settings › Functions › Region**: la más cercana al VPS.
3. Deploy. Vercel instala `pg` desde `package.json` automáticamente.

## 3. Primer arranque
1. Abre la app. Al no existir cuentas, muestra **Crear cuenta admin** (solo aparece esa única vez).
2. Con la cuenta admin: avatar › **Administrar usuarios y proyectos › Nuevo usuario**.
   Se genera una contraseña temporal que se muestra una sola vez (botón Copiar).
3. El usuario entra con ella y la app le obliga a cambiarla antes de continuar.

### Recuperar el acceso de admin
Si se pierde la contraseña del admin o todas las cuentas admin quedan desactivadas, desde una PC con la carpeta:
```bash
npm install
# en .env: DATABASE_URL=<URL pública de la base de producción>
npm run crear-admin
```
Pide correo y contraseña (oculta). Si el correo no existe crea un admin; si existe le pone contraseña nueva,
lo deja activo con rol admin y cierra sus sesiones.

### Respaldos
- **Opción A:** pestaña **Backups** del servicio `levantamientos-db` en Easypanel, con destino externo.
- **Opción B:** copiar `deploy/respaldo.sh` al VPS y programarlo con cron (instrucciones dentro).
Las fotos viven en la base, así que el respaldo pesa lo que pesen las fotos.

## Roles
- **usuario**: solo sus proyectos. Sincronización automática: 4 s después de cada cambio, al recuperar señal,
  al volver a la app y cada minuto mientras está abierta con internet.
- **Compartir** envía una **copia independiente** (fotos, marcas y audios, con ids nuevos) a cada persona
  elegida; el original queda intacto como respaldo de la versión previa. La copia aparece en la app del
  destinatario en su siguiente sincronización, marcada "copia de <quien la envió>". El ZIP sigue disponible como
  enlace secundario dentro de "Compartir proyecto" para entregas al cliente.
- **Girar foto** (⟳ en el editor): rota 90° la imagen y sus marcas; la foto se vuelve a subir al servidor.
- **admin**: todo lo anterior + lista de usuarios (crear, desactivar, regenerar contraseña, último acceso)
  y **Proyectos de todos** (descargar, abrir, editar y exportar).

## Endpoints
La app los llama como `/api/index?ruta=<ruta>` (una sola función); las rutas `/api/<ruta>` también funcionan si el rewrite de `vercel.json` aplica.
```
GET  /api/estado                 ¿falta crear el admin?
GET  /api/salud                  healthcheck (app + Postgres)
POST /api/salir                  cierra la sesión actual
POST /api/setup                  crea el admin (una vez)
POST /api/login                  { correo, password } → token
GET  /api/yo                     usuario de la sesión
POST /api/password               { actual, nueva }
GET  /api/usuarios               (admin)
POST /api/usuarios               (admin) { nombre, correo } → passwordTemporal
PATCH /api/usuarios/:id          (admin) { activo | nombre | rol | resetPassword }
GET  /api/companeros             usuarios activos para compartir
GET  /api/proyectos[?todos=1]    lista sin fotos
POST /api/proyectos/:id/compartir  (dueño o admin) { usuarios: [ids] } → envía una COPIA independiente a cada uno
GET  /api/proyectos/:id          proyecto completo + lista de archivos
PUT  /api/proyectos/:id          { proyecto }  (409 si el servidor tiene versión más nueva)
DELETE /api/proyectos/:id
GET  /api/archivos/:id           binario
PUT  /api/archivos/:id?proyecto= binario (Content-Type del archivo, máx. ~4.5 MB por Vercel)
```

## Al publicar una versión nueva
Sube el número de caché en `sw.js` (`levantamientos-v18`) para que los teléfonos instalados tomen la nueva versión.

## Archivos
```
index.html        la app completa (bundle; pedir la versión fuente para cambios de diseño)
api/index.js      única función serverless (límite de 12 en plan Hobby); enruta a api/_rutas/*
api/_lib/         conexión, esquema, auth
scripts/          crear-admin (recuperar acceso)
deploy/           respaldo.sh (pg_dump diario, 14 días)
package.json      dependencia pg
vercel.json       rewrite /api/* → api/index, cabeceras, duración de la función
reg.js, sw.js     service worker (no cachea /api)
manifest.json, icon-*.png (isotipo oficial), logo.png, isotipo.png
diagnostico.html  verificación de la PWA
```

## Datos
Cada dispositivo conserva copia local; el servidor es la fuente compartida. Borrar un proyecto lo
borra también del servidor (y sus archivos). El ZIP exportado sigue siendo el entregable al cliente.

Pendiente: transcripción de voz, reordenar hojas, migrar la API a la VPS si se desea.
