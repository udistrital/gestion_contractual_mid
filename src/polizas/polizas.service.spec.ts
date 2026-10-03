import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PolizasService } from './polizas.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearErrorAxios(status?: number, data?: any) {
  return Object.assign(new Error('error axios'), {
    isAxiosError: true,
    response: status ? { status, data } : undefined,
  });
}

describe('PolizasService', () => {
  let service: PolizasService;
  let requestMock: jest.Mock;

  beforeEach(async () => {
    requestMock = jest.fn();
    mockedAxios.create = jest.fn().mockReturnValue({ request: requestMock });
    mockedAxios.isAxiosError.mockImplementation(
      <T = any, D = any, P = any>(
        error: any,
      ): error is axios.AxiosError<T, D, P> => !!error?.isAxiosError,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolizasService,
        {
          provide: ConfigService,
          useValue: { get: () => 'http://crud.test/' },
        },
      ],
    }).compile();

    service = module.get<PolizasService>(PolizasService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('crea la instancia de axios con ENDP_GESTION_CONTRACTUAL_CRUD', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://crud.test/',
      timeout: 5000,
    });
  });

  it('lanza error si falta ENDP_GESTION_CONTRACTUAL_CRUD', () => {
    expect(() => new PolizasService({ get: () => undefined } as any)).toThrow(
      'Configuración faltante para ENDP_GESTION_CONTRACTUAL_CRUD',
    );
  });

  it('consultar: reenvía la ruta y los query params, devuelve status y body del CRUD', async () => {
    const body = { Success: true, Status: 200, Data: [{ id: 1 }] };
    requestMock.mockResolvedValue({ status: 200, data: body });
    const params = { query: '{"contrato_general_id":1}', limit: '1' };

    const resultado = await service.consultar('polizas', params);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      url: 'polizas',
      params,
    });
    expect(resultado).toEqual({ status: 200, body });
  });

  it('crear: reenvía el body y conserva el status 206 del CRUD', async () => {
    const body = {
      Success: true,
      Status: 206,
      Data: { creados: [], errores: [] },
    };
    requestMock.mockResolvedValue({ status: 206, data: body });
    const amparos = [{ contrato_general_id: 1, amparo_id: 6602 }];

    const resultado = await service.crear('amparos-polizas', amparos);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      url: 'amparos-polizas',
      data: amparos,
    });
    expect(resultado).toEqual({ status: 206, body });
  });

  it('actualizar: PUT a ruta/id con el body', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { Success: true } });

    await service.actualizar('polizas', 3, { numero_poliza: 'A1' });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: 'polizas/3',
      data: { numero_poliza: 'A1' },
    });
  });

  it('eliminar: DELETE a ruta/id', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { Success: true } });

    await service.eliminar('amparos-polizas', 5);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'DELETE',
      url: 'amparos-polizas/5',
    });
  });

  it('propaga status y body de un error HTTP del CRUD (404)', async () => {
    const body = { Success: false, Status: 404, Message: 'No encontrado' };
    requestMock.mockRejectedValue(crearErrorAxios(404, body));

    const error = await service.actualizar('polizas', 99, {}).catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual(body);
  });

  it('no reintenta un GET con 400 del CRUD', async () => {
    requestMock.mockRejectedValue(crearErrorAxios(400, { Status: 400 }));

    await expect(service.consultar('polizas', {})).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta un GET ante 5xx y responde cuando el CRUD se recupera', async () => {
    jest.useFakeTimers();
    requestMock
      .mockRejectedValueOnce(crearErrorAxios(503, {}))
      .mockResolvedValueOnce({ status: 200, data: { Data: [] } });

    const promesa = service.consultar('polizas', {});
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promesa).resolves.toEqual({ status: 200, body: { Data: [] } });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('no reintenta un POST ante 5xx (evita escrituras duplicadas)', async () => {
    requestMock.mockRejectedValue(crearErrorAxios(500, { Status: 500 }));

    const error = await service.crear('polizas', {}).catch((e) => e);

    expect(error.getStatus()).toBe(500);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('error sin respuesta (red/timeout) devuelve 500 con sobre estándar', async () => {
    requestMock.mockRejectedValue(crearErrorAxios());

    const error = await service.crear('polizas', {}).catch((e) => e);

    expect(error.getStatus()).toBe(500);
    expect(error.getResponse()).toEqual({
      Success: false,
      Status: 500,
      Message: 'Error al comunicarse con gestion_contractual_crud',
      Data: null,
    });
  });
});
