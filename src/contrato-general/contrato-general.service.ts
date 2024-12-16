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
  EstadoContratoResponse,
  PaginatedResponse,
  ResponseMetadata,
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

interface ContratoResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);
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
    tipoCompromisoId: 111,
    tipoContratoId: 112,
    perfilContratistaId: 113,
    tipologiaEspecificaId: 114,
    modalidadSeleccionId: 115,
    regimenContratacionId: 116,
    procedimientoId: 117,
    claseContratistaId: 120,
    tipoMonedaId: 122,
    tipoGastoId: 123,
    origenRecursosId: 124,
    origenPresupuestosId: 125,
    temaGastoInversionId: 126,
    medioPogoId: 127,
    unidadEjecutoraId: 7,
    estadoContratoId: 137,
    tipoPersonaId: 132,
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

        if (contratoTransformado.contratista) {
          const tipoPersonaMap = cacheParametros.get(this.parameterMap.tipoPersonaId);
          if (tipoPersonaMap && contratoTransformado.contratista.tipo_persona_id != null) {
            contratoTransformado.contratista.tipo_persona_id =
              tipoPersonaMap.get(contratoTransformado.contratista.tipo_persona_id) ||
              contratoTransformado.contratista.tipo_persona_id;
          }
        }

        // Agregar contratista
        const numeroDocumento = contratoRaw.contratista?.numero_documento ?? 'Desconocido';

        if (numeroDocumento !== 'Desconocido') {
          const contratistaNombre = await this.consultarProveedor(numeroDocumento);
          contratoTransformado.contratista.nombre = contratistaNombre;
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
      const fields = 'vigencia,tipoContratoId,contratista,estados';
      const include = 'estados,contratista';
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

      const url = `${baseUrl}?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;

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

  async getContratoTransformed(id: number): Promise<any> {
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      const cacheParametros = await this.cargarCacheParametros();
      const [contratoTransformado] = await this.transformarContratos(
        [contratoRaw],
        cacheParametros,
      );
      return contratoTransformado;
    } catch (error) {
      this.logger.error(
        `Error en getContratoTransformed para ID ${id}:`,
        error,
      );
      throw error;
    }
  }

  private async consultarProveedor(id: number): Promise<string | null> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_PROVEEDORES_MID');
      const url = `${endpoint}contratistas?id=${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data.proveedor.nombre_completo_proveedor;
    } catch (error) {
      return null;
    }
  }
}
