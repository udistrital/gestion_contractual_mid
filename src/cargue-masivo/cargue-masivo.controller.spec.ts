import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoController } from './cargue-masivo.controller';
import { ConfigService } from '@nestjs/config';
import { CargueMasivoService } from './cargue-masivo.service';

describe('CargueMasivoController', () => {
  let controller: CargueMasivoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargueMasivoController],
      providers: [
        { provide: CargueMasivoService, useValue: {} },
        { provide: ConfigService, useValue: {get: () => 'test'} },
      ],
    }).compile();

    controller = module.get<CargueMasivoController>(CargueMasivoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
