import { Test, TestingModule } from '@nestjs/testing';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AmparosContratosService } from './amparos-contratos.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearErrorAxios(mensaje: string) {
  return Object.assign(new Error(mensaje), { isAxiosError: true });
}

describe('AmparosContratosService', () => {
  let service: AmparosContratosService;
  let amparosGetMock: jest.Mock;
  let parametrosGetMock: jest.Mock;

  beforeEach(async () => {
  amparosGetMock = jest.fn();
  parametrosGetMock = jest.fn();

  mockedAxios.create = jest
    .fn()
    .mockReturnValueOnce({ get: amparosGetMock })
    .mockReturnValueOnce({ get: parametrosGetMock });

  mockedAxios.isAxiosError.mockImplementation(
    <T = any, D = any, P = any>(
      error: any,
    ): error is axios.AxiosError<T, D, P> => !!error?.isAxiosError,
  );

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AmparosContratosService,
      { provide: ConfigService, useValue: { get: () => 'test' } },
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

  it('retorna los amparos del contrato con el nombre de amparo mapeado', async () => {
    amparosGetMock.mockResolvedValue({
      data: {
        Data: [
          { id: 1, amparo_id: 118, contrato_general_id: 10 },
          { id: 2, amparo_id: 999, contrato_general_id: 10 },
        ],
      },
    });
    parametrosGetMock.mockResolvedValue({
      data: {
        Status: '200',
        Data: [{ Id: 118, Nombre: 'Cumplimiento' }],
      },
    });

    const result = await service.getAmparosByContratoId(10);

    expect(result).toEqual([
      { id: 1, amparo_id: 118, contrato_general_id: 10, amparo: 'Cumplimiento' },
      { id: 2, amparo_id: 999, contrato_general_id: 10, amparo: null },
    ]);
    expect(amparosGetMock).toHaveBeenCalledWith('amparos-polizas', {
      params: {
        query: JSON.stringify({ contrato_general_id: 10, activo: true }),
        limit: 0,
      },
    });
    expect(parametrosGetMock).toHaveBeenCalledWith(
      'parametro?query=TipoParametroId:118&limit=0',
    );
  });

  it('lanza NotFoundException cuando la respuesta de amparos no trae Data', async () => {
    amparosGetMock.mockResolvedValue({ data: {} });

    await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(parametrosGetMock).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException cuando el contrato no tiene amparos activos', async () => {
    amparosGetMock.mockResolvedValue({ data: { Data: [] } });

    await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(parametrosGetMock).not.toHaveBeenCalled();
  });

  it('lanza InternalServerErrorException cuando el servicio de parámetros responde con Status distinto de 200', async () => {
    amparosGetMock.mockResolvedValue({
      data: { Data: [{ id: 1, amparo_id: 118 }] },
    });
    parametrosGetMock.mockResolvedValue({
      data: { Status: '500', Data: null },
    });

    await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('lanza InternalServerErrorException cuando falla la consulta de amparos con un error no-axios', async () => {
    amparosGetMock.mockRejectedValue(new Error('fallo inesperado'));

    await expect(service.getAmparosByContratoId(10)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(amparosGetMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante un error de axios y retorna éxito en el segundo intento', async () => {
    jest.useFakeTimers();

    amparosGetMock
      .mockRejectedValueOnce(crearErrorAxios('Network Error'))
      .mockResolvedValueOnce({
        data: { Data: [{ id: 1, amparo_id: 118 }] },
      });
    parametrosGetMock.mockResolvedValue({
      data: { Status: '200', Data: [{ Id: 118, Nombre: 'Cumplimiento' }] },
    });

    const resultPromise = service.getAmparosByContratoId(10);
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(amparosGetMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: 1, amparo_id: 118, amparo: 'Cumplimiento' },
    ]);
  });

  it('agota los reintentos ante errores de axios persistentes y lanza InternalServerErrorException', async () => {
    jest.useFakeTimers();

    amparosGetMock.mockRejectedValue(crearErrorAxios('Network Error'));

    const resultPromise = service.getAmparosByContratoId(10);
    resultPromise.catch(() => undefined);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    await expect(resultPromise).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(amparosGetMock).toHaveBeenCalledTimes(4);
  });

  it('reintenta ante un error de axios en la consulta de parámetros y retorna éxito en el segundo intento', async () => {
    jest.useFakeTimers();

    amparosGetMock.mockResolvedValue({
      data: { Data: [{ id: 1, amparo_id: 118 }] },
    });
    parametrosGetMock
      .mockRejectedValueOnce(crearErrorAxios('Network Error'))
      .mockResolvedValueOnce({
        data: { Status: '200', Data: [{ Id: 118, Nombre: 'Cumplimiento' }] },
      });

    const resultPromise = service.getAmparosByContratoId(10);
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(parametrosGetMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: 1, amparo_id: 118, amparo: 'Cumplimiento' },
    ]);
  });

  it('agota los reintentos ante errores de axios persistentes en la consulta de parámetros y lanza InternalServerErrorException', async () => {
    jest.useFakeTimers();

    amparosGetMock.mockResolvedValue({
      data: { Data: [{ id: 1, amparo_id: 118 }] },
    });
    parametrosGetMock.mockRejectedValue(crearErrorAxios('Network Error'));

    const resultPromise = service.getAmparosByContratoId(10);
    resultPromise.catch(() => undefined);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    await expect(resultPromise).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(parametrosGetMock).toHaveBeenCalledTimes(4);
  });

  it('un error axios con status 500 explícito del backend se trata igual que un error de red genérico (se reintenta y termina en 500)', async () => {
    jest.useFakeTimers();

    const errorBackend500 = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true,
      response: { status: 500, data: { Success: false, Message: 'Error interno' } },
    });
    amparosGetMock.mockRejectedValue(errorBackend500);

    const resultPromise = service.getAmparosByContratoId(10);
    resultPromise.catch(() => undefined);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    // El servicio no inspecciona error.response.status: cualquier AxiosError agota
    // los 3 reintentos igual, sin distinguir un 500 explícito de un error de red.
    await expect(resultPromise).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(amparosGetMock).toHaveBeenCalledTimes(4);
  });

  it('preserva todos los campos originales del amparo del CRUD al enriquecerlo con el nombre', async () => {
    amparosGetMock.mockResolvedValue({
      data: {
        Data: [
          {
            id: 5,
            contrato_general_id: 10,
            poliza_id: 3,
            amparo_id: 118,
            valor: '1000000.0000000',
            fecha_inicio: '2026-01-01',
            fecha_fin: '2026-12-31',
            activo: true,
          },
        ],
      },
    });
    parametrosGetMock.mockResolvedValue({
      data: { Status: '200', Data: [{ Id: 118, Nombre: 'Cumplimiento' }] },
    });

    const result = await service.getAmparosByContratoId(10);

    expect(result).toEqual([
      {
        id: 5,
        contrato_general_id: 10,
        poliza_id: 3,
        amparo_id: 118,
        valor: '1000000.0000000',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        activo: true,
        amparo: 'Cumplimiento',
      },
    ]);
  });
});

describe('AmparosContratosService (constructor)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lanza un Error síncrono si falta ENDP_GESTION_CONTRACTUAL_CRUD', async () => {
    mockedAxios.create = jest.fn().mockReturnValue({ get: jest.fn() });

    const configService = {
      get: (key: string) =>
        key === 'ENDP_GESTION_CONTRACTUAL_CRUD' ? undefined : 'http://test/',
    };

    await expect(
      Test.createTestingModule({
        providers: [
          AmparosContratosService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile(),
    ).rejects.toThrow('Configuración faltante para ENDP_GESTION_CONTRACTUAL_CRUD');
  });

  it('lanza un Error síncrono si falta ENDP_PARAMETROS_CRUD', async () => {
    mockedAxios.create = jest.fn().mockReturnValue({ get: jest.fn() });

    const configService = {
      get: (key: string) =>
        key === 'ENDP_PARAMETROS_CRUD' ? undefined : 'http://test/',
    };

    await expect(
      Test.createTestingModule({
        providers: [
          AmparosContratosService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile(),
    ).rejects.toThrow('Configuración faltante para ENDP_PARAMETROS_CRUD');
  });
});
