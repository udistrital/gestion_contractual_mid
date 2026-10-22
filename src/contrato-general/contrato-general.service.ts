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
  ContratoResponse,
  ParametroBase,
} from '../interfaces/responses.interface';
import { BaseQueryParamsDto } from '../utils/query-params.base.dto';
import { datos } from './conf';
import { ParametroService } from 'src/parametro/parametro.service';

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);
  private readonly gestionContractualCrud: AxiosInstance;

  constructor(
    private configService: ConfigService,
    private readonly parametrosCrud: ParametroService
  ) {
    this.gestionContractualCrud = this.createAxiosInstance(
      'ENDP_GESTION_CONTRACTUAL_CRUD',
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

  private readonly parameterMap = {
    tipo_compromiso_id: 111,
    tipo_contrato_id: 112,
    perfil_contratista_id: 113,
    tipologia_especifica_id: 114,
    modalidad_seleccion_id: 115,
    regimen_contratacion_id: 116,
    procedimiento_id: 117,
    clase_contratista_id: 120,
    tipo_moneda_id: 122,
    tipo_gasto_Id: 123,
    origen_recursos_id: 124,
    origen_presupuestos_id: 125,
    tema_gasto_inversion_id: 126,
    medio_pogo_id: 127,
    unidad_ejecutora_id: 146,
    estado_contrato_id: 137,
    tipo_persona_id: 132,
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
        this.gestionContractualCrud.get<ContratoResponse>(
          `contratos-generales/${id}`,
        ),
      );

      if (!response.data?.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(
          `Contrato general con ID ${id} no encontrado o respuesta inválida`,
        );
      }

      return response.data.Data;
    } catch (error: any) {
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

  private async cargarCacheParametros(): Promise<
    Map<number, Map<number, ParametroBase>>
  > {
    const tipoParametroId = new Array(Object.values(this.parameterMap))[0];
    
    const tipoParametroIds = tipoParametroId.map(t => t.toString())
    
    const parametros = await this.parametrosCrud.getParametrosIndexados(tipoParametroIds);

    return parametros;
  }

  private async transformarContratos(
    contratos: any[],
    cacheParametros: Map<number, Map<number, ParametroBase>>,
    ids: boolean = false,
  ): Promise<any[]> {
    const contratosNormales = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado = { ...contratoRaw };

        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] !== undefined && key.endsWith('_id')) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            const newKey = key.replace('_id', '');

            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[ids ? newKey : key] = parametrosMap.get(
                contratoRaw[key],
              ).Nombre;
            }
          }
        });

        if (contratoTransformado.estados) {
          const estadoParametroMap = cacheParametros.get(
            this.parameterMap.estado_contrato_id,
          );
          if (
            estadoParametroMap &&
            contratoTransformado.estados.estado_parametro_id !== null
          ) {
            ids
              ? contratoTransformado.estados.estado_parametro
              : (contratoTransformado.estados.estado_parametro_id =
                  estadoParametroMap.get(
                    contratoTransformado.estados.estado_parametro_id,
                  ).Nombre || contratoTransformado.estados.estado_parametro_id);
          }
        }

        if (contratoTransformado.contratista) {
          const tipoPersonaMap = cacheParametros.get(
            this.parameterMap.tipo_persona_id,
          );
          if (
            tipoPersonaMap &&
            contratoTransformado.contratista.tipo_persona_id !== null
          ) {
            ids
              ? contratoTransformado.contratista.tipo_persona
              : (contratoTransformado.contratista.tipo_persona_id =
                  tipoPersonaMap.get(
                    contratoTransformado.contratista.tipo_persona_id,
                  ).Nombre || contratoTransformado.contratista.tipo_persona_id);
          }
        }

        // Agregar contratista
        const numeroDocumento =
          contratoRaw.contratista?.numero_documento ?? 'Desconocido';

        if (numeroDocumento !== 'Desconocido') {
          const contratistaNombre =
            await this.consultarProveedor(numeroDocumento);
          contratoTransformado.contratista.nombre = contratistaNombre;
        }

        return contratoTransformado;
      }),
    );

    return contratosNormales;
  }

  private async transformarContratosConIdSeparados(
    contratos: any[],
    cacheParametros: Map<number, Map<number, ParametroBase>>,
  ): Promise<any[]> {
    const contratosNormales = await Promise.all(
      contratos.map(async (contratoRaw) => {
        const contratoTransformado: any = {
          id: contratoRaw.id,
        };

        Object.entries(this.parameterMap).forEach(([key, tipoParametroId]) => {
          if (contratoRaw[key] !== undefined) {
            const parametrosMap = cacheParametros.get(tipoParametroId);
            if (parametrosMap && parametrosMap.has(contratoRaw[key])) {
              contratoTransformado[key] = contratoRaw[key];
              contratoTransformado[key.replace('_id', '')] = parametrosMap.get(
                contratoRaw[key],
              ).Nombre;
            }
          }
        });

        ['vigencia', 'fecha_creacion', 'fecha_modificacion'].forEach(
          (campo) => {
            if (contratoRaw[campo] !== undefined) {
              contratoTransformado[campo] = contratoRaw[campo];
            }
          },
        );

        if (contratoRaw.estados) {
          contratoTransformado.estados = {
            id: contratoRaw.estados.id,
            contrato_general_id: contratoRaw.estados.contrato_general_id,
            usuario_id: contratoRaw.estados.usuario_id,
            usuario_rol: contratoRaw.estados.usuario_rol,
          };

          const estadoParametroMap = cacheParametros.get(
            this.parameterMap.estado_contrato_id,
          );
          if (
            estadoParametroMap &&
            contratoRaw.estados.estado_parametro_id != null
          ) {
            contratoTransformado.estados.estado_parametro_id =
              contratoRaw.estados.estado_parametro_id;
            contratoTransformado.estados.estado_parametro =
              estadoParametroMap.get(contratoRaw.estados.estado_parametro_id).Nombre ||
              contratoRaw.estados.estado_parametro_id;
          }

          [
            'estado_interno_parametro_id',
            'motivo',
            'actual',
            'fecha_evento',
            'activo',
            'fecha_creacion',
            'fecha_modificacion',
          ].forEach((campo) => {
            if (contratoRaw.estados[campo] !== undefined) {
              contratoTransformado.estados[campo] = contratoRaw.estados[campo];
            }
          });
        }

        if (contratoRaw.contratista) {
          contratoTransformado.contratista = {
            id: contratoRaw.contratista.id,
            numero_documento: contratoRaw.contratista.numero_documento,
          };

          const tipoPersonaMap = cacheParametros.get(
            this.parameterMap.tipo_persona_id,
          );
          if (
            tipoPersonaMap &&
            contratoRaw.contratista.tipo_persona_id != null
          ) {
            contratoTransformado.contratista.tipo_persona_id =
              contratoRaw.contratista.tipo_persona_id;
            contratoTransformado.contratista.tipo_persona =
              tipoPersonaMap.get(contratoRaw.contratista.tipo_persona_id).Nombre ||
              contratoRaw.contratista.tipo_persona_id;
          }

          if (contratoRaw.contratista.clase_contratista_id) {
            const claseContratistaMap = cacheParametros.get(
              this.parameterMap.clase_contratista_id,
            );
            if (claseContratistaMap) {
              contratoTransformado.contratista.clase_contratista_id =
                contratoRaw.contratista.clase_contratista_id;
              contratoTransformado.contratista.clase_contratista =
                claseContratistaMap.get(
                  contratoRaw.contratista.clase_contratista_id,
                ).Nombre || contratoRaw.contratista.clase_contratista_id;
            }
          }

          [
            'activo',
            'fecha_creacion',
            'fecha_modificacion',
            'contrato_general_id',
          ].forEach((campo) => {
            if (contratoRaw.contratista[campo] !== undefined) {
              contratoTransformado.contratista[campo] =
                contratoRaw.contratista[campo];
            }
          });

          const numeroDocumento =
            contratoRaw.contratista.numero_documento ?? 'Desconocido';
          if (numeroDocumento !== 'Desconocido') {
            contratoTransformado.contratista.nombre =
              await this.consultarProveedor(numeroDocumento);
          } else {
            contratoTransformado.contratista.nombre = null;
          }
        }

        return contratoTransformado;
      }),
    );

    return contratosNormales;
  }

  async getAllWithIds(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const baseUrl = 'contratos-generales';
      const fields = 'vigencia,tipo_contrato_id,contratista,estados';
      const include = 'estados,contratista';
      const queryBase = { 'estados.actual': true };
      const queryFilter = queryParams.queryFilter
        ? JSON.parse(`{${queryParams.queryFilter}}`)
        : {};

      const query = { ...queryBase, ...queryFilter };

      const params = {
        fields,
        query: JSON.stringify(query),
        include,
        limit: queryParams.limit ?? 10,
        offset: queryParams.offset ?? 0,
      };

      const url = `${baseUrl}?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`;

      this.logger.log(`Consultando contratos generales en ${url}`);

      const response = await this.fetchWithRetry(() =>
        this.gestionContractualCrud.get<PaginatedResponse<any>>(baseUrl, {
          params,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25;
      const batches = chunk(response.data.Data, BATCH_SIZE);

      const results = await Promise.all(
        batches.map((batch) =>
          this.transformarContratosConIdSeparados(batch, cacheParametros),
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
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  async getAll(
    queryParams: BaseQueryParamsDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const baseUrl = 'contratos-generales';
      const fields = 'vigencia,tipo_contrato_id,contratista,estados';
      const include = 'estados,contratista';
      const queryBase = { 'estados.actual': true };
      const queryFilter = queryParams.queryFilter
        ? JSON.parse(`{${queryParams.queryFilter}}`)
        : {};

      const query = { ...queryBase, ...queryFilter };

      const params = {
        fields,
        query: JSON.stringify(query),
        include,
        limit: queryParams.limit ?? 10,
        offset: queryParams.offset ?? 0,
      };

      const url = `${baseUrl}?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`;

      this.logger.log(`Consultando contratos generales en ${url}`);

      const response = await this.fetchWithRetry(() =>
        this.gestionContractualCrud.get<PaginatedResponse<any>>(baseUrl, {
          params,
        }),
      );

      if (!response.data?.Data) {
        this.logger.warn('Respuesta inválida al consultar contratos generales');
        throw new NotFoundException('Contratos generales no encontrados');
      }

      const cacheParametros = await this.cargarCacheParametros();

      const BATCH_SIZE = 25;
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
    } catch (error: any) {
      this.logger.error('Error en getAll:', error);
      throw new InternalServerErrorException(
        `Error al consultar contratos generales: ${error.message}`,
      );
    }
  }

  async getContratoTransformed(id: number, ids: boolean = false): Promise<any> {
    console.log(typeof ids, ids);

    this.logger.log(`Consultando contrato transformado para ID ${id}`);
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      const cacheParametros = await this.cargarCacheParametros();
      const [contratoTransformado] = await this.transformarContratos(
        [contratoRaw],
        cacheParametros,
        ids,
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
      const endpoint: string = this.configService.get<string>(
        'ENDP_PROVEEDORES_MID',
      );
      if (!endpoint) {
        this.logger.error('No se ha configurado el endpoint de proveedores');
        throw new Error('No se ha configurado el endpoint de proveedores');
      }
      const url = `${endpoint}contratistas?id=${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data.proveedor.nombre_completo_proveedor;
    } catch (error) {
      console.error('Error en consultarProveedor:', error);
      return null;
    }
  }

  // Información de contratos generales por unidad y vigencia
  async obtenerConteo(body: any, endpoint: string): Promise<any> {
    try {
      const urlGestionContractualCrud: string = this.configService.get<string>(
        'ENDP_GESTION_CONTRACTUAL_CRUD',
      );

      const url = `${urlGestionContractualCrud}contratos-generales/${endpoint}/`;
      const { data } = await axios.post<any>(url, body);

      if (!data.Success || data.Status != '200') {
        return null;
      }

      return data.Data;
    } catch (error) {
      return null;
    }
  }

  async generarConsecutivo(body: any) {
    try {
      const { unidad_ejecutora_id } = body;
      if (!unidad_ejecutora_id) {
        throw new Error(`El campo unidad_ejecutora_id es requerido`);
      }

      let conteo = await this.obtenerConteo(body, 'conteo-consecutivo');
      if (!Number.isInteger(conteo) || conteo < 0) {
        throw new Error('Error al obtener el conteo de los contratos');
      }

      const numeroContrato = conteo + 1;
      return numeroContrato.toString();
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Error al generar consecutivo del contrato: ${error.message}`,
      );
    }
  }

  async generarNumeroContrato(body: any) {
    try {
      const { unidad_ejecutora_id, vigencia, estado } = body;
      if (!unidad_ejecutora_id) {
        throw new Error(`El campo unidad_ejecutora_id es requerido`);
      }
      if (!vigencia) {
        throw new Error('El campo vigencia es requerido');
      }
      if (!estado) {
        throw new Error('El campo estado es requerido');
      }

      const { prefijo, sufijo } = datos[unidad_ejecutora_id];
      if (prefijo == null || sufijo == null) {
        throw new Error('Unidad ejecutora invalida');
      }

      let conteo = await this.obtenerConteo(body, 'conteo-numero-contrato');
      if (!Number.isInteger(conteo) || conteo < 0) {
        throw new Error('Error al obtener el conteo de los contratos');
      }

      const numeroContrato = prefijo + (conteo + 1) + sufijo;
      return numeroContrato;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Error al generar número de contrato: ${error.message}`,
      );
    }
  }
}
