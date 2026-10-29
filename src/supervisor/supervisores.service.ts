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
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';

interface SupervisorResponse {
  Status: string;
  Data: SupervisorCURD[];
}

interface SupervisorCURD {
  id: number;
  supervisor_id: number;
  sede_legado: string;
  dependencia_legado: string;
  cargo_legado: string;
  cargo_id: number;
  documento: number;
  digito_verificacion: number;
  sede_id: number;
  dependencia_id: number;
  activo: boolean;
  fecha_creacion: string;
  fecha_modificacion: string;
  contrato_general_id: number;
}

interface SupervisorMIDResponse {
  Status: string;
  Data: SupervisorMID[];
}

interface SupervisorMID {
  dependencia_supervisor: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  cargo_id: string;
  documento: string;
  cargo: string;
  nombre: string;
  digito_verificacion: string;
  sede_supervisor: string;
}

@Injectable()
export class SupervisoresService {
  private readonly logger = new Logger(SupervisoresService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly supervisoresOrdenadoresMidAxiosInstance: AxiosInstance;

  constructor(
    private configService: ConfigService,
    private espaciosFisicosService: EspaciosFisicosService,
  ) {
    this.axiosInstance = createAxiosInstance(
      'ENDP_GESTION_CONTRACTUAL_CRUD'
    );

    this.supervisoresOrdenadoresMidAxiosInstance = createAxiosInstance(
      'ENDP_SUPERVISORES_ORDENADORES_MID',
    )
  }

  async consultarInfoSupervisorContrato(id: number): Promise<any> {
    try {
      const response = await fetchWithRetry(() =>
        this.axiosInstance.get<SupervisorResponse>(
          `supervisores/contrato/${id}`,
        ),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `No se ha encontrado info del supervisor para el contrato con ID ${id} o respuesta inválida`,
        );
      }

      const supervisoresBase = response.data.Data;

      const supervisoresDetalle = await Promise.all(
        supervisoresBase.map(async (supervisorBase) => {
          try {
            const supervisorDetalleResponse = await fetchWithRetry(() =>
              this.supervisoresOrdenadoresMidAxiosInstance.get<SupervisorMIDResponse>(
                `/supervisores/documento?documento=${supervisorBase.documento}`,
              ),
            );

            if (
              !supervisorDetalleResponse.data?.Data ||
              !Array.isArray(supervisorDetalleResponse.data.Data)
            ) {
              this.logger.warn(
                `Respuesta inválida al consultar detalles del supervisor con documento ${supervisorBase.documento}`,
              );
              return null;
            }

            const supervisorDetalle = supervisorDetalleResponse.data.Data.find(
              (franja) =>
                franja.dependencia_supervisor ===
                supervisorBase.dependencia_legado,
            );

            if (!supervisorDetalle) {
              this.logger.warn(
                `No se encontró coincidencia de dependencia ${supervisorBase.dependencia_legado} para el supervisor ${supervisorBase.documento}`,
              );
              return null;
            }

            const [sedeResponse, dependenciaResponse] = await Promise.all([
              firstValueFrom(
                this.espaciosFisicosService.obtenerSedePorId(
                  supervisorBase.sede_id.toString(),
                ),
              ),
              firstValueFrom(
                this.espaciosFisicosService.obtenerDependenciaPorId(
                  supervisorBase.dependencia_id.toString(),
                ),
              ),
            ]);

            return {
              ...supervisorBase,
              cargo_supervisor: supervisorDetalle.cargo,
              nombre_supervisor: supervisorDetalle.nombre,
              sede: sedeResponse?.[0]?.Nombre || 'Sede no encontrada',
              dependencia:
                dependenciaResponse.nombre || 'Dependencia no encontrada',
            };
          } catch (error: any) {
            this.logger.error(
              `Error procesando supervisor ${supervisorBase.documento}: ${error.message}`,
            );
            return null;
          }
        }),
      );

      const supervisoresValidos = supervisoresDetalle.filter(
        (supervisor) => supervisor !== null,
      );

      if (supervisoresValidos.length === 0) {
        throw new NotFoundException(
          `No se pudo obtener información válida de ningún supervisor para el contrato ${id}`,
        );
      }

      return supervisoresValidos;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundException(
            `Info de supervisores para el contrato con ID ${id} no encontrado`,
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
