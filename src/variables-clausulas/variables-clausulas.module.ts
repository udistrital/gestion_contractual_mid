import { Module } from '@nestjs/common';
import { VariablesClausulasService } from './variables-clausulas.service';
import { VariablesClausulasController } from './variables-clausulas.controller';
import { ParametroModule } from 'src/parametro/parametro.module';

@Module({
  imports: [ParametroModule],
  controllers: [VariablesClausulasController],
  providers: [VariablesClausulasService],
})
export class VariablesClausulasModule {}
