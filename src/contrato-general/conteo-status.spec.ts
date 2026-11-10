import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ContratoGeneralService } from './contrato-general.service';
import { ParametroService } from '../parametro/parametro.service';

jest.mock('axios');
// conf.ts importa 'src/environments/environment' y jest no resuelve la ruta absoluta 'src/'
jest.mock(
  'src/environments/environment',
  () => jest.requireActual('../environments/environment'),
  { virtual: true },
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

// El CRUD responde Status como número en los éxitos y como texto en los errores.
describe('ContratoGeneralService.obtenerConteo y el tipo de Status', () => {
  let service: ContratoGeneralService;

  beforeEach(async () => {
    mockedAxios.create = jest.fn().mockReturnValue({ get: jest.fn() });
    const modulo = await Test.createTestingModule({
      providers: [
        ContratoGeneralService,
        { provide: ConfigService, useValue: { get: () => 'http://test/v1/' } },
        {
          provide: ParametroService,
          useValue: { getParametrosIndexados: jest.fn() },
        },
      ],
    }).compile();
    service = modulo.get(ContratoGeneralService);
  });

  const responder = (Status: number | string, Success = true) => {
    mockedAxios.post = jest
      .fn()
      .mockResolvedValue({ data: { Success, Status, Data: 4 } });
  };

  it.each([200, '200'])('toma el conteo con Status %p', async (Status) => {
    responder(Status);
    await expect(
      service.obtenerConteo({ vigencia_id: 9001 }, 'conteo-numero-contrato'),
    ).resolves.toBe(4);
  });

  it.each([206, '400'])('con Status %p no toma el conteo', async (Status) => {
    responder(Status, Status === 206);
    await expect(
      service.obtenerConteo({ vigencia_id: 9001 }, 'conteo-numero-contrato'),
    ).resolves.toBeNull();
  });
});
