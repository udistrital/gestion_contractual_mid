import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import request from 'supertest';
import nock from 'nock';
import { ContratoGeneralModule } from './../src/contrato-general/contrato-general.module';

// e2e sin red real: POST /contratos-generales/estados?contrato_id= con el CRUD simulado con nock.
// Verifica el orden (número antes del estado), el reintento ante un 409 de la única y la
// validación de contrato_id (udistrital/argo_documentacion#414).
const CRUD = 'http://crud.test/v1';
const SUSCRITO = 6774;
const cambio = {
  estado_parametro_id: SUSCRITO,
  estado_interno_parametro_id: 6802,
  usuario_id: 7,
  usuario_rol: 'JEFE_CONTRATACION_RECTOR',
};
const RUTA = '/contratos-generales/estados?contrato_id=42';
const contrato = {
  id: 42,
  unidad_ejecutora_id: 6818,
  vigencia_id: 9001,
  numero_contrato: null,
};

describe('POST /contratos-generales/estados?contrato_id= (e2e con nock)', () => {
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
      .post(RUTA)
      .send({ ...cambio, numero_contrato: '99' })
      .expect(400);

    expect(JSON.stringify(res.body)).toContain('numero_contrato');
    expect(crud.isDone()).toBe(false);
  });

  it.each([0, -3])(
    '400: usuario_id %p no es un entero positivo y no llama al CRUD',
    async (usuario_id) => {
      const crud = nock(CRUD)
        .get('/contratos-generales/42')
        .reply(200, { Data: contrato });

      const res = await request(app.getHttpServer())
        .post(RUTA)
        .send({ ...cambio, usuario_id })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('usuario_id');
      expect(crud.isDone()).toBe(false);
    },
  );

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
      .post(RUTA)
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

    await request(app.getHttpServer()).post(RUTA).send(cambio).expect(409);

    expect(estado.isDone()).toBe(false);
  });

  it('201: registra un estado sin número con el id de contrato_id', async () => {
    const enRevision = { ...cambio, estado_parametro_id: 6775 };
    const crud = nock(CRUD)
      .get('/contratos-generales/42')
      .reply(200, { Status: '200', Data: contrato })
      .post('/estados-contrato/', {
        ...enRevision,
        contrato_general_id: { id: 42 },
      })
      .reply(201, { Status: '201', Data: { id: 4, actual: true } });

    const res = await request(app.getHttpServer())
      .post(RUTA)
      .send(enRevision)
      .expect(201);

    expect(res.body).toEqual({
      Success: true,
      Status: 201,
      Message: 'Estado del contrato registrado',
      Data: { estado: { id: 4, actual: true }, numero_contrato: null },
    });
    expect(crud.isDone()).toBe(true);
  });

  describe('contrato_id', () => {
    const crudSinLlamar = () =>
      nock(CRUD)
        .get(/.*/)
        .reply(200, { Data: contrato })
        .post(/.*/)
        .reply(201, { Data: { id: 1 } });

    const cuerpoInvalido = {
      Success: false,
      Status: 400,
      Message:
        'El id del contrato es obligatorio y debe ser un entero positivo',
      Data: null,
    };

    it('400: si falta no ejecuta la operación', async () => {
      const crud = crudSinLlamar();

      const res = await request(app.getHttpServer())
        .post('/contratos-generales/estados')
        .send(cambio)
        .expect(400);

      expect(res.body).toEqual(cuerpoInvalido);
      expect(crud.isDone()).toBe(false);
    });

    it.each([
      '',
      'abc',
      '1.5',
      '0x10',
      '1e3',
      '%201',
      '0',
      '-1',
      '2147483648',
      '42&contrato_id=43',
    ])('400: %p no es válido y no ejecuta la operación', async (valor) => {
      const crud = crudSinLlamar();

      const res = await request(app.getHttpServer())
        .post(`/contratos-generales/estados?contrato_id=${valor}`)
        .send(cambio)
        .expect(400);

      expect(res.body).toEqual(cuerpoInvalido);
      expect(crud.isDone()).toBe(false);
    });

    it('400: el nombre con guion (contrato-id) no se acepta', async () => {
      const crud = crudSinLlamar();

      const res = await request(app.getHttpServer())
        .post('/contratos-generales/estados?contrato-id=42')
        .send(cambio)
        .expect(400);

      expect(res.body).toEqual(cuerpoInvalido);
      expect(crud.isDone()).toBe(false);
    });

    it('404: la ruta anterior con el id en el path ya no existe', async () => {
      const crud = crudSinLlamar();

      await request(app.getHttpServer())
        .post('/contratos-generales/42/estados')
        .send(cambio)
        .expect(404);

      expect(crud.isDone()).toBe(false);
    });
  });
});
