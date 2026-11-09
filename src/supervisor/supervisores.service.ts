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
import { aQueryBeego } from '../utils/query-beego.utils';
import { RECURSOS_CRUD } from '../utils/recursos-crud.constants';

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
  // El CRUD v2 no guarda la sede (crud#51 3a1e5ab) y la dependencia es opcional.
  dependencia_id: number | null;
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
      this.configService,
      'GESTION_CONTRACTUAL_CRUD_SERVICE'
    );

    this.supervisoresOrdenadoresMidAxiosInstance = createAxiosInstance(
      this.configService,
      'ORDENADOR_SUPERVISOR_MID_SERVICE',
    )
  }

  async consultarInfoSupervisorContrato(id: number): Promise<any> {
    try {
      const response = await fetchWithRetry(() =>
        this.axiosInstance.get<SupervisorResponse>(
          `${RECURSOS_CRUD.supervisor}/`,
          {
            params: {
              ...aQueryBeego(
                { contrato_general_id: id, activo: true },
                { sortBy: 'id', orderBy: 'asc' },
              ),
              limit: '0',
            },
          },
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

            // La dependencia de Oikos da el nombre y, si tiene una sola sede, la sede.
            const dependencia = supervisorBase.dependencia_id
              ? await firstValueFrom(
                  this.espaciosFisicosService.obtenerDependenciaPorId(
                    String(supervisorBase.dependencia_id),
                  ),
                ).catch(() => null)
              : null;

            // El MF ya no escribe dependencia_legado: la franja se busca por el legado,
            // luego por el nombre en Oikos y, si el supervisor tiene una sola, esa.
            const franjas = supervisorDetalleResponse.data.Data;
            const supervisorDetalle =
              franjas.find(
                (franja) =>
                  !!supervisorBase.dependencia_legado &&
                  franja.dependencia_supervisor ===
                    supervisorBase.dependencia_legado,
              ) ??
              franjas.find(
                (franja) =>
                  !!dependencia?.nombre &&
                  franja.dependencia_supervisor === dependencia.nombre,
              ) ??
              (franjas.length === 1 ? franjas[0] : undefined);

            if (!supervisorDetalle) {
              this.logger.warn(
                `No se encontró coincidencia de dependencia ${supervisorBase.dependencia_legado} para el supervisor ${supervisorBase.documento}`,
              );
              return null;
            }

            // La sede sale de la dependencia en Oikos si tiene una sola; si no, del legado.
            const sedeUnica =
              dependencia?.sedes.length === 1 ? dependencia.sedes[0].nombre : '';

            return {
              ...supervisorBase,
              cargo_supervisor: supervisorDetalle.cargo,
              nombre_supervisor: supervisorDetalle.nombre,
              sede: sedeUnica || supervisorBase.sede_legado || 'Sede no encontrada',
              dependencia:
                dependencia?.nombre ||
                supervisorBase.dependencia_legado ||
                'Dependencia no encontrada',
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
      // El 404 de un contrato sin supervisores no se convierte en 500.
      if (error instanceof NotFoundException) {
        throw error;
      }
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
