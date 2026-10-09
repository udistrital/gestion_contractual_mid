import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import nock from 'nock';
import { PolizasModule } from './../src/polizas/polizas.module';

// e2e sin red real: controllers + service + axios reales, gestion_contractual_crud
// simulado con nock. Verifica que el MID reenvía rutas, query, body, status y
// sobre de respuesta del CRUD sin transformarlos (#360).
const CRUD = 'http://crud.test';

const filtroContrato = (contratoId: number) =>
  JSON.stringify({ contrato_general_id: contratoId, activo: true });

describe('Pólizas y amparos-polizas (e2e con nock)', () => {
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
          load: [() => ({ ENDP_GESTION_CONTRACTUAL_CRUD: CRUD })],
        }),
        PolizasModule,
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

  describe('polizas', () => {
    it('GET 200: reenvía query y limit, devuelve el sobre del CRUD', async () => {
      const body = {
        Success: true,
        Status: 200,
        Message: 'Pólizas encontradas',
        Data: [{ id: 1, contrato_general_id: 10 }],
        Metadata: { total: 1 },
      };
      const crud = nock(CRUD)
        .get('/polizas')
        .query({ query: filtroContrato(10), limit: '1' })
        .reply(200, body);

      const res = await request(app.getHttpServer())
        .get('/polizas')
        .query({ query: filtroContrato(10), limit: 1 })
        .expect(200);

      expect(res.body).toEqual(body);
      expect(crud.isDone()).toBe(true);
    });

    it('POST 201: reenvía el body', async () => {
      const poliza = { contrato_general_id: 10, numero_poliza: 'P-1' };
      const crud = nock(CRUD)
        .post('/polizas', poliza)
        .reply(201, { Success: true, Status: 201, Data: { id: 3, ...poliza } });

      const res = await request(app.getHttpServer())
        .post('/polizas')
        .send(poliza)
        .expect(201);

      expect(res.body.Data.id).toBe(3);
      expect(crud.isDone()).toBe(true);
    });

    it('POST 400: propaga el error de validación del CRUD sin reintentar', async () => {
      const error = {
        Success: false,
        Status: 400,
        Message: 'contrato_general_id es requerido',
        Data: 'contrato_general_id es requerido',
      };
      const crud = nock(CRUD).post('/polizas').times(1).reply(400, error);

      const res = await request(app.getHttpServer())
        .post('/polizas')
        .send({})
        .expect(400);

      expect(res.body).toEqual(error);
      expect(crud.isDone()).toBe(true);
    });

    it('PUT 404: propaga póliza no encontrada', async () => {
      nock(CRUD)
        .put('/polizas/999', { numero_poliza: 'X' })
        .reply(404, { Success: false, Status: 404, Message: 'No encontrada' });

      const res = await request(app.getHttpServer())
        .put('/polizas/999')
        .send({ numero_poliza: 'X' })
        .expect(404);

      expect(res.body.Message).toBe('No encontrada');
    });

    it('PUT 400: id no entero no llega al CRUD', async () => {
      const crud = nock(CRUD).put(/.*/).reply(200, {});

      await request(app.getHttpServer())
        .put('/polizas/abc')
        .send({})
        .expect(400);

      expect(crud.isDone()).toBe(false);
    });
  });

  describe('amparos-polizas', () => {
    it('GET 200: reenvía query, limit, sortBy y orderBy', async () => {
      const crud = nock(CRUD)
        .get('/amparos-polizas')
        .query({
          query: filtroContrato(10),
          limit: '0',
          sortBy: 'id',
          orderBy: 'ASC',
        })
        .reply(200, { Success: true, Status: 200, Data: [{ id: 1 }] });

      const res = await request(app.getHttpServer())
        .get('/amparos-polizas')
        .query({
          query: filtroContrato(10),
          limit: 0,
          sortBy: 'id',
          orderBy: 'ASC',
        })
        .expect(200);

      expect(res.body.Data).toEqual([{ id: 1 }]);
      expect(crud.isDone()).toBe(true);
    });

    it('POST 206: conserva la creación parcial del CRUD', async () => {
      const amparos = [
        { contrato_general_id: 10, amparo_id: 6602 },
        { contrato_general_id: 10, amparo_id: 0 },
      ];
      const body = {
        Success: true,
        Status: 206,
        Data: { creados: [{ id: 1 }], errores: [{ indice: 1 }] },
      };
      nock(CRUD).post('/amparos-polizas', amparos).reply(206, body);

      const res = await request(app.getHttpServer())
        .post('/amparos-polizas')
        .send(amparos)
        .expect(206);

      expect(res.body).toEqual(body);
    });

    it('PUT 200: vincula el amparo a la póliza', async () => {
      const cambios = { poliza_id: 3, valor: 1000 };
      const crud = nock(CRUD)
        .put('/amparos-polizas/5', cambios)
        .reply(200, {
          Success: true,
          Status: 200,
          Data: { id: 5, ...cambios },
        });

      await request(app.getHttpServer())
        .put('/amparos-polizas/5')
        .send(cambios)
        .expect(200);

      expect(crud.isDone()).toBe(true);
    });

    it('DELETE 200: borrado lógico', async () => {
      const crud = nock(CRUD)
        .delete('/amparos-polizas/5')
        .reply(200, {
          Success: true,
          Status: 200,
          Data: { id: 5, activo: false },
        });

      const res = await request(app.getHttpServer())
        .delete('/amparos-polizas/5')
        .expect(200);

      expect(res.body.Data.activo).toBe(false);
      expect(crud.isDone()).toBe(true);
    });

    it('DELETE 500: no reintenta escrituras', async () => {
      const crud = nock(CRUD)
        .delete('/amparos-polizas/5')
        .times(2)
        .reply(500, { Success: false, Status: 500 });

      await request(app.getHttpServer())
        .delete('/amparos-polizas/5')
        .expect(500);

      expect(crud.pendingMocks()).toHaveLength(1);
    });

    it('GET reintenta ante 503 y responde 200', async () => {
      nock(CRUD).get('/amparos-polizas').query(true).reply(503, {});
      nock(CRUD)
        .get('/amparos-polizas')
        .query(true)
        .reply(200, { Success: true, Status: 200, Data: [] });

      await request(app.getHttpServer()).get('/amparos-polizas').expect(200);
    }, 10000);
  });
});
