import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import nock from 'nock';
import { AmparosContratosModule } from './../src/amparos-contratos/amparos-contratos.module';

// e2e sin red real: controller + service + axios reales, CRUD y parámetros
// simulados con nock.
const CRUD = 'http://crud.test';
const PARAMETROS = 'http://parametros.test';

const queryAmparos = (contratoId: number) => ({
  query: JSON.stringify({ contrato_general_id: contratoId, activo: true }),
  limit: '0',
});

describe('AmparosContratosController (e2e con nock)', () => {
  let app: INestApplication;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              ENDP_GESTION_CONTRACTUAL_CRUD: CRUD,
              ENDP_PARAMETROS_CRUD: `${PARAMETROS}/v1/`,
            }),
          ],
        }),
        AmparosContratosModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    nock.cleanAll();
    await app.close();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  it('200: filtra por contrato+activo y enriquece con el nombre del parámetro', async () => {
    const crud = nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(10))
      .reply(200, {
        Data: [
          { id: 1, contrato_general_id: 10, amparo_id: 6602, activo: true },
          { id: 2, contrato_general_id: 10, amparo_id: 1181, activo: true },
        ],
      });
    const parametros = nock(PARAMETROS)
      .get('/v1/parametro')
      .query({ query: 'TipoParametroId:118', limit: '0' })
      .reply(200, {
        Status: '200',
        Data: [{ Id: 6602, Nombre: 'Amparo de Cumplimiento' }],
      });

    const res = await request(app.getHttpServer())
      .get('/amparos-contratos/10')
      .expect(200);

    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Amparos de pólizas encontrados',
      Data: [
        {
          id: 1,
          contrato_general_id: 10,
          amparo_id: 6602,
          activo: true,
          amparo: 'Amparo de Cumplimiento',
        },
        {
          id: 2,
          contrato_general_id: 10,
          amparo_id: 1181,
          activo: true,
          amparo: null,
        },
      ],
    });
    expect(crud.isDone()).toBe(true);
    expect(parametros.isDone()).toBe(true);
  });

  it('404: contrato sin amparos activos, no consulta parámetros', async () => {
    nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(999))
      .reply(200, { Data: [] });
    const parametros = nock(PARAMETROS)
      .get('/v1/parametro')
      .query(true)
      .reply(200, { Status: '200', Data: [] });

    await request(app.getHttpServer()).get('/amparos-contratos/999').expect(404);

    expect(parametros.isDone()).toBe(false);
  });

  it('400: contratoId no entero no llega al CRUD', async () => {
    const crud = nock(CRUD)
      .get('/amparos-polizas')
      .query(true)
      .reply(200, { Data: [{ id: 1 }] });

    await request(app.getHttpServer()).get('/amparos-contratos/abc').expect(400);

    expect(crud.isDone()).toBe(false);
  });

  it('500: parámetros responde Status distinto de 200', async () => {
    nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(10))
      .reply(200, { Data: [{ id: 1, amparo_id: 6602 }] });
    nock(PARAMETROS)
      .get('/v1/parametro')
      .query(true)
      .reply(200, { Status: '500', Data: null });

    await request(app.getHttpServer()).get('/amparos-contratos/10').expect(500);
  });

  it('reintenta ante un fallo transitorio del CRUD y responde 200', async () => {
    nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(10))
      .reply(503, { Message: 'no disponible' });
    nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(10))
      .reply(200, { Data: [{ id: 1, amparo_id: 6602 }] });
    nock(PARAMETROS)
      .get('/v1/parametro')
      .query(true)
      .reply(200, {
        Status: '200',
        Data: [{ Id: 6602, Nombre: 'Amparo de Cumplimiento' }],
      });

    const res = await request(app.getHttpServer())
      .get('/amparos-contratos/10')
      .expect(200);

    expect(res.body.Data[0].amparo).toBe('Amparo de Cumplimiento');
  }, 10000);

  it('500: CRUD caído de forma persistente agota los 3 reintentos (4 llamadas)', async () => {
    const crud = nock(CRUD)
      .get('/amparos-polizas')
      .query(queryAmparos(10))
      .times(4)
      .reply(500, { Message: 'error' });

    await request(app.getHttpServer()).get('/amparos-contratos/10').expect(500);

    expect(crud.isDone()).toBe(true);
  }, 15000);
});
