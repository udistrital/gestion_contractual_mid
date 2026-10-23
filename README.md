# Gestión Contractual MID - ARGO MID

API MID intermediaria entre el cliente ARGOv2 y el CURD de ARGO V2.

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones
* NodeJS 24
* NestJS 11
* Typescript 5.9.3
* [Docker](https://docs.docker.com/engine/install/)
* [Docker Compose](https://docs.docker.com/compose/)

### Variables de Entorno
```shell

ENDP_GESTION_CONTRACTUAL_CRUD= [Endpoint gestión contractual crud]
ENDP_PARAMETROS_CRUD= [Endpoint parametros crud]
ENDP_OIKOS_ESPACIOS_FISICOS= [Endpoint oikos]
ENDP_PROVEEDORES_MID= [Endpoint de info proveedores]
ENDP_TERCEROS_CRUD= [Endpoint terceros]
ENDP_POLIZAS_CRUD= [Endpoint polizas crud]
```
**NOTA:** Las variables se asignan en una archivo privado .env.

### Ejecución del Proyecto
```shell
#1. Instalación del Gestor de Paquetes
corepack enable pnpm

#2. Instalación de Dependencias
pnpm install

# 3. Crear el archivo .env y asignar las variables de entorno
touch .env

# 4. Ejectuar el proyecto
pnpm start:dev (Modo Desarrollo)
```
Nota: Para otras plataformas de PNPM consultar la [documentación oficial](https://pnpm.io/installation)

Nota: En caso de no asignar el puerto en las variables de entorno, se asignará el puerto por defecto.
### Ejecución Dockerfile
```shell
# TODO
```

### Ejecución docker-compose
```shell
# TODO
```

### Ejecución Pruebas

Pruebas unitarias
```shell
# Test
pnpm test

# Se ejecutará jest, validando los casos de prueba en los archivos .spec.ts

pnpm test:cov
# Validar la cobertura de las pruebas
```

Pruebas e2e
```shell
pnpm test:e2e
# Ejecuta jest con configuración test/jest-e2e.json
```
Incluye `test/amparos-contratos.e2e-spec.ts`, que valida el endpoint GET /amparos-contratos/:contratoId, incluyendo respuestas exitosas, ausencia de amparos y errores del servicio externo.

## Módulos

### Amparos Contratos

Migrado desde `poliza_mid`. Consulta los amparos asociados a un contrato, cruzando la información con los parámetros de tipo amparo (`TipoParametroId:118`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/amparos-contratos/:contratoId` | Obtiene los amparos del contrato indicado, resolviendo el nombre de cada amparo contra `ENDP_PARAMETROS_CRUD` |

Depende de las variables de entorno `ENDP_POLIZAS_CRUD` y `ENDP_PARAMETROS_CRUD`.

## Estado CI

El pipeline definido en .drone.yml ejecuta las etapas install_dependencies y build sobre la imagen node:24-slim.

## Parámetros con caché

Intermediario entre los consumidores del MID y `parametros_crud`. Entrega los parámetros agrupados por tipo y los guarda en una caché en memoria, para no consultar el CRUD en cada petición.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/parametros?ids=137,141` | Retorna los parámetros de los tipos indicados, agrupados por id de tipo |
| DELETE | `/parametros` | Limpia toda la caché de parámetros |

Depende de la variable de entorno `ENDP_PARAMETROS_CRUD`.

### GET /parametros

- `ids` (query, obligatorio): ids de tipo de parámetro separados por coma, por ejemplo `137,141`. Se ignoran los espacios y las comas vacías.
- Por cada tipo se consulta `parametro?query=TipoParametroId.Id:<id>&fields=Id,Nombre,Descripcion,CodigoAbreviacion,Activo,ParametroPadreId&limit=0`. Se devuelven activos e inactivos.

Respuestas:

- `200`: `Data` es un objeto cuya llave es el id de tipo y cuyo valor es la lista de parámetros. Un tipo sin registros llega como `[]`.
- `400`: falta `ids`, viene vacío o contiene valores no numéricos. No se consulta el CRUD.
- `500`: falló la consulta a `parametros_crud` después de los reintentos. La respuesta no incluye el detalle del error, que solo queda en el log del servidor.

Ejemplo de respuesta `200`:

```json
{
  "Success": true,
  "Status": 200,
  "Message": "Parametros consultados exitosamente",
  "Data": {
    "137": [
      { "Id": 6620, "Nombre": "Por suscribir", "Descripcion": "", "CodigoAbreviacion": "PSU", "Activo": true, "ParametroPadreId": null }
    ],
    "141": [
      { "Id": 6630, "Nombre": "Borrador", "Descripcion": "", "CodigoAbreviacion": "BOR", "Activo": true, "ParametroPadreId": { "Id": 6620 } }
    ]
  }
}
```

Ejemplo de respuesta `400` (la de `500` tiene la misma forma, con `Status: 500`):

```json
{
  "Success": false,
  "Status": 400,
  "Message": "El parámetro ids es obligatorio y debe contener IDs numéricos separados por coma",
  "Data": null
}
```

### DELETE /parametros

Vacía toda la caché y responde `200` cuando la limpieza termina. Sirve para refrescar los datos después de modificar parámetros en el CRUD sin esperar a que venza el TTL. Responde `500` si no se pudo limpiar.

### Funcionamiento de la caché

- `CacheModule` de NestJS, registrado de forma global en `app.module.ts`, con el almacén en memoria del proceso (sin Redis).
- TTL de **4 horas** (`14400000` ms) por entrada.
- Una llave por tipo de parámetro: la llave es el id del tipo y el valor contiene sus parámetros indexados por `Id`.
- Solo se consultan al CRUD los tipos que no están en caché, en paralelo. Si todos están en caché, no se hace ninguna petición.
- No se guardan en caché las respuestas con error (`Success: false` o sin `Data`) ni las vacías. Los elementos sin `Id`, como el `[{}]` que devuelve el CRUD cuando un tipo no tiene registros, se descartan.
- Cada consulta al CRUD tiene un timeout de **5 s** y se reintenta **3 veces** con backoff (1, 2 y 4 s) ante fallas de red o timeout.
- La caché es por instancia: cada réplica del MID tiene la suya.

### Consumidores de `ParametroService`

| Módulo | Tipos de parámetro | Estado |
|--------|--------------------|--------|
| `contrato-general` | Los 17 tipos del contrato (111–127, 132, 137, 146) | Consume `ParametroService` |
| `estados` | 137 (estados generales) y 141 (estados internos) | Consume `ParametroService` |
| `amparos-contratos` | 118 (amparos) | Pendiente: sigue consultando `ENDP_PARAMETROS_CRUD` directamente. Se migrará cuando se resuelva el PR #23 |

Los módulos que usan el servicio importan `ParametroModule`, así comparten la misma caché.

### Requisitos y pruebas

El proyecto usa pnpm 12.4.1 (`packageManager` en `package.json`), que requiere **Node 24**. Con Node 20, `corepack` no puede iniciar esa versión de pnpm. Si no hay Node 24 disponible, se puede usar `npx -y pnpm@12.4.1` en lugar de `pnpm`.

```shell
# Pruebas unitarias (incluye parametro.service, parametro.controller, estados.service y contrato-general.service)
pnpm test

# Cobertura
pnpm test:cov

# Pruebas e2e. app.e2e-spec.ts levanta el AppModule completo y necesita las variables ENDP_* definidas
# (en .env o en el entorno); no hace llamadas a los servicios externos.
pnpm test:e2e
```

Pruebas e2e de parámetros y estados:

| Suite | Qué valida |
|-------|------------|
| `test/parametros.e2e-spec.ts` | `GET /parametros` y `DELETE /parametros` de punta a punta: respuesta `200` con `ParametroPadreId`, campos y filtros enviados al CRUD, uso de la caché (solo se consultan los tipos que faltan), limpieza con `DELETE`, `[{}]` no se guarda en caché, `400` por `ids` inválidos, reintento ante un fallo, `500` sin exponer el error y respuestas con `Success: false` sin guardar en caché |
| `test/estados.e2e-spec.ts` | `GET /estados` de punta a punta: respuesta igual a la de `develop` (nombres resueltos, ids inexistentes y `null` conservados), tipos 137 y 141 tomados de la caché en la segunda petición, filtros y paginación reenviados al CRUD, consulta a terceros solo para estados con usuario y `500` si `parametros_crud` no responde |

Estas suites levantan los módulos reales del MID y simulan `parametros_crud`, `gestion_contractual_crud` y `terceros_crud` con un servidor HTTP local dentro de la propia prueba (`test/utils/crud-simulado.ts`). No requieren VPN ni servicios externos; asignan sus propias variables `ENDP_*`. Los casos de `500` tardan unos 7 s cada uno por los reintentos con backoff.

## Licencia

This file is part of gestion_contractual_mid.

gestion_contractual_mid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

gestion_contractual_mid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with sga_mid. If not, see https://www.gnu.org/licenses/.
