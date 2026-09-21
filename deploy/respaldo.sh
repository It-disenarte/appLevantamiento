#!/usr/bin/env bash
# Respaldo diario de Postgres de Levantamientos en el VPS (Easypanel). Conserva 14 días.
# Úsalo solo si no configuras los respaldos desde Easypanel (pestaña Backups del servicio).
#
# Cron (en el VPS, como root):
#   30 3 * * * /root/respaldo-levantamientos.sh >> /var/log/levantamientos-respaldo.log 2>&1
set -euo pipefail

# Nombre del contenedor en Easypanel: <proyecto>_<servicio>
SERVICIO="${SERVICIO:-hub_disenarte_levantamientos-db}"
DB_USUARIO="${DB_USUARIO:-levantamientos}"
DB_NOMBRE="${DB_NOMBRE:-levantamientos}"
DIR_RESPALDOS="${DIR_RESPALDOS:-/root/respaldos/levantamientos}"

CONTENEDOR="$(docker ps -q -f "name=${SERVICIO}" | head -n1)"
if [ -z "$CONTENEDOR" ]; then
  echo "[$(date -Is)] no se encontró un contenedor con nombre ${SERVICIO}" >&2
  exit 1
fi

mkdir -p "$DIR_RESPALDOS"
ARCHIVO="$DIR_RESPALDOS/levantamientos-$(date +%Y%m%d-%H%M%S).sql.gz"
# Las fotos van en bytea: el respaldo pesa lo que pesen las fotos.
docker exec "$CONTENEDOR" pg_dump -U "$DB_USUARIO" -d "$DB_NOMBRE" --no-owner --clean --if-exists | gzip > "$ARCHIVO"
echo "[$(date -Is)] respaldo creado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

find "$DIR_RESPALDOS" -name 'levantamientos-*.sql.gz' -mtime +14 -delete

# Restaurar:
#   gunzip -c levantamientos-AAAAMMDD-HHMMSS.sql.gz | docker exec -i $(docker ps -qf name=hub_disenarte_levantamientos-db) psql -U levantamientos -d levantamientos
