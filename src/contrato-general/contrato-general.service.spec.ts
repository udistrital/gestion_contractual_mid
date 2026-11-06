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
  let getParametrosIndexados: jest.Mock;

  beforeEach(async () => {
    crudGetMock = jest.fn();
    getParametrosIndexados = jest
      .fn()
      .mockResolvedValue(crearParametrosIndexados());

    mockedAxios.create = jest.fn().mockReturnValue({ get: crudGetMock });
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
    it('consulta contrato_general y conserva la forma que usan los consumidores', async () => {
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

      expect(crudGetMock).toHaveBeenCalledWith('contrato_general/1');
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

    it('generarConsecutivo llama a la ruta nueva con la unidad como entero', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(4));

      const consecutivo = await service.generarConsecutivo({
        unidad_ejecutora_id: '6818',
      });

      expect(consecutivo).toBe('5');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contrato_general/conteo-consecutivo',
        { unidad_ejecutora_id: 6818 },
      );
    });

    it('generarNumeroContrato envía enteros y arma prefijo + conteo + 1', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(2));

      const numero = await service.generarNumeroContrato({
        unidad_ejecutora_id: '6819',
        vigencia: '7001',
        estado: '6774',
      });

      expect(numero).toBe('ID-3');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contrato_general/conteo-numero-contrato',
        { unidad_ejecutora_id: 6819, vigencia: 7001, estado: 6774 },
      );
    });

    it('arma la ruta del conteo con la base que termina en /v1, sin barra final', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(4));
      (service as any).configService.get = () => 'http://test/v1';

      await service.generarConsecutivo({ unidad_ejecutora_id: '6818' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contrato_general/conteo-consecutivo',
        { unidad_ejecutora_id: 6818 },
      );
    });

    it('generarConsecutivo reenvía vigencia_id como entero cuando viene', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(4));

      await service.generarConsecutivo({
        unidad_ejecutora_id: '6818',
        vigencia_id: '9001',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contrato_general/conteo-consecutivo',
        { unidad_ejecutora_id: 6818, vigencia_id: 9001 },
      );
    });

    it('generarNumeroContrato cuenta por vigencia_id cuando viene', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue(respuestaConteo(2));

      await service.generarNumeroContrato({
        unidad_ejecutora_id: 6819,
        vigencia_id: 9001,
        estado: 6774,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://test/v1/contrato_general/conteo-numero-contrato',
        { unidad_ejecutora_id: 6819, vigencia: 9001, vigencia_id: 9001, estado: 6774 },
      );
    });

    it.each(['abc', '2026.5', 0, -1])(
      'rechaza vigencia_id %p sin llamar al CRUD',
      async (vigencia_id) => {
        mockedAxios.post = jest.fn();

        await expect(
          service.generarConsecutivo({ unidad_ejecutora_id: 6818, vigencia_id }),
        ).rejects.toThrow('El campo vigencia_id debe ser un entero');
        await expect(
          service.generarNumeroContrato({ unidad_ejecutora_id: 6818, vigencia_id, estado: 6774 }),
        ).rejects.toThrow('El campo vigencia_id debe ser un entero');
        expect(mockedAxios.post).not.toHaveBeenCalled();
      },
    );

    it('generarNumeroContrato sigue exigiendo la vigencia', async () => {
      mockedAxios.post = jest.fn();

      await expect(
        service.generarNumeroContrato({
          unidad_ejecutora_id: 6818,
          vigencia: '',
          estado: 6774,
        }),
      ).rejects.toThrow('El campo vigencia es requerido');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('generarConsecutivo falla cuando el CRUD responde 400', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('400'));

      await expect(
        service.generarConsecutivo({ unidad_ejecutora_id: 6818 }),
      ).rejects.toThrow('Error al obtener el conteo de los contratos');
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
