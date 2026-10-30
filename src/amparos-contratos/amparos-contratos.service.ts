import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { StandardResponse } from '../interfaces/responses.interface';
import { ParametroService } from 'src/parametro/parametro.service';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AmparosContratosService {
  private readonly logger = new Logger(AmparosContratosService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(
    private readonly parametrosCrud: ParametroService,
    private readonly configService: ConfigService,
  ) {
    this.gestionContractualCrud = createAxiosInstance(
      this.configService,
      'ENDP_GESTION_CONTRACTUAL_CRUD',
    );
  }
  
  async getAmparosByContratoId(contratoId: number): Promise<any[]> {
    try {
      // gestion_contractual_crud no expone amparos/contrato/:id; se filtra por
      // contrato y se excluyen los amparos inactivos (soft delete).
      const amparosResponse = await fetchWithRetry(() =>
        this.gestionContractualCrud.get<StandardResponse<any>>('amparos-polizas', {
          params: {
            query: JSON.stringify({
              contrato_general_id: contratoId,
              activo: true,
            }),
            limit: 0,
          },
        }),
      );

      const amparos = amparosResponse.data?.Data;
      if (!Array.isArray(amparos) || amparos.length === 0) {
        throw new NotFoundException(
          `No se encontraron amparos para el contrato ${contratoId}`,
        );
      }

      const amparosMap = await this.parametrosCrud.getParametrosPorTipoId(['118']);

      return amparos.map((amparo: any) => ({
        ...amparo,
        amparo: amparosMap[amparo.amparo_id] || null,
      }));
    } catch (error) {
    this.logger.error(
      `Error al consultar amparos del contrato ${contratoId}:`,
      error,
    );

    if (error instanceof NotFoundException) {
      throw error;
    }

    throw new InternalServerErrorException(
      'Error al consultar amparos del contrato',
    );
  }
  }
}
