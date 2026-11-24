import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import nock from 'nock';
import { TablerosModule } from './../src/tableros/tableros.module';

// e2e sin red real: GET /tableros/contratos?vigencia-id= con el CRUD simulado con nock.
// El parámetro se llama vigencia-id en el MID y en el CRUD (udistrital/argo_documentacion#414).
const CRUD = 'http://crud.test/v1';
const contrato = {
  contrato_general_id: 7,
  vigencia_id: 6900,
  estado_parametro_id: 6773,
};

describe('GET /tableros/contratos (e2e con nock)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ GESTION_CONTRACTUAL_CRUD_SERVICE: `${CRUD}/` })],
        }),
        TablerosModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Igual que main.ts
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(() => nock.cleanAll());

  afterAll(async () => {
    await app.close();
    nock.enableNetConnect();
  });

  it('200: filtra por vigencia-id y se lo envía al CRUD con el mismo nombre', async () => {
    const crud = nock(CRUD)
      .get('/tableros/contratos')
      .query({ 'vigencia-id': '6900' })
      .reply(200, { Success: true, Status: '200', Data: [contrato] });

    const res = await request(app.getHttpServer())
      .get('/tableros/contratos?vigencia-id=6900')
      .expect(200);

    expect(res.body.Data).toEqual([contrato]);
    expect(crud.isDone()).toBe(true);
  });

  it('200: sin filtro no envía vigencia-id al CRUD', async () => {
    const crud = nock(CRUD)
      .get('/tableros/contratos')
      .query({})
      .reply(200, { Success: true, Status: '200', Data: [] });

    await request(app.getHttpServer()).get('/tableros/contratos').expect(200);
    expect(crud.isDone()).toBe(true);
  });

  it('200: el nombre anterior vigencia_id ya no filtra', async () => {
    const crud = nock(CRUD)
      .get('/tableros/contratos')
      .query({})
      .reply(200, { Success: true, Status: '200', Data: [contrato] });

    await request(app.getHttpServer())
      .get('/tableros/contratos?vigencia_id=6900')
      .expect(200);
    expect(crud.isDone()).toBe(true);
  });

  it.each(['abc', '0', '-1', '1.5'])(
    '400: vigencia-id %p no es válido y no llama al CRUD',
    async (valor) => {
      const crud = nock(CRUD).get(/.*/).reply(200, { Data: [] });

      const res = await request(app.getHttpServer())
        .get(`/tableros/contratos?vigencia-id=${valor}`)
        .expect(400);

      expect(JSON.stringify(res.body)).toMatch(
        /vigencia-id debe ser (un número entero|mayor o igual a 1)/,
      );
      expect(crud.isDone()).toBe(false);
    },
  );
});
