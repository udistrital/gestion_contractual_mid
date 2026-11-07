import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PolizasController } from './polizas.controller';
import { AmparosPolizasController } from './amparos-polizas.controller';
import { PolizasService } from './polizas.service';

describe('Controladores de pólizas', () => {
  let polizasController: PolizasController;
  let amparosController: AmparosPolizasController;
  let service: jest.Mocked<PolizasService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolizasController, AmparosPolizasController],
      providers: [
        {
          provide: PolizasService,
          useValue: {
            consultar: jest.fn(),
            crear: jest.fn(),
            actualizar: jest.fn(),
            eliminar: jest.fn(),
          },
        },
      ],
    }).compile();

    polizasController = module.get(PolizasController);
    amparosController = module.get(AmparosPolizasController);
    service = module.get(PolizasService);
  });

  it('GET /polizas reenvía params a la ruta polizas', async () => {
    const body = { Success: true, Status: 200, Data: [] };
    service.consultar.mockResolvedValue({ status: 200, body });

    const resultado = await polizasController.consultar({ limit: '1' });

    expect(service.consultar).toHaveBeenCalledWith('polizas', { limit: '1' });
    expect(resultado).toBe(body);
  });

  it('POST /polizas devuelve el body del CRUD', async () => {
    service.crear.mockResolvedValue({ status: 201, body: { Data: { id: 1 } } });

    const resultado = await polizasController.crear({ a: 1 });

    expect(service.crear).toHaveBeenCalledWith('polizas', { a: 1 });
    expect(resultado).toEqual({ Data: { id: 1 } });
  });

  it('PUT /polizas/:id usa la ruta polizas', async () => {
    service.actualizar.mockResolvedValue({ status: 200, body: {} });

    await polizasController.actualizar(7, { b: 2 });

    expect(service.actualizar).toHaveBeenCalledWith('polizas', 7, { b: 2 });
  });

  it('POST /amparos-polizas devuelve el body de creación parcial del CRUD', async () => {
    service.crear.mockResolvedValue({ status: 206, body: { Status: 206 } });

    await amparosController.crear([{ amparo_id: 1 }]);

    expect(service.crear).toHaveBeenCalledWith('amparos-polizas', [
      { amparo_id: 1 },
    ]);
  });

  it('GET, PUT y DELETE /amparos-polizas usan la ruta amparos-polizas', async () => {
    service.consultar.mockResolvedValue({ status: 200, body: {} });
    service.actualizar.mockResolvedValue({ status: 200, body: {} });
    service.eliminar.mockResolvedValue({ status: 200, body: {} });

    await amparosController.consultar({});
    await amparosController.actualizar(5, { poliza_id: 1 });
    await amparosController.eliminar(5);

    expect(service.consultar).toHaveBeenCalledWith('amparos-polizas', {});
    expect(service.actualizar).toHaveBeenCalledWith('amparos-polizas', 5, {
      poliza_id: 1,
    });
    expect(service.eliminar).toHaveBeenCalledWith('amparos-polizas', 5);
  });

  it('relanza HttpException del servicio', async () => {
    service.consultar.mockRejectedValue(
      new HttpException({ Message: 'no' }, 404),
    );

    await expect(polizasController.consultar({})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('responde 500 con el sobre estándar ante errores no HTTP', async () => {
    service.crear.mockRejectedValue(new Error('boom'));

    await expect(amparosController.crear([])).rejects.toMatchObject({
      status: 500,
      response: { Success: false, Status: 500, Data: null },
    });
  });
});
