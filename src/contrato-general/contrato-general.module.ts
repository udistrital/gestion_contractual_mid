import { Module } from '@nestjs/common';
import { ContratoGeneralService } from './contrato-general.service';
import { ContratoGeneralController } from './contrato-general.controller';
import { ParametroService } from '../parametro/parametro.service';

@Module({
  controllers: [ContratoGeneralController],
  providers: [ContratoGeneralService, ParametroService],
})
export class ContratoGeneralModule {}
