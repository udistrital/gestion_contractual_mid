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
          { id: 1, amparo_id: 118, contrato_id: 10 },
          { id: 2, amparo_id: 999, contrato_id: 10 },
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
      { id: 1, amparo_id: 118, contrato_id: 10, amparo: 'Cumplimiento' },
      { id: 2, amparo_id: 999, contrato_id: 10, amparo: null },
    ]);
    expect(amparosGetMock).toHaveBeenCalledWith('/amparos/contrato/10');
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
});
