import { Module } from '@nestjs/common';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';

@Module({
  controllers: [CargueMasivoController],
  providers: [CargueMasivoService],
})
export class CargueMasivoModule {}
