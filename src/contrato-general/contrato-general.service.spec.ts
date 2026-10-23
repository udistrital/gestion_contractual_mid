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
        { provide: ConfigService, useValue: { get: () => 'http://test/' } },
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
