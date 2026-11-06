import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { aCuerpoBeego } from '../utils/query-beego.utils';
import { RECURSOS_CRUD } from '../utils/recursos-crud.constants';

@Injectable()
export class CargueMasivoService {
  constructor(private readonly configService: ConfigService) {}

  crearEstructura(base64data: string, complement: Object): any {
    return {
      base64data: base64data,
      service: this.configService.get<string>('GESTION_CONTRACTUAL_CRUD_SERVICE'),
      endpoint: RECURSOS_CRUD.especificacionTecnica,
      complement: aCuerpoBeego(complement),
      structure: {
        descripcion: {
          file_name_column: 'Descripción',
          required: true,
        },
        cantidad: {
          file_name_column: 'Cantidad',
          required: true,
          parse: 'int',
        },
        valor_unitario: {
          file_name_column: 'Valor Unitario',
          required: true,
          parse: 'int',
        },
        valor_total: {
          file_name_column: 'Valor Total',
          required: true,
          parse: 'int',
        },
      },
    };
  }
}
