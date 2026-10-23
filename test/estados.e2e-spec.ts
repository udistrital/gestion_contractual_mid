import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { EstadosModule } from './../src/estados/estados.module';
import {
  CrudSimulado,
  responderJson,
  respuestaParametros,
} from './utils/crud-simulado';

// parametros_crud, gestion_contractual_crud y terceros_crud simulados dentro de la prueba.
const parametrosPorTipo: Record<string, unknown[]> = {
  '137': [
    {
      Id: 6620,
      Nombre: 'Por suscribir',
      Descripcion: '',
      CodigoAbreviacion: 'PSU',
      Activo: true,
      ParametroPadreId: null,
    },
  ],
  '141': [
    {
      Id: 6630,
      Nombre: 'Borrador',
      Descripcion: '',
      CodigoAbreviacion: 'BOR',
      Activo: true,
      ParametroPadreId: { Id: 6620 },
    },
  ],
};

const estadosCrud = [
  {
    id: 1,
    contrato_general_id: 10,
    estado_parametro_id: 6620,
    estado_interno_parametro_id: 6630,
    usuario_id: 5,
    actual: true,
  },
  {
    id: 2,
    contrato_general_id: 11,
    estado_parametro_id: 9999,
    estado_interno_parametro_id: 8888,
    usuario_id: 5,
    actual: true,
  },
  {
    id: 3,
    contrato_general_id: 12,
    estado_parametro_id: null,
    estado_interno_parametro_id: null,
    usuario_id: null,
    actual: false,
  },
];

describe('EstadosController (e2e, CRUD simulados)', () => {
  const crud = new CrudSimulado();
  let app: INestApplication;

  function registrarRutas() {
    crud.en('/parametro', (peticion, _req, res) => {
      const tipo = (peticion.query.query ?? '').split(':').pop() ?? '';
      responderJson(
        res,
        200,
        respuestaParametros(parametrosPorTipo[tipo] ?? [{}]),
      );
    });
    crud.en('/estados-contrato', (_peticion, _req, res) =>
      responderJson(res, 200, {
        Data: estadosCrud,
        Metadata: { total: 3, limit: 10, offset: 0 },
      }),
    );
    crud.en('/tercero/*', (peticion, _req, res) =>
      responderJson(res, 200, {
        Id: Number(peticion.path.split('/').pop()),
        NombreCompleto: 'Persona de prueba',
      }),
    );
  }

  beforeAll(async () => {
    await crud.iniciar();
    process.env.ENDP_PARAMETROS_CRUD = crud.url;
    process.env.ENDP_GESTION_CONTRACTUAL_CRUD = crud.url;
    process.env.ENDP_TERCEROS_CRUD = crud.url;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CacheModule.register({ isGlobal: true, ttl: 14400000 }),
        EstadosModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    crud.limpiar();
    registrarRutas();
  });

  afterEach(async () => {
    await app.get('CACHE_MANAGER').clear();
  });

  afterAll(async () => {
    await app.close();
    await crud.detener();
  });

  it('GET /estados responde 200 con los estados resueltos, como en develop', async () => {
    const res = await request(app.getHttpServer()).get('/estados').expect(200);

    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Contratos consultados exitosamente',
      Data: [
        {
          ...estadosCrud[0],
          estado_parametro_id: 'Por suscribir',
          estado_interno_parametro_id: 'Borrador',
          nombre_usuario: 'Persona de prueba',
        },
        { ...estadosCrud[1], nombre_usuario: 'Persona de prueba' },
        estadosCrud[2],
      ],
      Metadata: { total: 3, limit: 10, offset: 0 },
    });
  });

  it('consulta los tipos 137 y 141 a parametros_crud y los toma de la caché en la segunda petición', async () => {
    await request(app.getHttpServer()).get('/estados').expect(200);
    expect(
      crud
        .llamadas('/parametro')
        .map((p) => p.query.query)
        .sort(),
    ).toEqual(['TipoParametroId.Id:137', 'TipoParametroId.Id:141']);

    await request(app.getHttpServer()).get('/estados').expect(200);
    expect(crud.llamadas('/parametro')).toHaveLength(2);
    expect(crud.llamadas('/estados-contrato')).toHaveLength(2);
  });

  it('reenvía los filtros y la paginación a gestion_contractual_crud', async () => {
    await request(app.getHttpServer())
      .get('/estados')
      .query({
        limit: 5,
        offset: 10,
        sortBy: 'id',
        orderBy: 'DESC',
        queryFilter: '"actual":true',
      })
      .expect(200);

    expect(crud.llamadas('/estados-contrato')[0].query).toEqual({
      limit: '5',
      offset: '10',
      sortBy: 'id',
      orderBy: 'DESC',
      query: '{"actual":true}',
    });
  });

  it('consulta terceros_crud solo para los estados con usuario', async () => {
    await request(app.getHttpServer()).get('/estados').expect(200);

    expect(crud.llamadas('/tercero/5')).toHaveLength(2);
    expect(
      crud.peticiones.filter((p) => p.path.startsWith('/tercero/')),
    ).toHaveLength(2);
  });

  it('responde 500 cuando parametros_crud no responde', async () => {
    crud.en('/parametro', (_peticion, req) => req.socket.destroy());

    const res = await request(app.getHttpServer()).get('/estados').expect(500);

    expect(res.body.message).toMatch(
      /^Error al consultar los estados de los contratos: /,
    );
  }, 20000);
});
