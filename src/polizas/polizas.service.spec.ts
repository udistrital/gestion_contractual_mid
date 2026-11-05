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

  it('crea la instancia de axios con GESTION_CONTRACTUAL_CRUD_SERVICE', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://crud.test/',
        timeout: 5000,
      }),
    );
  });

  it('lanza error si falta GESTION_CONTRACTUAL_CRUD_SERVICE', () => {
    expect(() => new PolizasService({ get: () => undefined } as any)).toThrow(
      'Configuración faltante para GESTION_CONTRACTUAL_CRUD_SERVICE',
    );
  });

  it('consultar: traduce filtro y orden, y devuelve la forma anterior', async () => {
    requestMock.mockResolvedValue({
      status: 200,
      data: {
        Success: true,
        Status: '200',
        Data: [
          {
            id: 1,
            contrato_general_id: { id: 1, numero_contrato: null },
            fecha_inicio: '2026-01-01T00:00:00Z',
          },
        ],
        Metadata: { total: 1 },
      },
    });

    const resultado = await service.consultar('v1/poliza', {
      query: '{"contrato_general_id":1,"activo":true}',
      limit: '1',
      sortBy: 'id',
      orderBy: 'ASC',
      include: 'estados',
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      url: 'v1/poliza',
      params: {
        query: 'contrato_general_id.id:1,activo:true',
        sortby: 'id',
        order: 'asc',
        limit: '1',
        offset: undefined,
      },
    });
    expect(resultado).toEqual({
      status: 200,
      body: {
        Success: true,
        Status: 200,
        Data: [
          { id: 1, contrato_general_id: 1, fecha_inicio: '2026-01-01' },
        ],
        Metadata: { total: 1 },
      },
    });
  });

  it('consultar: responde 400 si el filtro no es JSON', async () => {
    const error = await Promise.resolve()
      .then(() => service.consultar('v1/poliza', { query: 'activo:true' }))
      .catch((e) => e);

    expect(error.getStatus()).toBe(400);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('crear: envía la llave foránea como { id }', async () => {
    requestMock.mockResolvedValue({
      status: 201,
      data: {
        Success: true,
        Status: '201',
        Data: { id: 3, contrato_general_id: { id: 1 } },
      },
    });

    const resultado = await service.crear('v1/poliza', {
      contrato_general_id: 1,
    });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      url: 'v1/poliza',
      data: { contrato_general_id: { id: 1 } },
    });
    expect(resultado.body).toEqual({
      Success: true,
      Status: 201,
      Data: { id: 3, contrato_general_id: 1 },
    });
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

  it('actualizar: PUT a ruta/id y conserva poliza_id en null', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { Success: true } });

    await service.actualizar('v1/amparo_poliza', 3, { poliza_id: null });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: 'v1/amparo_poliza/3',
      data: { poliza_id: null },
    });
  });

  it('actualizar: envía poliza_id como { id }', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { Success: true } });

    await service.actualizar('v1/amparo_poliza', 3, { poliza_id: 9 });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: 'v1/amparo_poliza/3',
      data: { poliza_id: { id: 9 } },
    });
  });

  it('eliminar: DELETE a ruta/id', async () => {
    requestMock.mockResolvedValue({ status: 200, data: { Success: true } });

    await service.eliminar('v1/amparo_poliza', 5);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'DELETE',
      url: 'v1/amparo_poliza/5',
    });
  });

  it('propaga status y body de un error HTTP del CRUD (404)', async () => {
    const body = { Success: false, Status: 404, Message: 'No encontrado' };
    requestMock.mockRejectedValue(crearErrorAxios(404, body));

    const error = await service.actualizar('v1/poliza', 99, {}).catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual(body);
  });

  it('no reintenta un GET con 400 del CRUD', async () => {
    requestMock.mockRejectedValue(crearErrorAxios(400, { Status: 400 }));

    await expect(service.consultar('v1/poliza', {})).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('reintenta un GET ante 5xx y responde cuando el CRUD se recupera', async () => {
    jest.useFakeTimers();
    requestMock
      .mockRejectedValueOnce(crearErrorAxios(503, {}))
      .mockResolvedValueOnce({ status: 200, data: { Data: [] } });

    const promesa = service.consultar('v1/poliza', {});
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promesa).resolves.toEqual({ status: 200, body: { Data: [] } });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('no reintenta un POST ante 5xx (evita escrituras duplicadas)', async () => {
    requestMock.mockRejectedValue(crearErrorAxios(500, { Status: 500 }));

    const error = await service.crear('v1/poliza', {}).catch((e) => e);

    expect(error.getStatus()).toBe(500);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('error sin respuesta (red/timeout) devuelve 500 con sobre estándar', async () => {
    requestMock.mockRejectedValue(crearErrorAxios());

    const error = await service.crear('v1/poliza', {}).catch((e) => e);

    expect(error.getStatus()).toBe(500);
    expect(error.getResponse()).toEqual({
      Success: false,
      Status: 500,
      Message: 'Error al comunicarse con gestion_contractual_crud',
      Data: null,
    });
  });
});
