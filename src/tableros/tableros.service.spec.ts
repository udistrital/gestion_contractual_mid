import { HttpException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { ContratosTableroQueryDto } from './dto/tableros.dto';
import { TablerosController } from './tableros.controller';
import { TablerosModule } from './tableros.module';
import { TablerosService } from './tableros.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const contrato = {
  contrato_general_id: 7,
  vigencia_id: 6900,
  dependencia_solicitante_id: 31,
  estado_parametro_id: 6773,
  abogado_id: 500,
};

describe('TablerosService', () => {
  let service: TablerosService;
  let controller: TablerosController;
  let getMock: jest.Mock;

  beforeEach(async () => {
    getMock = jest.fn();
    mockedAxios.create = jest.fn().mockReturnValue({ get: getMock });
    mockedAxios.isAxiosError.mockImplementation(
      (error: any): error is axios.AxiosError => !!error?.isAxiosError,
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TablerosController],
      providers: [
        TablerosService,
        { provide: ConfigService, useValue: { get: () => 'http://crud/v1/' } },
      ],
    }).compile();

    service = module.get(TablerosService);
    controller = module.get(TablerosController);
  });

  it('consulta tableros/contratos del CRUD con la vigencia y responde con el formato estándar', async () => {
    getMock.mockResolvedValue({ data: { Success: true, Data: [contrato] } });

    await expect(
      controller.getContratos({ vigencia_id: 6900 }),
    ).resolves.toEqual({
      Success: true,
      Status: 200,
      Message: 'Contratos del tablero consultados exitosamente',
      Data: [contrato],
    });
    expect(getMock).toHaveBeenCalledWith('tableros/contratos', {
      params: { vigencia_id: 6900 },
    });
  });

  it('sin contratos responde una lista vacía', async () => {
    getMock.mockResolvedValue({ data: { Success: true, Data: [] } });
    await expect(service.getContratos({})).resolves.toEqual([]);
  });

  it('propaga el error HTTP del CRUD con su estado', async () => {
    const respuesta = {
      Success: false,
      Status: 400,
      Message: 'filtro inválido',
    };
    getMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: respuesta },
    });

    const error = await service
      .getContratos({ vigencia_id: 6900 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual(respuesta);
  });

  it('una respuesta sin lista de contratos es un error 500, no un tablero vacío', async () => {
    getMock.mockResolvedValue({ data: { Success: true, Data: null } });

    const error = await service.getContratos({}).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(500);
    expect(error.getResponse()).toMatchObject({
      Success: false,
      Message: 'Error al consultar los contratos del tablero',
    });
  });

  it('un error que no es del CRUD ni una instancia de Error también responde 500', async () => {
    getMock.mockRejectedValue('sin conexión');

    const error = await service.getContratos({}).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(500);
  });

  it('el DTO convierte vigencia_id de la query a número', () => {
    expect(
      plainToInstance(ContratosTableroQueryDto, { vigencia_id: '6900' })
        .vigencia_id,
    ).toBe(6900);
  });

  it('el módulo registra el controlador y el servicio', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({ GESTION_CONTRACTUAL_CRUD_SERVICE: 'http://crud/v1/' }),
          ],
        }),
        TablerosModule,
      ],
    }).compile();

    expect(module.get(TablerosController)).toBeInstanceOf(TablerosController);
    expect(module.get(TablerosService)).toBeInstanceOf(TablerosService);
  });

  // TypeScript (isolatedModules) emite, por cada tipo de los decoradores, una
  // guarda que usa Object si la clase no está definida al cargar el archivo.
  it('sin las clases de los tipos, los decoradores usan Object', () => {
    jest.isolateModules(() => {
      jest.doMock('@nestjs/config', () => ({}));
      const { TablerosService: Servicio } =
        jest.requireActual('./tableros.service');
      expect(Servicio).toBeDefined();
    });
    jest.isolateModules(() => {
      jest.doMock('./tableros.service', () => ({}));
      jest.doMock('./dto/tableros.dto', () => ({}));
      const { TablerosController: Controlador } = jest.requireActual(
        './tableros.controller',
      );
      expect(Controlador).toBeDefined();
    });
  });
});
