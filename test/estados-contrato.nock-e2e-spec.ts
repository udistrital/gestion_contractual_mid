import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import nock from 'nock';
import { ContratoGeneralModule } from './../src/contrato-general/contrato-general.module';

// e2e sin red real: POST /contratos-generales/{id}/estados con el CRUD simulado con nock.
// Verifica el orden (número antes del estado) y el reintento ante un 409 de la única.
const CRUD = 'http://crud.test/v1';
const SUSCRITO = 6774;
const cambio = {
  estado_parametro_id: SUSCRITO,
  estado_interno_parametro_id: 6802,
  usuario_id: 7,
  usuario_rol: 'JEFE_CONTRATACION_RECTOR',
};
const contrato = {
  id: 42,
  unidad_ejecutora_id: 6818,
  vigencia_id: 9001,
  numero_contrato: null,
};

describe('POST /contratos-generales/{id}/estados (e2e con nock)', () => {
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
              GESTION_CONTRACTUAL_CRUD_SERVICE: CRUD,
              PARAMETROS_CRUD_SERVICE: 'http://parametros.test/v1/',
            }),
          ],
        }),
        CacheModule.register({ isGlobal: true }),
        ContratoGeneralModule,
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

  it('400: el cuerpo no puede traer numero_contrato y no llama al CRUD', async () => {
    const crud = nock(CRUD)
      .get('/contratos-generales/42')
      .reply(200, { Data: contrato });

    const res = await request(app.getHttpServer())
      .post('/contratos-generales/42/estados')
      .send({ ...cambio, numero_contrato: '99' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('numero_contrato');
    expect(crud.isDone()).toBe(false);
  });

  it('201: ante un 409 del número recalcula, reintenta y luego registra el estado', async () => {
    const crud = nock(CRUD)
      .get('/contratos-generales/42')
      .reply(200, { Status: '200', Data: contrato })
      .post('/contratos-generales/conteo-numero-contrato', {
        unidad_ejecutora_id: 6818,
        vigencia_id: 9001,
        estado: SUSCRITO,
      })
      .times(2)
      .reply(200, { Success: true, Status: '200', Data: 4 })
      .put('/contratos-generales/42', { numero_contrato: '5' })
      .reply(409, {
        Success: false,
        Status: '409',
        Message: 'numero_contrato repetido',
      })
      .put('/contratos-generales/42', { numero_contrato: '6' })
      .reply(200, {
        Status: '200',
        Data: { ...contrato, numero_contrato: '6' },
      })
      .post('/estados-contrato/', {
        ...cambio,
        contrato_general_id: { id: 42 },
      })
      .reply(201, { Status: '201', Data: { id: 3, actual: true } });

    const res = await request(app.getHttpServer())
      .post('/contratos-generales/42/estados')
      .send(cambio)
      .expect(201);

    expect(res.body).toEqual({
      Success: true,
      Status: 201,
      Message: 'Estado del contrato registrado',
      Data: { estado: { id: 3, actual: true }, numero_contrato: '6' },
    });
    expect(crud.isDone()).toBe(true);
  });

  it('409: si choca dos veces no registra el estado', async () => {
    nock(CRUD)
      .get('/contratos-generales/42')
      .reply(200, { Data: contrato })
      .post('/contratos-generales/conteo-numero-contrato')
      .times(2)
      .reply(200, { Success: true, Status: '200', Data: 4 })
      .put('/contratos-generales/42')
      .times(2)
      .reply(409, {
        Success: false,
        Status: '409',
        Message: 'numero_contrato repetido',
      });
    const estado = nock(CRUD).post('/estados-contrato/').reply(201, {});

    await request(app.getHttpServer())
      .post('/contratos-generales/42/estados')
      .send(cambio)
      .expect(409);

    expect(estado.isDone()).toBe(false);
  });
});
