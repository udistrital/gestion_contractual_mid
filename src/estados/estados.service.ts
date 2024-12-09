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
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';

interface ParametroResponse {
  Status: string;
  Data: Array<{
    Id: number;
    Nombre: string;
    [key: string]: any;
  }>;
}

interface DataResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class EstadosService {
  private readonly logger = new Logger(EstadosService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly parametrosAxiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD'),
      timeout: 5000,
    });

    this.parametrosAxiosInstance = axios.create({
      baseURL: this.configService.get<string>('ENDP_PARAMETROS_CRUD'),
      timeout: 5000,
    });
  }

  private readonly parameterMap = {
    estadoContratoId: 137,
  } as const;

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

  private async obtenerParametrosPorTipo(
    tipoParametroId: number,
  ): Promise<Map<number, string>> {
    try {
      const response = await this.fetchWithRetry(() =>
        this.parametrosAxiosInstance.get<ParametroResponse>(
          `parametro?query=TipoParametroId:${tipoParametroId}&limit=0`,
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
        `Error al obtener parámetros tipo ${tipoParametroId}: ${error.message}`,
      );
      throw error;
    }
  }

  private async cargarCacheParametros(): Promise<
    Map<number, Map<number, string>>
  > {
    const tiposParametros = new Set(Object.values(this.parameterMap));
    const cacheParametros = new Map<number, Map<number, string>>();

    await Promise.all(
      Array.from(tiposParametros).map(async (tipoParametroId) => {
        const parametros = await this.obtenerParametrosPorTipo(tipoParametroId);
        cacheParametros.set(tipoParametroId, parametros);
      }),
    );

    return cacheParametros;
  }

  private async transformarContratos(
    contratos: any[],
    cacheParametros: Map<number, Map<number, string>>,
  ): Promise<any[]> {
    const contratosNormales = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado = { ...contratoRaw };

        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] != null) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[key] = parametrosMap.get(contratoRaw[key]);
            }
          }
        });

        if (contratoTransformado.estados) {
          const estadoParametroMap = cacheParametros.get(this.parameterMap.estadoContratoId);
          if (estadoParametroMap && contratoTransformado.estados.estado_parametro_id != null) {
            contratoTransformado.estados.estado_parametro_id =
              estadoParametroMap.get(contratoTransformado.estados.estado_parametro_id) ||
              contratoTransformado.estados.estado_parametro_id;
          }
        }

        // Agregar nombre de usuario
        const usuarioId = contratoRaw.estados?.usuario_id ?? 'Desconocido';

        if (usuarioId !== 'Desconocido') {
          const usuario = await this.consultarUsuario(usuarioId);
          contratoTransformado.estados.nombre_usuario = usuario.NombreCompleto;
        }

        return contratoTransformado;
      }),
    );

    return contratosNormales;
  }
  
  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const baseUrl = 'contratos-generales';
      const fields = 'estados';
      const include = 'estados';
      const queryBase = { "estados.actual": true };
      const queryFilter = queryParams.queryFilter ? JSON.parse(`{${queryParams.queryFilter}}`) : {};

      const query = { ...queryBase, ...queryFilter };

      const params = {
        fields,
        query: JSON.stringify(query),
        include,
        limit: queryParams.limit,
        offset: queryParams.offset,
      };

      const response = await this.fetchWithRetry(() =>
        this.axiosInstance.get<PaginatedResponse<any>>(baseUrl, { params })
      );



      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25; // Reducido de 50 a 25 por las llamadas adicionales
      const batches = chunk(response.data.Data, BATCH_SIZE);

      const results = await Promise.all(
        batches.map((batch) =>
          this.transformarContratos(batch, cacheParametros),
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
    } catch (error) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  private async consultarUsuario(id: number): Promise<UsuarioResponse> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_TERCEROS_CRUD');
      const url = `${endpoint}tercero/${id}`;
      const { data } = await axios.get<UsuarioResponse>(url);
      return data;
    } catch (error) {
      return null;
    }
  }
}
