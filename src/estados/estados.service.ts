import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { chunk, flatten } from 'lodash';
import {
  PaginatedResponse,
  ResponseMetadata,
  UsuarioResponse,
  ParametroBase,
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { ParametroService } from '../parametro/parametro.service';
import { createAxiosInstance, fetchWithRetry } from 'src/utils/axios-utils';

@Injectable()
export class EstadosService {
  private readonly logger = new Logger(EstadosService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly idsTipoParametro = {
    estadosGenerales: 137,
    estadosInternos: 141,
  } as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly parametroService: ParametroService,
  ) {
    this.axiosInstance = createAxiosInstance(
      this.configService,
      'ENDP_GESTION_CONTRACTUAL_CRUD',
    );
  }

  private async obtenerEstadosPorTipoParametro(): Promise<
    Map<number, Map<number, ParametroBase>>
  > {
    return this.parametroService.getParametrosIndexados(
      Object.values(this.idsTipoParametro).map(String),
    );
  }

  private async transformarEstados(
    estados: any[],
    estadosPorTipoParametro: Map<number, Map<number, ParametroBase>>,
  ): Promise<any[]> {
    return await Promise.all(
      estados.map(async (estado) => {
        const estadoTransformado = { ...estado };

        const estadosGenerales = estadosPorTipoParametro.get(
          this.idsTipoParametro.estadosGenerales,
        );
        if (
          estadosGenerales &&
          estadoTransformado.estado_parametro_id != null
        ) {
          estadoTransformado.estado_parametro_id =
            estadosGenerales.get(estadoTransformado.estado_parametro_id)
              ?.Nombre ?? estadoTransformado.estado_parametro_id;
        }

        const estadosInternos = estadosPorTipoParametro.get(
          this.idsTipoParametro.estadosInternos,
        );
        if (
          estadosInternos &&
          estadoTransformado.estado_interno_parametro_id != null
        ) {
          estadoTransformado.estado_interno_parametro_id =
            estadosInternos.get(estadoTransformado.estado_interno_parametro_id)
              ?.Nombre ?? estadoTransformado.estado_interno_parametro_id;
        }

        // Agregar nombre de usuario
        const usuarioId = estado?.usuario_id ?? null;
        if (usuarioId !== null) {
          const usuario = await this.consultarUsuario(usuarioId);
          if (!usuario) {
            this.logger.error('Error al consultar el usuario:', usuarioId);
            throw new Error('Error al consultar el terceros CRUD');
          }
          estadoTransformado.nombre_usuario = usuario.NombreCompleto;
        }
        return estadoTransformado;
      }),
    );
  }

  private async consultarUsuario(id: number): Promise<UsuarioResponse> {
    try {
      const endpoint: string =
        this.configService.get<string>('ENDP_TERCEROS_CRUD');

      if (!endpoint) {
        this.logger.error('No se encontró la URL del servicio de terceros');
        throw new Error('No se encontró la URL del servicio de terceros');
      }

      const { data } = await axios.get<UsuarioResponse>(
        `${endpoint}tercero/${id}`,
      );
      return data;
    } catch (error) {
      this.logger.error('Error al consultar el usuario:', error);
      return null;
    }
  }

  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const queryFilter = queryParams.queryFilter
        ? JSON.parse(`{${queryParams.queryFilter}}`)
        : {};
      const params = {
        sortBy: queryParams.sortBy,
        orderBy: queryParams.orderBy,
        limit: queryParams.limit,
        offset: queryParams.offset,
        query: JSON.stringify({ ...queryFilter }),
      };

      const response = await fetchWithRetry(() =>
        this.axiosInstance.get<PaginatedResponse<any>>('estados-contrato', {
          params,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn(
          'Respuesta inválida al consultar los estados de los contratos',
        );
        throw new NotFoundException('Estados de los contratos no encontrados');
      }

      const estadosPorTipoParametro =
        await this.obtenerEstadosPorTipoParametro();

      const BATCH_SIZE = 25; // Reducido de 50 a 25 por las llamadas adicionales
      const batches = chunk(response.data.Data, BATCH_SIZE);
      const results = await Promise.all(
        batches.map((batch) =>
          this.transformarEstados(batch, estadosPorTipoParametro),
        ),
      );

      const metadata: ResponseMetadata = response.data.Metadata || {
        total: response.data.Data.length,
        limit: queryParams.limit || 10,
        offset: queryParams.offset || 0,
        currentPage:
          Math.floor((queryParams.offset || 0) / (queryParams.limit || 10)) + 1,
        totalPages: Math.ceil(
          response.data.Data.length / (queryParams.limit || 10),
        ),
        hasNextPage:
          (queryParams.offset || 0) + (queryParams.limit || 10) <
          response.data.Data.length,
        hasPreviousPage: (queryParams.offset || 0) > 0,
      };

      return {
        Data: flatten(results),
        Metadata: metadata,
      };
    } catch (error: any) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar los estados de los contratos: ${error.message}`,
      );
    }
  }
}
