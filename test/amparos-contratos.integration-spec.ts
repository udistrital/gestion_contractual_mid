import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// Integración real: AppModule + .env reales, sin mocks. Pega contra el CRUD de
// gestión contractual y el CRUD de parámetros configurados en .env.
// Solo corre con RUN_INTEGRATION=true (npm run test:integration).
//
// Datos requeridos en el CRUD: el contrato INTEGRATION_CONTRATO_ID (default 1)
// debe tener al menos un amparo con activo=true.
const describeIf = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;
const CONTRATO_CON_AMPAROS = Number(process.env.INTEGRATION_CONTRATO_ID ?? 1);
const CONTRATO_SIN_AMPAROS = 99999999;

describeIf('AmparosContratos (integración real)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('200: devuelve solo amparos activos del contrato con campo "amparo"', async () => {
    const res = await request(app.getHttpServer())
      .get(`/amparos-contratos/${CONTRATO_CON_AMPAROS}`)
      .expect(200);

    expect(res.body.Success).toBe(true);
    expect(res.body.Data.length).toBeGreaterThan(0);
    for (const amparo of res.body.Data) {
      expect(amparo.contrato_general_id).toBe(CONTRATO_CON_AMPAROS);
      expect(amparo.activo).toBe(true);
      expect(amparo).toHaveProperty('amparo');
    }
  }, 30000);

  it('404: contrato sin amparos', async () => {
    await request(app.getHttpServer())
      .get(`/amparos-contratos/${CONTRATO_SIN_AMPAROS}`)
      .expect(404);
  }, 30000);

  it('400: contratoId no entero no devuelve amparos de otros contratos', async () => {
    await request(app.getHttpServer()).get('/amparos-contratos/abc').expect(400);
  });
});
