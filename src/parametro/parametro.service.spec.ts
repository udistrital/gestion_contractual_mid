import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import axios from 'axios';
import { ParametroService } from './parametro.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearErrorAxios(mensaje: string) {
  return Object.assign(new Error(mensaje), { isAxiosError: true });
}

function respuestaCrud(Data: any, Success = true) {
  return { data: { Success, Status: '200', Message: '', Data } };
}

function crearCacheEnMemoria() {
  const almacen = new Map<string, unknown>();
  return {
    almacen,
    get: jest.fn(async (clave: string) => almacen.get(clave)),
    set: jest.fn(async (clave: string, valor: unknown) => {
      almacen.set(clave, valor);
    }),
    clear: jest.fn(async () => almacen.clear()),
  };
}

describe('ParametroService', () => {
  let service: ParametroService;
  let crudGetMock: jest.Mock;
  let cache: ReturnType<typeof crearCacheEnMemoria>;

  beforeEach(async () => {
    crudGetMock = jest.fn();
    cache = crearCacheEnMemoria();

    mockedAxios.create = jest.fn().mockReturnValue({ get: crudGetMock });
    mockedAxios.isAxiosError.mockImplementation(
      (error: any): error is any => !!error?.isAxiosError,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParametroService,
        { provide: ConfigService, useValue: { get: () => 'http://test/' } },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<ParametroService>(ParametroService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('configura el cliente de parametros_crud con timeout de 5000 ms', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://test/', timeout: 5000 }),
    );
  });

  it('consulta el CRUD y guarda en caché los parámetros indexados por Id', async () => {
    crudGetMock.mockResolvedValue(
      respuestaCrud([
        { Id: 1, Nombre: 'Uno' },
        { Id: 2, Nombre: 'Dos' },
      ]),
    );

    const result = await service.getParametrosPorTipoId(['137']);

    expect(result).toEqual({
      '137': [
        { Id: 1, Nombre: 'Uno' },
        { Id: 2, Nombre: 'Dos' },
      ],
    });
    expect(cache.set).toHaveBeenCalledWith('137', {
      '1': { Id: 1, Nombre: 'Uno' },
      '2': { Id: 2, Nombre: 'Dos' },
    });
  });

  it('no consulta el CRUD cuando el tipo ya está en caché', async () => {
    cache.almacen.set('137', { '1': { Id: 1, Nombre: 'Uno' } });

    const result = await service.getParametrosPorTipoId(['137']);

    expect(result).toEqual({ '137': [{ Id: 1, Nombre: 'Uno' }] });
    expect(crudGetMock).not.toHaveBeenCalled();
  });

  it('reintenta ante errores de red con backoff y responde cuando el CRUD se recupera', async () => {
    jest.useFakeTimers();
    crudGetMock
      .mockRejectedValueOnce(crearErrorAxios('timeout of 5000ms exceeded'))
      .mockRejectedValueOnce(crearErrorAxios('Network Error'))
      .mockResolvedValueOnce(respuestaCrud([{ Id: 1, Nombre: 'Uno' }]));

    const promesa = service.getParametrosPorTipoId(['137']);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promesa).resolves.toEqual({
      '137': [{ Id: 1, Nombre: 'Uno' }],
    });
    expect(crudGetMock).toHaveBeenCalledTimes(3);
  });

  it('lanza el error tras agotar los reintentos y no guarda nada en caché', async () => {
    jest.useFakeTimers();
    crudGetMock.mockRejectedValue(crearErrorAxios('Network Error'));

    const promesa = service.getParametrosPorTipoId(['137']);
    const verificacion = expect(promesa).rejects.toThrow('Network Error');
    await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000);
    await verificacion;

    expect(crudGetMock).toHaveBeenCalledTimes(4);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('no reintenta errores que no son de red', async () => {
    crudGetMock.mockRejectedValue(new Error('fallo inesperado'));

    await expect(service.getParametrosPorTipoId(['137'])).rejects.toThrow(
      'fallo inesperado',
    );
    expect(crudGetMock).toHaveBeenCalledTimes(1);
  });

  it('lanza error y no guarda en caché cuando el CRUD responde Success false', async () => {
    crudGetMock.mockResolvedValue(respuestaCrud(null, false));

    await expect(service.getParametrosPorTipoId(['137'])).rejects.toThrow(
      'Respuesta inválida del servidor de parámetros para el tipo 137',
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('descarta elementos sin Id ([{}]) y no guarda en caché la respuesta vacía', async () => {
    crudGetMock.mockResolvedValue(respuestaCrud([{}]));

    const result = await service.getParametrosPorTipoId(['999']);

    expect(result).toEqual({ '999': [] });
    expect(cache.set).not.toHaveBeenCalled();

    await service.getParametrosPorTipoId(['999']);
    expect(crudGetMock).toHaveBeenCalledTimes(2);
  });

  it('getParametrosIndexados devuelve un mapa por tipo y por Id de parámetro', async () => {
    crudGetMock.mockResolvedValue(respuestaCrud([{ Id: 6620, Nombre: 'X' }]));

    const result = await service.getParametrosIndexados(['137']);

    expect(result.get(137)?.get(6620)).toEqual({ Id: 6620, Nombre: 'X' });
  });

  it('limpiarCache vacía la caché', async () => {
    cache.almacen.set('137', {});

    await service.limpiarCache();

    expect(cache.clear).toHaveBeenCalled();
    expect(cache.almacen.size).toBe(0);
  });

  it('solicita ParametroPadreId al CRUD junto con los demás campos', async () => {
    crudGetMock.mockResolvedValue(respuestaCrud([{ Id: 1, Nombre: 'Uno' }]));

    await service.getParametrosPorTipoId(['112']);

    expect(crudGetMock).toHaveBeenCalledWith('parametro', {
      params: {
        query: 'TipoParametroId.Id:112',
        fields:
          'Id,Nombre,Descripcion,CodigoAbreviacion,Activo,ParametroPadreId',
        limit: 0,
      },
    });
  });

  it('conserva ParametroPadreId en la respuesta y en la caché', async () => {
    const tipoContrato = {
      Id: 6540,
      Nombre: 'Prestación de servicios',
      ParametroPadreId: { Id: 6535 },
    };
    crudGetMock.mockResolvedValue(respuestaCrud([tipoContrato]));

    const primera = await service.getParametrosPorTipoId(['112']);
    const segunda = await service.getParametrosPorTipoId(['112']);

    expect(primera['112'][0].ParametroPadreId).toEqual({ Id: 6535 });
    expect(segunda['112'][0].ParametroPadreId).toEqual({ Id: 6535 });
    expect(crudGetMock).toHaveBeenCalledTimes(1);
  });
});
