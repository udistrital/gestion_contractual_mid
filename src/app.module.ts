import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

import { CargueMasivoModule } from './cargue-masivo/cargue-masivo.module';
import { ContratoGeneralModule } from './contrato-general/contrato-general.module';
import { EspaciosFisicosModule } from './espacios-fisicos/espacios-fisicos.module';
import { EstadosModule } from './estados/estados.module';
import { ParametroModule } from './parametro/parametro.module';
import { VariablesClausulasModule } from './variables-clausulas/variables-clausulas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CargueMasivoModule,
    ContratoGeneralModule,
    EspaciosFisicosModule,
    EstadosModule,
    ParametroModule,
    VariablesClausulasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
