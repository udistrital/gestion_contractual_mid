import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EstadosService } from './estados.service';
import { ParametroService } from '../parametro/parametro.service';
import { ParametroBase } from '../interfaces/responses.interface';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearParametro(Id: number, Nombre: string): ParametroBase {
  return { Id, Nombre, Descripcion: '', CodigoAbreviacion: '' };
}

function crearParametrosIndexados(): Map<number, Map<number, ParametroBase>> {
  return new Map([
    [137, new Map([[6620, crearParametro(6620, 'Por suscribir')]])],
    [141, new Map([[6630, crearParametro(6630, 'Borrador')]])],
  ]);
}

describe('EstadosService', () => {
  let service: EstadosService;
  let crudGetMock: jest.Mock;
  let getParametrosIndexados: jest.Mock;

  beforeEach(async () => {
    crudGetMock = jest.fn();
    getParametrosIndexados = jest.fn();

    mockedAxios.create = jest.fn().mockReturnValue({ get: crudGetMock });
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { Id: 5, NombreCompleto: 'Persona de prueba' },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadosService,
        { provide: ConfigService, useValue: { get: () => 'http://test/' } },
        { provide: ParametroService, useValue: { getParametrosIndexados } },
      ],
    }).compile();

    service = module.get<EstadosService>(EstadosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('resuelve los estados generales (137) e internos (141) a su nombre', async () => {
    const metadata = { total: 1, limit: 10, offset: 0 };
    crudGetMock.mockResolvedValue({
      data: {
        Data: [
          {
            id: 1,
            contrato_general_id: 10,
            estado_parametro_id: 6620,
            estado_interno_parametro_id: 6630,
            usuario_id: 5,
          },
        ],
        Metadata: metadata,
      },
    });
    getParametrosIndexados.mockResolvedValue(crearParametrosIndexados());

    const result = await service.getAll({ limit: 10, offset: 0 });

    expect(result).toEqual({
      Data: [
        {
          id: 1,
          contrato_general_id: 10,
          estado_parametro_id: 'Por suscribir',
          estado_interno_parametro_id: 'Borrador',
          usuario_id: 5,
          nombre_usuario: 'Persona de prueba',
        },
      ],
      Metadata: metadata,
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('http://test/tercero/5');
  });

  it('devuelve el id cuando no existe en los parámetros, sin fallar', async () => {
    crudGetMock.mockResolvedValue({
      data: {
        Data: [
          {
            id: 1,
            estado_parametro_id: 999,
            estado_interno_parametro_id: 888,
            usuario_id: null,
          },
        ],
      },
    });
    getParametrosIndexados.mockResolvedValue(crearParametrosIndexados());

    const result = await service.getAll({});

    expect(result.Data).toEqual([
      {
        id: 1,
        estado_parametro_id: 999,
        estado_interno_parametro_id: 888,
        usuario_id: null,
      },
    ]);
  });

  it('no falla cuando los ids de estado vienen null o undefined', async () => {
    crudGetMock.mockResolvedValue({
      data: {
        Data: [
          {
            id: 1,
            estado_parametro_id: null,
            estado_interno_parametro_id: null,
          },
          { id: 2 },
        ],
      },
    });
    getParametrosIndexados.mockResolvedValue(crearParametrosIndexados());

    const result = await service.getAll({});

    expect(result.Data).toEqual([
      { id: 1, estado_parametro_id: null, estado_interno_parametro_id: null },
      { id: 2 },
    ]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('lanza InternalServerErrorException cuando falla la consulta de parámetros', async () => {
    crudGetMock.mockResolvedValue({
      data: { Data: [{ id: 1, estado_parametro_id: 6620 }] },
    });
    getParametrosIndexados.mockRejectedValue(
      new Error('timeout of 1000ms exceeded'),
    );

    const promesa = service.getAll({});

    await expect(promesa).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(promesa).rejects.toThrow(
      'Error al consultar los estados de los contratos: timeout of 1000ms exceeded',
    );
  });

  it('consulta los tipos de parámetro 137 y 141 al servicio de parámetros', async () => {
    crudGetMock.mockResolvedValue({ data: { Data: [] } });
    getParametrosIndexados.mockResolvedValue(crearParametrosIndexados());

    await service.getAll({});

    expect(getParametrosIndexados).toHaveBeenCalledTimes(1);
    expect(getParametrosIndexados).toHaveBeenCalledWith(['137', '141']);
  });
});
