import { Test, TestingModule } from '@nestjs/testing';
import { CargueMasivoController } from './cargue-masivo.controller';

describe('CargueMasivoController', () => {
  let controller: CargueMasivoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargueMasivoController],
    }).compile();

    controller = module.get<CargueMasivoController>(CargueMasivoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
