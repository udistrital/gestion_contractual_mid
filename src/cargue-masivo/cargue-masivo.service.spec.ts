import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoService } from './cargue-masivo.service';
import { ConfigService } from '@nestjs/config';

describe('CargueMasivoService', () => {
  let service: CargueMasivoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargueMasivoService,
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<CargueMasivoService>(CargueMasivoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
