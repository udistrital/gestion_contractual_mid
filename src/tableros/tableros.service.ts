import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { StandardResponse } from '../interfaces/responses.interface';
import { createAxiosInstance, fetchWithRetry } from '../utils/axios-utils';
import { RECURSOS_CRUD } from '../utils/recursos-crud.constants';
import { ContratosTableroQueryDto } from './dto/tableros.dto';

@Injectable()
export class TablerosService {
  private readonly logger = new Logger(TablerosService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.gestionContractualCrud = createAxiosInstance(
      this.configService,
      'GESTION_CONTRACTUAL_CRUD_SERVICE',
    );
  }

  // Metadatos de seguimiento de los contratos activos (solo Ids), calculados
  // por el CRUD en GET tableros/contratos.
  async getContratos(query: ContratosTableroQueryDto): Promise<any[]> {
    try {
      const response = await fetchWithRetry(() =>
        this.gestionContractualCrud.get<StandardResponse<any[]>>(
          RECURSOS_CRUD.tablerosContratos,
          { params: { vigencia_id: query.vigencia_id } },
        ),
      );
      // Sin contratos el CRUD responde Data: []; otra forma es una falla, no un tablero vacío
      if (!Array.isArray(response.data?.Data)) {
        throw new Error('Respuesta inválida de tableros/contratos');
      }
      return response.data.Data;
    } catch (error) {
      // Error HTTP del CRUD (400, 500...): se propaga tal cual.
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al consultar los contratos del tablero: ${message}`,
      );

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al consultar los contratos del tablero',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
