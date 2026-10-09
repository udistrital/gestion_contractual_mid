import { Module } from '@nestjs/common';
import { PolizasController } from './polizas.controller';
import { AmparosPolizasController } from './amparos-polizas.controller';
import { PolizasService } from './polizas.service';

@Module({
  controllers: [PolizasController, AmparosPolizasController],
  providers: [PolizasService],
})
export class PolizasModule {}
