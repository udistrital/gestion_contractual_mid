import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ParametrosController } from './parametro.controller';
import { ParametroService } from './parametro.service';

describe('ParametrosController (HTTP)', () => {
  let app: INestApplication;
  let getParametrosPorTipoId: jest.Mock;
  let limpiarCache: jest.Mock;

  beforeEach(async () => {
    getParametrosPorTipoId = jest.fn();
    limpiarCache = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParametrosController],
      providers: [
        {
          provide: ParametroService,
          useValue: { getParametrosPorTipoId, limpiarCache },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('GET /parametros?ids=137,141 responde 200 con los parámetros por tipo', async () => {
    const data = { '137': [{ Id: 1, Nombre: 'Uno' }], '141': [] };
    getParametrosPorTipoId.mockResolvedValue(data);

    const res = await request(app.getHttpServer())
      .get('/parametros')
      .query({ ids: '137, 141' })
      .expect(200);

    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Parametros consultados exitosamente',
      Data: data,
    });
    expect(getParametrosPorTipoId).toHaveBeenCalledWith(['137', '141']);
  });

  it('GET /parametros sin ids responde 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/parametros')
      .expect(400);

    expect(res.body.Success).toBe(false);
    expect(res.body.Status).toBe(400);
    expect(getParametrosPorTipoId).not.toHaveBeenCalled();
  });

  it.each(['', ',,', 'abc', '137,abc'])(
    'GET /parametros?ids=%p responde 400',
    async (ids) => {
      await request(app.getHttpServer())
        .get('/parametros')
        .query({ ids })
        .expect(400);
      expect(getParametrosPorTipoId).not.toHaveBeenCalled();
    },
  );

  it('GET /parametros responde 500 sin exponer el error cuando falla el servicio', async () => {
    const error = Object.assign(new Error('timeout of 5000ms exceeded'), {
      isAxiosError: true,
      config: { baseURL: 'http://parametros-interno/' },
    });
    getParametrosPorTipoId.mockRejectedValue(error);

    const res = await request(app.getHttpServer())
      .get('/parametros')
      .query({ ids: '137' })
      .expect(500);

    expect(res.body).toEqual({
      Success: false,
      Status: 500,
      Message: 'Error al consultar el Caché de parametros',
      Data: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('parametros-interno');
  });

  it('DELETE /parametros espera la limpieza y responde 200', async () => {
    let limpiado = false;
    limpiarCache.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      limpiado = true;
    });

    const res = await request(app.getHttpServer())
      .delete('/parametros')
      .expect(200);

    expect(limpiado).toBe(true);
    expect(res.body).toEqual({
      Success: true,
      Status: 200,
      Message: 'Caché de parametros limpiado exitosamente',
    });
  });

  it('DELETE /parametros responde 500 cuando falla la limpieza', async () => {
    limpiarCache.mockRejectedValue(new Error('store caído'));

    const res = await request(app.getHttpServer())
      .delete('/parametros')
      .expect(500);

    expect(res.body).toEqual({
      Success: false,
      Status: 500,
      Message: 'Error al limpiar el Caché de parametros',
      Data: null,
    });
  });
});
