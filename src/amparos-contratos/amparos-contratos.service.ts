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
  private readonly amparosAxiosInstance: AxiosInstance;
  private readonly parametrosAxiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.amparosAxiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_POLIZAS_CRUD'),
      timeout: 5000,
    });

    this.parametrosAxiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_PARAMETROS_CRUD'),
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
      this.logger.error(
        `Error al obtener parámetros de amparo: ${error.message}`,
      );
      throw error;
    }
  }

  async getAmparosByContratoId(contratoId: number): Promise<any[]> {
    try {
      const amparosResponse = await this.fetchWithRetry(() =>
        this.amparosAxiosInstance.get<any>(`/amparos/contrato/${contratoId}`),
      );

      if (!amparosResponse.data?.Data) {
        throw new NotFoundException(
          `No se encontraron amparos para el contrato ${contratoId}`,
        );
      }

      const amparosMap = await this.obtenerParametrosAmparo();

      return amparosResponse.data.Data.map((amparo: any) => ({
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
        `Error al consultar amparos del contrato: ${error.message}`,
      );
    }
  }
}
