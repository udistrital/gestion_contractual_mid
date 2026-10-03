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
Incluye `test/amparos-contratos.e2e-spec.ts` (service mockeado) y `test/amparos-contratos.nock-e2e-spec.ts` (CRUD y parámetros simulados con `nock`). Validan GET /amparos-contratos/:contratoId: respuestas exitosas, 400 por `contratoId` no entero, ausencia de amparos, reintentos y errores del servicio externo. No requieren servicios externos.

También incluye `test/polizas.nock-e2e-spec.ts` (CRUD simulado con `nock`). Valida que `polizas` y `amparos-polizas` reenvían ruta, query, body, status (200, 201, 206, 400, 404, 500) y sobre de respuesta del CRUD, que un id no entero no llega al CRUD y que las escrituras no se reintentan.

Pruebas de integración (opt-in)
```shell
pnpm test:integration
# Requiere CRUD de gestión contractual y parámetros accesibles según .env.
# El contrato con amparos activos se toma de INTEGRATION_CONTRATO_ID (default 1).
# test/polizas.integration-spec.ts crea una póliza inactiva y un amparo en ese
# contrato y los deja inactivos al terminar. INTEGRATION_AMPARO_ID (default 6602)
# es el tipo de amparo usado.
```
Más detalle en [docs/amparos-contratos.md](docs/amparos-contratos.md).

## Módulos

### Amparos Contratos

Migrado desde `poliza_mid`. Consulta los amparos asociados a un contrato, cruzando la información con los parámetros de tipo amparo (`TipoParametroId:118`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/amparos-contratos/:contratoId` | Obtiene los amparos del contrato indicado, resolviendo el nombre de cada amparo contra `ENDP_PARAMETROS_CRUD` |

Depende de las variables de entorno `ENDP_GESTION_CONTRACTUAL_CRUD` y `ENDP_PARAMETROS_CRUD`.

Respuestas: `200` con amparos activos, `400` si `contratoId` no es un entero, `404` si el contrato no tiene amparos activos, `500` ante fallas de los servicios externos (3 reintentos con backoff). Documentación técnica en [docs/amparos-contratos.md](docs/amparos-contratos.md).

### Pólizas y Amparos de Pólizas

Intermediario entre `gestion_contractual_mf` y `gestion_contractual_crud` para registrar y consultar pólizas y sus amparos, según la arquitectura OAS (MF → MID → CRUD). Reenvía la petición al CRUD con la misma ruta, query y body, y devuelve el mismo status y sobre de respuesta (`Success`, `Status`, `Message`, `Data`, `Metadata`).

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/polizas` | Consulta pólizas. Admite `query`, `limit`, `offset`, `sortBy`, `orderBy`, `fields`, `include` |
| POST | `/polizas` | Crea una póliza |
| PUT | `/polizas/:id` | Actualiza una póliza |
| GET | `/amparos-polizas` | Consulta amparos. Admite los mismos parámetros que `/polizas` |
| POST | `/amparos-polizas` | Crea amparos en lote (arreglo). `201`, o `206` si la creación es parcial |
| PUT | `/amparos-polizas/:id` | Actualiza un amparo o lo vincula a una póliza (`poliza_id`) |
| DELETE | `/amparos-polizas/:id` | Borrado lógico de un amparo |

Depende de la variable de entorno `ENDP_GESTION_CONTRACTUAL_CRUD`.

Respuestas: las del CRUD (`200`, `201`, `206`, `400`, `404`, `500`), `400` si `:id` no es un entero (no se consulta el CRUD) y `500` si el CRUD no responde. Solo las consultas (GET) se reintentan (3 reintentos con backoff, únicamente ante fallas sin respuesta o `5xx`); las escrituras no se reintentan para no duplicar registros.

## Estado CI

El pipeline definido en .drone.yml ejecuta las etapas install_dependencies y build sobre la imagen node:24-slim.

## Licencia

This file is part of gestion_contractual_mid.

gestion_contractual_mid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

gestion_contractual_mid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with sga_mid. If not, see https://www.gnu.org/licenses/.
