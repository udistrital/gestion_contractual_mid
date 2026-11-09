import { BadRequestException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ContratoGeneralService } from './contrato-general.service';
import { ParametroService } from '../parametro/parametro.service';
import { ParametroBase } from '../interfaces/responses.interface';

jest.mock('axios');
// conf.ts importa 'src/environments/environment' y jest no resuelve la ruta absoluta 'src/'
jest.mock(
  'src/environments/environment',
  () => jest.requireActual('../environments/environment'),
  { virtual: true },
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

function crearMapa(
  entradas: Array<[number, string]>,
): Map<number, ParametroBase> {
  return new Map(
    entradas.map(([Id, Nombre]) => [
      Id,
      { Id, Nombre, Descripcion: '', CodigoAbreviacion: '' },
    ]),
  );
}

function crearParametrosIndexados(): Map<number, Map<number, ParametroBase>> {
  return new Map([
    [112, crearMapa([[6540, 'Prestación de servicios']])],
    [120, crearMapa([[5, 'Persona natural']])],
    [123, crearMapa([[301, 'Funcionamiento']])],
    [125, crearMapa([[300, 'Propios']])],
    [127, crearMapa([[302, 'Transferencia']])],
    [132, crearMapa([[10, 'Natural']])],
    [137, crearMapa([[1, 'Por suscribir']])],
  ]);
}

describe('ContratoGeneralService', () => {
  let service: ContratoGeneralService;
  let crudGetMock: jest.Mock;
  let crudPutMock: jest.Mock;
  let crudPostMock: jest.Mock;
  let getParametrosIndexados: jest.Mock;

  beforeEach(async () => {
    crudGetMock = jest.fn();
    crudPutMock = jest.fn();
    crudPostMock = jest.fn();
    getParametrosIndexados = jest
      .fn()
      .mockResolvedValue(crearParametrosIndexados());

    mockedAxios.create = jest
      .fn()
      .mockReturnValue({ get: crudGetMock, put: crudPutMock, post: crudPostMock });
    mockedAxios.isAxiosError = jest.fn(
      (error: any) => !!error?.isAxiosError,
    ) as any;
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { Data: { proveedor: { nombre_completo_proveedor: 'Proveedor' } } },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContratoGeneralService,
        { provide: ConfigService, useValue: { get: () => 'http://test/v1/' } },
        { provide: ParametroService, useValue: { getParametrosIndexados } },
      ],
    }).compile();

    service = module.get<ContratoGeneralService>(ContratoGeneralService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getContratoTransformed', () => {
    it('reemplaza los ids paramétricos por su nombre', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: {
            id: 1,
            tipo_contrato_id: 6540,
            estados: { estado_parametro_id: 1 },
            contratista: { tipo_persona_id: 10, numero_documento: '123' },
          },
        },
      });

      const result = await service.getContratoTransformed(1);

      expect(result).toEqual({
        id: 1,
        tipo_contrato_id: 'Prestación de servicios',
        estados: { estado_parametro_id: 'Por suscribir' },
        contratista: {
          tipo_persona_id: 'Natural',
          numero_documento: '123',
          nombre: 'Proveedor',
        },
      });
    });

    it('conserva el id cuando no existe en los parámetros, sin fallar', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: {
            id: 1,
            tipo_contrato_id: 1234,
            estados: { estado_parametro_id: 999 },
            contratista: { tipo_persona_id: 77 },
          },
        },
      });

      const result = await service.getContratoTransformed(1);

      expect(result).toEqual({
        id: 1,
        tipo_contrato_id: 1234,
        estados: { estado_parametro_id: 999 },
        contratista: { tipo_persona_id: 77 },
      });
    });

    it('no falla cuando estado_parametro_id y tipo_persona_id vienen null o undefined', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: {
            id: 1,
            tipo_contrato_id: null,
            estados: { motivo: 'sin estado' },
            contratista: { tipo_persona_id: null },
          },
        },
      });

      const result = await service.getContratoTransformed(1);

      expect(result).toEqual({
        id: 1,
        tipo_contrato_id: null,
        estados: { motivo: 'sin estado' },
        contratista: { tipo_persona_id: null },
      });
    });

    it('consulta todos los tipos del mapa de parámetros como texto', async () => {
      crudGetMock.mockResolvedValue({ data: { Data: { id: 1 } } });

      await service.getContratoTransformed(1);

      expect(getParametrosIndexados).toHaveBeenCalledWith([
        '111',
        '112',
        '113',
        '114',
        '115',
        '116',
        '117',
        '120',
        '122',
        '123',
        '124',
        '125',
        '126',
        '127',
        '146',
        '137',
        '132',
      ]);
    });
  });

  describe('getContratoTransformed con el CRUD Beego v2', () => {
    it('consulta contratos-generales y conserva la forma que usan los consumidores', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: {
            id: 1,
            tipo_contrato_id: 6540,
            fecha_inicial: '2026-02-01T00:00:00Z',
            fecha_final: null,
            fecha_suscripcion_estudio: '2026-01-15T00:00:00Z',
            origen_presupuesto_id: 300,
            vigencia_id: 7001,
          },
        },
      });

      const result = await service.getContratoTransformed(1, true);

      expect(crudGetMock).toHaveBeenCalledWith('contratos-generales/1');
      expect(result).toEqual({
        id: 1,
        tipo_contrato_id: 6540,
        tipo_contrato: 'Prestación de servicios',
        fecha_inicial: '2026-02-01',
        fecha_final: null,
        fecha_suscripcion_estudios: '2026-01-15',
        origen_presupuestos_id: 300,
        origen_presupuestos: 'Propios',
        vigencia_id: 7001,
      });
    });

    it('resuelve los campos cuyo nombre estaba mal en el mapa de parámetros', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: {
            id: 1,
            tipo_gasto_id: 301,
            medio_pago_id: 302,
            clase_proveedor_id: 5,
          },
        },
      });

      const result = await service.getContratoTransformed(1, true);

      expect(result).toEqual({
        id: 1,
        tipo_gasto_id: 301,
        tipo_gasto: 'Funcionamiento',
        medio_pago_id: 302,
        medio_pago: 'Transferencia',
        clase_proveedor_id: 5,
        clase_proveedor: 'Persona natural',
      });
    });
  });

  describe('conteos del CRUD Beego v2', () => {
    const respuestaConteo = (Data: number) => ({
      data: { Success: true, Status: '200', Data },
    });

    it('generarConsecutivo llama a la ruta nueva con unidad y vigencia como enteros', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(4));

      const consecutivo = await service.generarConsecutivo({
        unidad_ejecutora_id: '6818',
        vigencia_id: '9001',
      });

      expect(consecutivo).toBe('5');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contratos-generales/conteo-consecutivo',
        { unidad_ejecutora_id: 6818, vigencia_id: 9001 },
      );
    });

    it('generarNumeroContrato envía solo vigencia_id y arma prefijo + conteo + 1', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(2));

      const numero = await service.generarNumeroContrato({
        unidad_ejecutora_id: '6819',
        vigencia_id: '9001',
        estado: '6774',
      });

      expect(numero).toBe('ID-3');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contratos-generales/conteo-numero-contrato',
        { unidad_ejecutora_id: 6819, vigencia_id: 9001, estado: 6774 },
      );
    });

    it('arma la ruta del conteo con la base que termina en /v1, sin barra final', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(4));
      (service as any).configService.get = () => 'http://test/v1';

      await service.generarConsecutivo({
        unidad_ejecutora_id: '6818',
        vigencia_id: 9001,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contratos-generales/conteo-consecutivo',
        { unidad_ejecutora_id: 6818, vigencia_id: 9001 },
      );
    });

    it.each([undefined, null, '', 'abc', '2026.5', 0, -1])(
      'responde 400 con vigencia_id %p sin llamar al CRUD',
      async (vigencia_id) => {
        mockedAxios.post = jest.fn();

        await expect(
          service.generarConsecutivo({ unidad_ejecutora_id: 6818, vigencia_id }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.generarNumeroContrato({
            unidad_ejecutora_id: 6818,
            vigencia_id,
            estado: 6774,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockedAxios.post).not.toHaveBeenCalled();
      },
    );

    it('generarConsecutivo falla cuando el CRUD responde 400', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('400'));

      await expect(
        service.generarConsecutivo({ unidad_ejecutora_id: 6818, vigencia_id: 9001 }),
      ).rejects.toThrow('Error al obtener el conteo de los contratos');
    });
  });

  describe('registrarEstado', () => {
    const SUSCRITO = 6774;
    const cambio = {
      estado_parametro_id: SUSCRITO,
      estado_interno_parametro_id: 6802,
      usuario_id: 7,
      usuario_rol: 'JEFE_CONTRATACION_IDEXUD',
    };
    const contrato = (extra: Record<string, unknown> = {}) => ({
      data: {
        Data: { id: 42, unidad_ejecutora_id: 6819, vigencia_id: 9001, numero_contrato: null, ...extra },
      },
    });
    const errorCrud = (status: number) =>
      Object.assign(new Error(String(status)), {
        isAxiosError: true,
        response: { status, data: { Status: String(status), Message: 'error' } },
      });

    beforeEach(() => {
      crudPutMock.mockResolvedValue({ data: { Data: { id: 42 } } });
      crudPostMock.mockResolvedValue({ data: { Data: { id: 3, actual: true } } });
      mockedAxios.post = jest
        .fn()
        .mockResolvedValue({ data: { Success: true, Status: '200', Data: 2 } });
    });

    it('un estado que no es SUSCRITO solo se registra', async () => {
      crudGetMock.mockResolvedValue(contrato());

      const resultado = await service.registrarEstado(42, {
        ...cambio,
        estado_parametro_id: 6773,
      });

      expect(resultado).toEqual({ estado: { id: 3, actual: true }, numero_contrato: null });
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(crudPutMock).not.toHaveBeenCalled();
      expect(crudPostMock).toHaveBeenCalledWith('estados-contrato/', {
        ...cambio,
        estado_parametro_id: 6773,
        contrato_general_id: { id: 42 },
      });
    });

    it('al pasar a SUSCRITO sin número, lo calcula y lo guarda antes del estado', async () => {
      crudGetMock.mockResolvedValue(contrato());
      const orden: string[] = [];
      crudPutMock.mockImplementation(async () => (orden.push('put'), { data: {} }));
      crudPostMock.mockImplementation(async () => (orden.push('estado'), { data: { Data: { id: 3 } } }));

      const resultado = await service.registrarEstado(42, cambio);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contratos-generales/conteo-numero-contrato',
        { unidad_ejecutora_id: 6819, vigencia_id: 9001, estado: SUSCRITO },
      );
      expect(crudPutMock).toHaveBeenCalledWith('contratos-generales/42', { numero_contrato: 'ID-3' });
      expect(orden).toEqual(['put', 'estado']);
      expect(resultado.numero_contrato).toBe('ID-3');
    });

    it('si el contrato ya tiene número no genera otro', async () => {
      crudGetMock.mockResolvedValue(contrato({ numero_contrato: 'ID-1' }));

      const resultado = await service.registrarEstado(42, cambio);

      expect(resultado.numero_contrato).toBe('ID-1');
      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(crudPutMock).not.toHaveBeenCalled();
      expect(crudPostMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['sin vigencia_id', { vigencia_id: null }],
      ['con una unidad sin prefijo', { unidad_ejecutora_id: 9999 }],
    ])('responde 400 %s, sin escribir en el CRUD', async (_caso, extra) => {
      crudGetMock.mockResolvedValue(contrato(extra));

      await expect(service.registrarEstado(42, cambio)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(crudPutMock).not.toHaveBeenCalled();
      expect(crudPostMock).not.toHaveBeenCalled();
    });

    it('si el número choca (409) recalcula y reintenta una vez con el siguiente', async () => {
      crudGetMock.mockResolvedValue(contrato());
      crudPutMock.mockRejectedValueOnce(errorCrud(409)).mockResolvedValueOnce({ data: {} });

      const resultado = await service.registrarEstado(42, cambio);

      expect(crudPutMock).toHaveBeenNthCalledWith(1, 'contratos-generales/42', { numero_contrato: 'ID-3' });
      expect(crudPutMock).toHaveBeenNthCalledWith(2, 'contratos-generales/42', { numero_contrato: 'ID-4' });
      expect(resultado.numero_contrato).toBe('ID-4');
    });

    it('si choca dos veces responde 409 y no registra el estado', async () => {
      crudGetMock.mockResolvedValue(contrato());
      crudPutMock.mockRejectedValue(errorCrud(409));

      const error = await service.registrarEstado(42, cambio).catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(409);
      expect(crudPutMock).toHaveBeenCalledTimes(2);
      expect(crudPostMock).not.toHaveBeenCalled();
    });

    it('si falla el estado después de guardar el número, propaga el error del CRUD', async () => {
      crudGetMock.mockResolvedValue(contrato());
      crudPostMock.mockRejectedValue(errorCrud(500));

      const error = await service.registrarEstado(42, cambio).catch((e) => e);

      expect(error.getStatus()).toBe(500);
      expect(crudPutMock).toHaveBeenCalledTimes(1);
    });

    it('un contrato inexistente responde 404', async () => {
      crudGetMock.mockRejectedValue(errorCrud(404));

      const error = await service.registrarEstado(99, cambio).catch((e) => e);

      expect(error.getStatus()).toBe(404);
    });
  });

  describe('getAllWithIds', () => {
    it('separa id y nombre, y usa el id cuando el parámetro no existe', async () => {
      crudGetMock.mockResolvedValue({
        data: {
          Data: [
            {
              id: 1,
              tipo_contrato_id: 6540,
              estados: { id: 3, estado_parametro_id: 999 },
              contratista: {
                id: 4,
                tipo_persona_id: 10,
                clase_contratista_id: 42,
              },
            },
          ],
          Metadata: { total: 1 },
        },
      });

      const result = await service.getAllWithIds({});

      expect(result.Data[0]).toEqual({
        id: 1,
        tipo_contrato_id: 6540,
        tipo_contrato: 'Prestación de servicios',
        estados: {
          id: 3,
          contrato_general_id: undefined,
          usuario_id: undefined,
          usuario_rol: undefined,
          estado_parametro_id: 999,
          estado_parametro: 999,
        },
        contratista: {
          id: 4,
          numero_documento: undefined,
          tipo_persona_id: 10,
          tipo_persona: 'Natural',
          clase_contratista_id: 42,
          clase_contratista: 42,
          nombre: null,
        },
      });
    });
  });
});
