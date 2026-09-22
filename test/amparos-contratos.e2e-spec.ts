import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { AmparosContratosModule } from './../src/amparos-contratos/amparos-contratos.module';
import { AmparosContratosService } from './../src/amparos-contratos/amparos-contratos.service';

describe('AmparosContratosController (e2e)', () => {
  let app: INestApplication;

  const amparosContratosServiceMock = {
    getAmparosByContratoId: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AmparosContratosModule],
    })
      .overrideProvider(AmparosContratosService)
      .useValue(amparosContratosServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('/amparos-contratos/:contratoId (GET) devuelve los amparos del contrato', () => {
    const amparosEsperados = [
      { id: 1, contrato_id: 100, amparo_id: 1, amparo: 'Cumplimiento' },
    ];
    amparosContratosServiceMock.getAmparosByContratoId.mockResolvedValue(
      amparosEsperados,
    );

    return request(app.getHttpServer())
      .get('/amparos-contratos/100')
      .expect(200)
      .expect((res) => {
        expect(res.body.Success).toBe(true);
        expect(res.body.Data).toEqual(amparosEsperados);
      });
  });

  it('/amparos-contratos/:contratoId (GET) llama al servicio con el contratoId numérico', async () => {
    amparosContratosServiceMock.getAmparosByContratoId.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/amparos-contratos/100').expect(200);

    expect(
      amparosContratosServiceMock.getAmparosByContratoId,
    ).toHaveBeenCalledWith(100);
  });

  it('/amparos-contratos/:contratoId (GET) devuelve 404 si no hay amparos', () => {
    amparosContratosServiceMock.getAmparosByContratoId.mockRejectedValue(
      new NotFoundException('No se encontraron amparos para el contrato 999'),
    );

    return request(app.getHttpServer())
      .get('/amparos-contratos/999')
      .expect(404);
  });

  it('/amparos-contratos/:contratoId (GET) devuelve 500 ante un error inesperado', () => {
    amparosContratosServiceMock.getAmparosByContratoId.mockRejectedValue(
      new Error('fallo de conexión'),
    );

    return request(app.getHttpServer())
      .get('/amparos-contratos/100')
      .expect(500)
      .expect((res) => {
        expect(res.body.Success).toBe(false);
      });
  });
});
