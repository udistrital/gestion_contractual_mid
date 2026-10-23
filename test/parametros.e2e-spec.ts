import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import { ParametroModule } from './../src/parametro/parametro.module';
import {
  CrudSimulado,
  responderJson,
  respuestaParametros,
} from './utils/crud-simulado';

// parametros_crud simulado dentro de la prueba: el MID real hace las peticiones HTTP.
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
  '999': [{}],
};

function tipoConsultado(query: Record<string, string>): string {
  return (query.query ?? '').split(':').pop() ?? '';
}

describe('ParametrosController (e2e, parametros_crud simulado)', () => {
  const crud = new CrudSimulado();
  let app: INestApplication;

  beforeAll(async () => {
    await crud.iniciar();
    process.env.ENDP_PARAMETROS_CRUD = crud.url;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CacheModule.register({ isGlobal: true, ttl: 14400000 }),
        ParametroModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    crud.limpiar();
    crud.en('/parametro', (peticion, _req, res) =>
      responderJson(
        res,
        200,
        respuestaParametros(
          parametrosPorTipo[tipoConsultado(peticion.query)] ?? [{}],
        ),
      ),
    );
    await request(app.getHttpServer()).delete('/parametros').expect(200);
    crud.peticiones.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await crud.detener();
  });

  it('GET /parametros?ids=137,141 responde 200 con los parámetros por tipo y ParametroPadreId', async () => {
    const res = await request(app.getHttpServer())
      .get('/parametros')
      .query({ ids: '137,141' })
      .expect(200);

    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Parametros consultados exitosamente',
      Data: {
        '137': parametrosPorTipo['137'],
        '141': parametrosPorTipo['141'],
      },
    });
    const consultas = crud.llamadas('/parametro');
    expect(consultas.map((p) => p.query.query).sort()).toEqual([
      'TipoParametroId.Id:137',
      'TipoParametroId.Id:141',
    ]);
    expect(consultas[0].query.fields).toBe(
      'Id,Nombre,Descripcion,CodigoAbreviacion,Activo,ParametroPadreId',
    );
    expect(consultas[0].query.limit).toBe('0');
  });

  it('la segunda consulta de los mismos tipos sale de la caché sin llamar al CRUD', async () => {
    await request(app.getHttpServer())
      .get('/parametros?ids=137,141')
      .expect(200);
    expect(crud.llamadas('/parametro')).toHaveLength(2);

    const res = await request(app.getHttpServer())
      .get('/parametros?ids=141,137')
      .expect(200);

    expect(res.body.Data['137']).toEqual(parametrosPorTipo['137']);
    expect(crud.llamadas('/parametro')).toHaveLength(2);
  });

  it('solo consulta al CRUD los tipos que no están en caché', async () => {
    await request(app.getHttpServer()).get('/parametros?ids=137').expect(200);
    await request(app.getHttpServer())
      .get('/parametros?ids=137,141')
      .expect(200);

    expect(crud.llamadas('/parametro').map((p) => p.query.query)).toEqual([
      'TipoParametroId.Id:137',
      'TipoParametroId.Id:141',
    ]);
  });

  it('DELETE /parametros limpia la caché y la siguiente consulta vuelve al CRUD', async () => {
    await request(app.getHttpServer()).get('/parametros?ids=137').expect(200);

    const res = await request(app.getHttpServer())
      .delete('/parametros')
      .expect(200);
    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Caché de parametros limpiado exitosamente',
    });

    await request(app.getHttpServer()).get('/parametros?ids=137').expect(200);
    expect(crud.llamadas('/parametro')).toHaveLength(2);
  });

  it('un tipo sin registros ([{}] del CRUD) responde [] y no se guarda en caché', async () => {
    const res = await request(app.getHttpServer())
      .get('/parametros?ids=999')
      .expect(200);
    expect(res.body.Data).toEqual({ '999': [] });

    await request(app.getHttpServer()).get('/parametros?ids=999').expect(200);
    expect(crud.llamadas('/parametro')).toHaveLength(2);
  });

  it.each([[''], ['ids='], ['ids=abc'], ['ids=137,abc']])(
    'GET /parametros?%s responde 400 sin consultar el CRUD',
    async (query) => {
      const res = await request(app.getHttpServer())
        .get(`/parametros?${query}`)
        .expect(400);
      expect(res.body).toMatchObject({
        Success: false,
        Status: 400,
        Data: null,
      });
      expect(crud.llamadas('/parametro')).toHaveLength(0);
    },
  );

  it('reintenta cuando el CRUD falla una vez y responde 200', async () => {
    let intentos = 0;
    crud.en('/parametro', (_peticion, req, res) => {
      intentos++;
      if (intentos === 1) {
        req.socket.destroy();
        return;
      }
      responderJson(res, 200, respuestaParametros(parametrosPorTipo['137']));
    });

    const res = await request(app.getHttpServer())
      .get('/parametros?ids=137')
      .expect(200);

    expect(res.body.Data['137']).toEqual(parametrosPorTipo['137']);
    expect(intentos).toBe(2);
  });

  it('responde 500 con Data null y sin exponer el error cuando el CRUD no responde', async () => {
    crud.en('/parametro', (_peticion, req) => req.socket.destroy());

    const res = await request(app.getHttpServer())
      .get('/parametros?ids=137')
      .expect(500);

    expect(res.body).toEqual({
      Success: false,
      Status: 500,
      Message: 'Error al consultar el Caché de parametros',
      Data: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
    // intento inicial + 3 reintentos
    expect(crud.llamadas('/parametro')).toHaveLength(4);
  }, 20000);

  it('responde 500 y no guarda en caché cuando el CRUD responde Success false', async () => {
    crud.en('/parametro', (_peticion, _req, res) =>
      responderJson(res, 200, {
        Success: false,
        Status: '400',
        Message: 'error',
        Data: null,
      }),
    );

    await request(app.getHttpServer()).get('/parametros?ids=137').expect(500);

    crud.en('/parametro', (_peticion, _req, res) =>
      responderJson(res, 200, respuestaParametros(parametrosPorTipo['137'])),
    );
    await request(app.getHttpServer()).get('/parametros?ids=137').expect(200);
    expect(crud.llamadas('/parametro')).toHaveLength(2);
  });
});
