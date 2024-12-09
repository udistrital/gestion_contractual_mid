# Gestión Contractual MID - ARGO MID

API MID intermediaria entre el cliente ARGOv2 y el CURD de ARGO V2.

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones
* NodeJS 20
* NestJS 10
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

## Estado CI

EN PROCESO

## Licencia

This file is part of gestion_contractual_mid.

gestion_contractual_mid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

gestion_contractual_mid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with sga_mid. If not, see https://www.gnu.org/licenses/.
