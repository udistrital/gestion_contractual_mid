import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoService } from './cargue-masivo.service';
import { ConfigService } from '@nestjs/config';

describe('CargueMasivoService', () => {
  let service: CargueMasivoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargueMasivoService,
        { provide: ConfigService, useValue: { get: () => 'http://crud/' } },
      ],
    }).compile();

    service = module.get<CargueMasivoService>(CargueMasivoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('apunta al CRUD Beego v2 y envía el contrato como { id }', () => {
    const estructura = service.crearEstructura('YmFzZTY0', {
      contrato_general_id: 7,
    });

    expect(estructura.endpoint).toBe('v1/especificacion_tecnica');
    expect(estructura.complement).toEqual({ contrato_general_id: { id: 7 } });
  });
});
