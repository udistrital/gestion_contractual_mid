import {Injectable, Logger, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface ContratoResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class VariablesClausulasService {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger = new Logger(VariablesClausulasService.name);

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD'),
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

  async consultarInfoContrato(id: number): Promise<any> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<ContratoResponse>(`contratos-generales/${id}`),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `Contrato general con ID ${id} no encontrado o respuesta inválida`,
        );
      }

      return response.data.Data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundException(
            `Contrato general con ID ${id} no encontrado`,
          );
        }
        this.logger.error(
          `Error al consultar el contrato ${id}: ${JSON.stringify(error.response?.data)}`,
        );
      }
      throw new InternalServerErrorException(
        `Error al consultar el contrato: ${error.message}`,
      );
    }
  }

  private async transformarVariables(){

  };
}
