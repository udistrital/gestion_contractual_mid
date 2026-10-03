import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Integración real: AppModule + .env reales, sin mocks. Pega contra el
// gestion_contractual_crud configurado en ENDP_GESTION_CONTRACTUAL_CRUD.
// Solo corre con RUN_INTEGRATION=true (npm run test:integration).
//
// Crea una póliza y un amparo en el contrato INTEGRATION_CONTRATO_ID (default 1)
// y los deja inactivos al final (borrado lógico del amparo, activo=false en la
// póliza vía PUT).
const describeIf =
  process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;
const CONTRATO_ID = Number(process.env.INTEGRATION_CONTRATO_ID ?? 1);
const AMPARO_ID = Number(process.env.INTEGRATION_AMPARO_ID ?? 6602);

describeIf('Pólizas y amparos-polizas vía MID (integración real)', () => {
  let app: INestApplication;
  let polizaId: number;
  let amparoId: number;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (amparoId) {
      await request(app.getHttpServer()).delete(`/amparos-polizas/${amparoId}`);
    }
    if (polizaId) {
      await request(app.getHttpServer())
        .put(`/polizas/${polizaId}`)
        .send({ activo: false });
    }
    await app?.close();
  });

  it('POST /polizas crea la póliza en el CRUD (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/polizas')
      .send({
        contrato_general_id: CONTRATO_ID,
        numero_poliza: `INT-MID-${Date.now()}`.slice(0, 50),
        entidad_aseguradora_id: 1,
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        fecha_expedicion: '2026-01-01',
        activo: false,
      })
      .expect(201);

    expect(res.body.Success).toBe(true);
    polizaId = res.body.Data.id;
  }, 30000);

  it('PUT /polizas/:id actualiza la póliza (200)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/polizas/${polizaId}`)
      .send({ descripcion: 'integración MID #360' })
      .expect(200);

    expect(res.body.Data.descripcion).toBe('integración MID #360');
  }, 30000);

  it('GET /polizas filtra por contrato', async () => {
    const query = JSON.stringify({ contrato_general_id: CONTRATO_ID });
    const res = await request(app.getHttpServer())
      .get('/polizas')
      .query({ query, limit: 0 })
      .expect(200);

    expect(res.body.Data.some((p: any) => p.id === polizaId)).toBe(true);
  }, 30000);

  it('POST /amparos-polizas crea amparos en lote (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/amparos-polizas')
      .send([
        {
          contrato_general_id: CONTRATO_ID,
          amparo_id: AMPARO_ID,
          tipo_valor_amparo_id: 2,
          suficiencia: 10,
          descripcion: 'integración MID #360',
        },
      ])
      .expect(201);

    const creados = Array.isArray(res.body.Data)
      ? res.body.Data
      : res.body.Data.creados;
    amparoId = creados[0].id;
    expect(amparoId).toBeDefined();
  }, 30000);

  it('PUT /amparos-polizas/:id vincula el amparo a la póliza (200)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/amparos-polizas/${amparoId}`)
      .send({ poliza_id: polizaId })
      .expect(200);

    expect(res.body.Data.poliza_id).toBe(polizaId);
  }, 30000);

  it('GET /amparos-polizas filtra por contrato y activo', async () => {
    const query = JSON.stringify({
      contrato_general_id: CONTRATO_ID,
      activo: true,
    });
    const res = await request(app.getHttpServer())
      .get('/amparos-polizas')
      .query({ query, limit: 0, sortBy: 'id', orderBy: 'ASC' })
      .expect(200);

    expect(res.body.Data.some((a: any) => a.id === amparoId)).toBe(true);
  }, 30000);

  it('DELETE /amparos-polizas/:id hace borrado lógico (200)', async () => {
    await request(app.getHttpServer())
      .delete(`/amparos-polizas/${amparoId}`)
      .expect(200);
    amparoId = undefined;
  }, 30000);

  it('PUT /polizas/:id inexistente propaga 404 del CRUD', async () => {
    await request(app.getHttpServer())
      .put('/polizas/99999999')
      .send({ descripcion: 'x' })
      .expect(404);
  }, 30000);
});
