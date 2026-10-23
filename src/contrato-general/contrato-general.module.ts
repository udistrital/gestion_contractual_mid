import { Module } from '@nestjs/common';
import { ContratoGeneralService } from './contrato-general.service';
import { ContratoGeneralController } from './contrato-general.controller';
import { ParametroService } from '../parametro/parametro.service';
import { ParametroModule } from 'src/parametro/parametro.module';

@Module({
  imports: [ParametroModule],
  controllers: [ContratoGeneralController],
  providers: [ContratoGeneralService],
})
export class ContratoGeneralModule {}
