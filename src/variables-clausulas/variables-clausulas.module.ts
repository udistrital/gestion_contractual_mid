import { Module } from '@nestjs/common';
import { VariablesClausulasService } from './variables-clausulas.service';
import { VariablesClausulasController } from './variables-clausulas.controller';

@Module({
  controllers: [VariablesClausulasController],
  providers: [VariablesClausulasService],
})
export class VariablesClausulasModule {}
