import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { EspaciosFisicosService } from '../espacios-fisicos/espacios-fisicos.service';
import { firstValueFrom } from 'rxjs';

interface ContratoResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class OrdenadoresService {
  private readonly logger = new Logger(OrdenadoresService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly supervisoresOrdenadoresMidAxiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD'),
      timeout: 5000,
    });

    this.supervisoresOrdenadoresMidAxiosInstance = axios.create({
      baseURL: this.configService.get<string>(
        'ENDP_SUPERVISORES_ORDENADORES_MID',
      ),
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

  async consultarInfoSupervisorContrato(id: number): Promise<any> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<ContratoResponse>(
          `ordenador-contrato/contrato/${id}`,
        ),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `No se ha encontrado info del supervisor para el contrato con ID ${id} o respuesta inválida`,
        );
      }

      const ordenaodorBase = response.data.Data;

      const ordenadorDetalleResponse = await this.fetchWithRetry(() =>
        this.supervisoresOrdenadoresMidAxiosInstance.get<ContratoResponse>(
          `/rol-ordenador/actual?rol=${ordenaodorBase.ordenador_argo_id}`,
        ),
      );

      if (
        !ordenadorDetalleResponse.data?.Data ||
        !Array.isArray(ordenadorDetalleResponse.data.Data)
      ) {
        this.logger.warn(
          `Respuesta inválida al consultar detalles del supervisor con documento ${ordenaodorBase.documento}`,
        );
        throw new NotFoundException(
          `No se encontraron detalles para el supervisor con documento ${ordenaodorBase.documento}`,
        );
      }

      const ordenadorData = ordenadorDetalleResponse.data.Data[0];

      const ordenadorCompleto = {
        id: ordenaodorBase.id,
        contrato: ordenaodorBase.contrato_general_id,
        nombre_ordenador: ordenadorData.nombre_ordenador,
        rol_ordenador: ordenadorData.rol_nombre,
        fecha_incio: ordenadorData.fecha_inicio,
        fecha_fin: ordenadorData.fecha_fin,
      };

      return ordenadorCompleto;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundException(
            `Info de supervisor para el contrato con ID ${id} no encontrado`,
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

  async getSupervisorData(id: number): Promise<any> {
    this.logger.log(`Consultando supervisor para el contrato con ID ${id}`);
    try {
      return await this.consultarInfoSupervisorContrato(id);
    } catch (error) {
      this.logger.error(`Error en getSupervisorData para ID ${id}:`, error);
      throw error;
    }
  }
}
