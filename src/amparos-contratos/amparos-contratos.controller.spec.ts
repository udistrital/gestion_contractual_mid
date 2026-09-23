import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmparosContratosController } from './amparos-contratos.controller';
import { AmparosContratosService } from './amparos-contratos.service';

describe('AmparosContratosController', () => {
  let controller: AmparosContratosController;
  let service: { getAmparosByContratoId: jest.Mock };

  beforeEach(async () => {
    service = { getAmparosByContratoId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmparosContratosController],
      providers: [
        { provide: AmparosContratosService, useValue: service },
        { provide: ConfigService, useValue: { get: () => 'test' } },
      ],
    }).compile();

    controller = module.get<AmparosContratosController>(
      AmparosContratosController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('retorna una respuesta estándar exitosa con los amparos encontrados', async () => {
    const data = [{ id: 1, amparo: 'Cumplimiento' }];
    service.getAmparosByContratoId.mockResolvedValue(data);

    const result = await controller.getAmparosByContratoId('10');

    expect(service.getAmparosByContratoId).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Amparos de pólizas encontrados',
      Data: data,
    });
  });

  it('propaga la HttpException lanzada por el servicio', async () => {
    const notFound = new NotFoundException('No se encontraron amparos');
    service.getAmparosByContratoId.mockRejectedValue(notFound);

    await expect(controller.getAmparosByContratoId('10')).rejects.toBe(
      notFound,
    );
  });

  it('envuelve errores no controlados en un HttpException 500', async () => {
    service.getAmparosByContratoId.mockRejectedValue(
      new Error('fallo inesperado'),
    );

    await expect(
      controller.getAmparosByContratoId('10'),
    ).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      response: {
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al consultar los amparos',
        Data: null,
      },
    });
  });
});
