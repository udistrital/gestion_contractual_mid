import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ParametroService } from 'src/parametro/parametro.service';
import { ParametroBase } from 'src/interfaces/responses.interface';
import { AmparosContratosService } from './amparos-contratos.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearErrorAxios(mensaje: string, status?: number) {
  return Object.assign(new Error(mensaje), {
    isAxiosError: true,
    response: status ? { status, data: {} } : undefined,
  });
}

function crearParametrosIndexados(): Map<number, Map<number, ParametroBase>> {
  return new Map([
    [
      118,
      new Map([
        [
          6602,
          {
            Id: 6602,
            Nombre: 'Cumplimiento',
            Descripcion: '',
            CodigoAbreviacion: '',
          },
        ],
      ]),
    ],
  ]);
}

describe('AmparosContratosService', () => {
  let service: AmparosContratosService;
  let amparosGetMock: jest.Mock;
  let getParametrosIndexadosMock: jest.Mock;

  beforeEach(async () => {
    amparosGetMock = jest.fn();
    getParametrosIndexadosMock = jest.fn();

    mockedAxios.create = jest.fn().mockReturnValue({ get: amparosGetMock });
    mockedAxios.isAxiosError.mockImplementation(
      (error: any): error is axios.AxiosError => !!error?.isAxiosError,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmparosContratosService,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'http://crud.test/',
          },
        },
        {
          provide: ParametroService,
          useValue: { getParametrosIndexados: getParametrosIndexadosMock },
        },
      ],
    }).compile();

    service = module.get<AmparosContratosService>(AmparosContratosService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('retorna amparos enriquecidos con el parámetro correspondiente', async () => {
    const parametros = crearParametrosIndexados();
    amparosGetMock.mockResolvedValue({
      data: {
        Data: [
          { id: 1, amparo_id: 6602, contrato_general_id: 10 },
          { id: 2, amparo_id: 999, contrato_general_id: 10 },
        ],
      },
    });
    getParametrosIndexadosMock.mockResolvedValue(parametros);

    const result = await service.getAmparosByContratoId(10);

    expect(result).toEqual([
      {
        id: 1,
        amparo_id: 6602,
        contrato_general_id: 10,
        amparo: parametros.get(118)?.get(6602),
      },
      {
        id: 2,
        amparo_id: 999,
        contrato_general_id: 10,
        amparo: null,
      },
    ]);
    expect(amparosGetMock).toHaveBeenCalledWith('amparos-polizas', {
      params: {
        query: JSON.stringify({ contrato_general_id: 10, activo: true }),
        limit: 0,
      },
    });
    expect(getParametrosIndexadosMock).toHaveBeenCalledWith(['118']);
  });

  it.each([{}, { Data: [] }])(
    'lanza NotFoundException cuando la respuesta no trae amparos: %p',
    async (data) => {
      amparosGetMock.mockResolvedValue({ data });

      await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(getParametrosIndexadosMock).not.toHaveBeenCalled();
    },
  );

  it('envuelve errores del servicio de parámetros en InternalServerErrorException', async () => {
    amparosGetMock.mockResolvedValue({
      data: { Data: [{ id: 1, amparo_id: 6602 }] },
    });
    getParametrosIndexadosMock.mockRejectedValue(new Error('servicio caído'));

    await expect(service.getAmparosByContratoId(10)).rejects.toMatchObject({
      status: 500,
      message: 'Error al consultar amparos del contrato',
    });
  });

  it('envuelve errores no Axios al consultar el CRUD en InternalServerErrorException', async () => {
    amparosGetMock.mockRejectedValue(new Error('fallo inesperado'));

    await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(amparosGetMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta la consulta al CRUD ante un error de red y retorna el resultado', async () => {
    jest.useFakeTimers();
    amparosGetMock
      .mockRejectedValueOnce(crearErrorAxios('Network Error'))
      .mockResolvedValueOnce({
        data: { Data: [{ id: 1, amparo_id: 6602 }] },
      });
    getParametrosIndexadosMock.mockResolvedValue(crearParametrosIndexados());

    const resultPromise = service.getAmparosByContratoId(10);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toMatchObject([
      { id: 1, amparo_id: 6602, amparo: { Nombre: 'Cumplimiento' } },
    ]);
    expect(amparosGetMock).toHaveBeenCalledTimes(2);
  });

  it('agota los reintentos ante errores de red persistentes', async () => {
    jest.useFakeTimers();
    amparosGetMock.mockRejectedValue(crearErrorAxios('Network Error'));

    const resultPromise = service.getAmparosByContratoId(10);
    resultPromise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000);

    await expect(resultPromise).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(amparosGetMock).toHaveBeenCalledTimes(4);
    expect(getParametrosIndexadosMock).not.toHaveBeenCalled();
  });

  it('reintenta errores 5xx explícitos del CRUD', async () => {
    jest.useFakeTimers();
    amparosGetMock
      .mockRejectedValueOnce(crearErrorAxios('Error interno', 500))
      .mockResolvedValueOnce({
        data: { Data: [{ id: 1, amparo_id: 6602 }] },
      });
    getParametrosIndexadosMock.mockResolvedValue(crearParametrosIndexados());

    const resultPromise = service.getAmparosByContratoId(10);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toHaveLength(1);
    expect(amparosGetMock).toHaveBeenCalledTimes(2);
  });

  it('preserva los campos originales del CRUD al enriquecer el amparo', async () => {
    amparosGetMock.mockResolvedValue({
      data: {
        Data: [
          {
            id: 5,
            contrato_general_id: 10,
            poliza_id: 3,
            amparo_id: 6602,
            valor: '1000000.0000000',
            fecha_inicio: '2026-01-01',
            fecha_fin: '2026-12-31',
            activo: true,
          },
        ],
      },
    });
    getParametrosIndexadosMock.mockResolvedValue(crearParametrosIndexados());

    const result = await service.getAmparosByContratoId(10);

    expect(result).toEqual([
      {
        id: 5,
        contrato_general_id: 10,
        poliza_id: 3,
        amparo_id: 6602,
        valor: '1000000.0000000',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        activo: true,
        amparo: crearParametrosIndexados().get(118)?.get(6602),
      },
    ]);
  });
});
