import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface RespuestaCrud {
  status: number;
  body: any;
}

// Intermediario entre el MF y gestion_contractual_crud para pólizas y amparos
// (#360). Reenvía query, body, status y sobre de respuesta sin transformarlos,
// para que el MF consuma el MID con el mismo contrato que tenía el CRUD.
@Injectable()
export class PolizasService {
  private readonly logger = new Logger(PolizasService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>(
      'ENDP_GESTION_CONTRACTUAL_CRUD',
    );
    if (!baseURL) {
      throw new Error(
        'Configuración faltante para ENDP_GESTION_CONTRACTUAL_CRUD',
      );
    }
    this.gestionContractualCrud = axios.create({
      baseURL,
      timeout: 5000,
    });
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
        ? await this.fetchWithRetry(() =>
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

  // Reintenta solo fallos transitorios (sin respuesta o 5xx); un 4xx no cambia
  // al repetir la petición.
  private async fetchWithRetry<T>(
    axiosCall: () => Promise<T>,
    retries = 3,
    delay = 1000,
  ): Promise<T> {
    try {
      return await axiosCall();
    } catch (error) {
      const transitorio =
        axios.isAxiosError(error) &&
        (!error.response || error.response.status >= 500);
      if (retries > 0 && transitorio) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(axiosCall, retries - 1, delay * 2);
      }
      throw error;
    }
  }
}
