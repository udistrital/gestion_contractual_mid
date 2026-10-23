import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

import { AmparosContratosModule } from './amparos-contratos/amparos-contratos.module';
import { CargueMasivoModule } from './cargue-masivo/cargue-masivo.module';
import { ContratoGeneralModule } from './contrato-general/contrato-general.module';
import { EspaciosFisicosModule } from './espacios-fisicos/espacios-fisicos.module';
import { EstadosModule } from './estados/estados.module';
import { ParametroModule } from './parametro/parametro.module';
import { VariablesClausulasModule } from './variables-clausulas/variables-clausulas.module';
import { OrdenadoresModule } from './ordenador/ordenadores.module';
import { SupervisoresModule } from './supervisor/supervisores.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 14400000, // 4 horas
    }),
    AmparosContratosModule,
    CargueMasivoModule,
    ContratoGeneralModule,
    EspaciosFisicosModule,
    EstadosModule,
    ParametroModule,
    VariablesClausulasModule,
    OrdenadoresModule,
    SupervisoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
