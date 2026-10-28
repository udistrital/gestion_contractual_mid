import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { ParametroResponse } from '../interfaces/responses.interface';

@Injectable()
export class AmparosContratosService {
  private readonly logger = new Logger(AmparosContratosService.name);
  private readonly gestionContractualCrud: AxiosInstance;
  private readonly parametrosAxiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.gestionContractualCrud = this.createAxiosInstance(
      'ENDP_GESTION_CONTRACTUAL_CRUD',
    );
    this.parametrosAxiosInstance = this.createAxiosInstance(
      'ENDP_PARAMETROS_CRUD',
    );
  }

  private createAxiosInstance(endpointKey: string): AxiosInstance {
    const baseURL = this.configService.get<string>(endpointKey);
    if (!baseURL) {
      throw new Error(`Configuración faltante para ${endpointKey}`);
    }
    return axios.create({
      baseURL,
      timeout: 5000,
    });
  }

  private async fetchWithRetry<T>(
    axiosCall: () => Promise<T>,
    retries = 3,
    delay = 1000,
  ): Promise<T> {
    try {
      return await axiosCall();
    } catch (error) {
      if (retries > 0 && axios.isAxiosError(error)) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(axiosCall, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private async obtenerParametrosAmparo(): Promise<Map<number, string>> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.parametrosAxiosInstance.get<ParametroResponse>(
          `parametro?query=TipoParametroId:118&limit=0`,
        ),
      );

      if (response.data.Status !== '200' || !response.data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }

      return new Map(
        response.data.Data.map((param) => [param.Id, param.Nombre]),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error al obtener parámetros de amparo: ${message}`,
      );

      throw error;
    }
  }
  
  async getAmparosByContratoId(contratoId: number): Promise<any[]> {
    try {
      // gestion_contractual_crud no expone amparos/contrato/:id; se filtra por
      // contrato y se excluyen los amparos inactivos (soft delete).
      const amparosResponse = await this.fetchWithRetry(() =>
        this.gestionContractualCrud.get<any>('amparos-polizas', {
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

      const amparosMap = await this.obtenerParametrosAmparo();

      return amparos.map((amparo: any) => ({
        ...amparo,
        amparo: amparosMap.get(amparo.amparo_id) || null,
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
