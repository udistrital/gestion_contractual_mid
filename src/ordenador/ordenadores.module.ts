import { Module } from '@nestjs/common';
import { OrdenadoresService } from './ordenadores.service';
import { ParametroService } from '../parametro/parametro.service';
import { OrdenadoresController } from './ordenadores.controller';

@Module({
  controllers: [OrdenadoresController],
  providers: [OrdenadoresService, ParametroService],
})
export class OrdenadoresModule {}
