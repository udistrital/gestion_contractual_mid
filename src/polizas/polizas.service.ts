import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';

export interface RespuestaCrud {
  status: number;
  body: any;
}

// Intermediario entre el MF y gestion_contractual_crud para pólizas y amparos
// (#360). Reenvía query, body y sobre de respuesta sin transformarlos,
// para que el MF consuma el MID con el mismo contrato que tenía el CRUD.
@Injectable()
export class PolizasService {
  private readonly logger = new Logger(PolizasService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.gestionContractualCrud = createAxiosInstance(
      this.configService,
      'ENDP_GESTION_CONTRACTUAL_CRUD'
    )
  }

  consultar(ruta: string, params: Record<string, any>): Promise<RespuestaCrud> {
    return this.reenviar({ method: 'GET', url: ruta, params }, true);
  }

  crear(ruta: string, body: any): Promise<RespuestaCrud> {
    return this.reenviar({ method: 'POST', url: ruta, data: body });
  }

  actualizar(ruta: string, id: number, body: any): Promise<RespuestaCrud> {
    return this.reenviar({ method: 'PUT', url: `${ruta}/${id}`, data: body });
  }

  eliminar(ruta: string, id: number): Promise<RespuestaCrud> {
    return this.reenviar({ method: 'DELETE', url: `${ruta}/${id}` });
  }

  // Solo los GET se reintentan: repetir un POST/PUT/DELETE podría duplicar
  // escrituras en el CRUD.
  private async reenviar(
    config: AxiosRequestConfig,
    reintentar = false,
  ): Promise<RespuestaCrud> {
    try {
      const response = reintentar
        ? await fetchWithRetry(() =>
            this.gestionContractualCrud.request(config),
          )
        : await this.gestionContractualCrud.request(config);

      return { status: response.status, body: response.data };
    } catch (error) {
      // Error HTTP del CRUD (400, 404, 500...): se propaga tal cual.
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al consultar gestion_contractual_crud (${config.method} ${config.url}): ${message}`,
      );

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al comunicarse con gestion_contractual_crud',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
