#!/usr/bin/env node
// Convierte el OpenAPI 3.0 que genera NestJS (swagger/swagger.json) a Swagger 2.0
// (swagger/swagger-v2.json). main.ts reescribe swagger.json al arrancar, por eso el
// resultado va en otro archivo. Falla si encuentra algo que Swagger 2.0 no representa.
const fs = require('fs');
const path = require('path');

const CAMPOS_PARAMETRO = ['type', 'format', 'enum', 'default', 'minimum', 'maximum', 'items', 'pattern'];

function convertirRefs(valor) {
  if (Array.isArray(valor)) return valor.map(convertirRefs);
  if (!valor || typeof valor !== 'object') return valor;
  const resultado = {};
  for (const [clave, contenido] of Object.entries(valor)) {
    if (['oneOf', 'anyOf'].includes(clave)) {
      throw new Error(`Swagger 2.0 no admite ${clave}`);
    }
    if (clave === 'nullable') {
      resultado['x-nullable'] = contenido;
    } else if (clave === '$ref') {
      resultado.$ref = contenido.replace('#/components/schemas/', '#/definitions/');
    } else {
      resultado[clave] = convertirRefs(contenido);
    }
  }
  return resultado;
}

function convertirParametro(parametro) {
  const { schema = {}, example, ...base } = parametro;
  const convertido = { ...base, type: schema.type ?? 'string' };
  for (const campo of CAMPOS_PARAMETRO.slice(1)) {
    if (schema[campo] !== undefined) convertido[campo] = schema[campo];
  }
  const ejemplo = example ?? schema.example;
  if (ejemplo !== undefined) convertido['x-example'] = ejemplo;
  return convertido;
}

function convertirCuerpo(requestBody) {
  const tipos = Object.keys(requestBody.content ?? {});
  const tipo = tipos[0];
  const { schema = { type: 'object' } } = requestBody.content?.[tipo] ?? {};
  return {
    parametro: {
      name: 'body',
      in: 'body',
      required: requestBody.required ?? false,
      ...(requestBody.description && { description: requestBody.description }),
      schema: convertirRefs(schema),
    },
    consumes: tipos,
  };
}

function convertirRespuestas(responses) {
  const produces = new Set();
  const respuestas = {};
  for (const [codigo, respuesta] of Object.entries(responses)) {
    const tipos = Object.keys(respuesta.content ?? {});
    tipos.forEach((tipo) => produces.add(tipo));
    const schema = respuesta.content?.[tipos[0]]?.schema;
    respuestas[codigo] = {
      description: respuesta.description ?? '',
      ...(schema && { schema: convertirRefs(schema) }),
    };
  }
  return { respuestas, produces: [...produces] };
}

function convertirOperacion(operacion) {
  const { parameters = [], requestBody, responses, ...resto } = operacion;
  const parametros = parameters.map(convertirParametro);
  const convertida = { ...resto };

  if (requestBody) {
    const { parametro, consumes } = convertirCuerpo(requestBody);
    parametros.push(parametro);
    convertida.consumes = consumes;
  }

  const { respuestas, produces } = convertirRespuestas(responses);
  if (produces.length > 0) convertida.produces = produces;
  convertida.parameters = parametros;
  convertida.responses = respuestas;
  return convertida;
}

function convertir(openapi) {
  const paths = {};
  for (const [ruta, operaciones] of Object.entries(openapi.paths)) {
    paths[ruta] = Object.fromEntries(
      Object.entries(operaciones).map(([metodo, operacion]) => [metodo, convertirOperacion(operacion)]),
    );
  }
  return {
    swagger: '2.0',
    info: openapi.info,
    tags: openapi.tags ?? [],
    paths,
    definitions: convertirRefs(openapi.components?.schemas ?? {}),
  };
}

if (require.main === module) {
  const carpeta = path.join(process.cwd(), 'swagger');
  const openapi = JSON.parse(fs.readFileSync(path.join(carpeta, 'swagger.json'), 'utf8'));
  const swagger = convertir(openapi);
  fs.writeFileSync(path.join(carpeta, 'swagger-v2.json'), `${JSON.stringify(swagger, null, 2)}\n`);
  console.log(`swagger-v2.json: ${Object.keys(swagger.paths).length} rutas`);
}

module.exports = { convertir };
