import { Test, TestingModule } from '@nestjs/testing';
import { PolizasController } from './polizas.controller';
import { AmparosPolizasController } from './amparos-polizas.controller';
import { PolizasService } from './polizas.service';

describe('Controladores de pólizas', () => {
  let polizasController: PolizasController;
  let amparosController: AmparosPolizasController;
  let service: jest.Mocked<PolizasService>;
  let res: { status: jest.Mock };

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
    res = { status: jest.fn() };
  });

  it('GET /polizas reenvía params a la ruta polizas y aplica el status del CRUD', async () => {
    const body = { Success: true, Status: 200, Data: [] };
    service.consultar.mockResolvedValue({ status: 200, body });

    const resultado = await polizasController.consultar(
      { limit: '1' },
      res as any,
    );

    expect(service.consultar).toHaveBeenCalledWith('polizas', { limit: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(resultado).toBe(body);
  });

  it('POST /polizas devuelve 201 del CRUD', async () => {
    service.crear.mockResolvedValue({ status: 201, body: { Data: { id: 1 } } });

    const resultado = await polizasController.crear({ a: 1 }, res as any);

    expect(service.crear).toHaveBeenCalledWith('polizas', { a: 1 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(resultado).toEqual({ Data: { id: 1 } });
  });

  it('PUT /polizas/:id usa la ruta polizas', async () => {
    service.actualizar.mockResolvedValue({ status: 200, body: {} });

    await polizasController.actualizar(7, { b: 2 }, res as any);

    expect(service.actualizar).toHaveBeenCalledWith('polizas', 7, { b: 2 });
  });

  it('POST /amparos-polizas conserva el 206 de creación parcial', async () => {
    service.crear.mockResolvedValue({ status: 206, body: { Status: 206 } });

    await amparosController.crear([{ amparo_id: 1 }], res as any);

    expect(service.crear).toHaveBeenCalledWith('amparos-polizas', [
      { amparo_id: 1 },
    ]);
    expect(res.status).toHaveBeenCalledWith(206);
  });

  it('GET, PUT y DELETE /amparos-polizas usan la ruta amparos-polizas', async () => {
    service.consultar.mockResolvedValue({ status: 200, body: {} });
    service.actualizar.mockResolvedValue({ status: 200, body: {} });
    service.eliminar.mockResolvedValue({ status: 200, body: {} });

    await amparosController.consultar({}, res as any);
    await amparosController.actualizar(5, { poliza_id: 1 }, res as any);
    await amparosController.eliminar(5, res as any);

    expect(service.consultar).toHaveBeenCalledWith('amparos-polizas', {});
    expect(service.actualizar).toHaveBeenCalledWith('amparos-polizas', 5, {
      poliza_id: 1,
    });
    expect(service.eliminar).toHaveBeenCalledWith('amparos-polizas', 5);
  });
});
