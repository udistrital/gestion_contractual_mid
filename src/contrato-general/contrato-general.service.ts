import {Injectable, Logger, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { chunk, flatten } from 'lodash';

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);

  constructor(
      private configService: ConfigService,
  ) {
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
  };

  async consultarInfoContrato(id: number): Promise<any> {
    const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
    const url = `${endpoint}contratos-generales/${id}`;

    try {
      const response = await axios.get(url);

      if (!response.data || !response.data.Data) {
        this.logger.warn(`Respuesta inválida para el contrato ${id}`);
        throw new NotFoundException(`Contrato general con ID ${id} no encontrado o respuesta inválida`);
      }

      return response.data.Data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundException(`Contrato general con ID ${id} no encontrado`);
        }
        this.logger.error(`Detalles del error de Axios: ${JSON.stringify(error.response?.data)}`);
      }
      throw new InternalServerErrorException(`Error al consultar el contrato: ${error.message}`);
    } finally {
      this.logger.log(`Finalizada la consulta para el contrato ${id}`);
    }
  }


  async getContratoTransformed(id: number): Promise<any> {
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      console.log('Contrato raw:', contratoRaw);
      const contratoTransformado = await this.transformarContrato(contratoRaw);
        console.log('Contrato transformado:', contratoTransformado);
      return contratoTransformado;
    } catch (error) {
      this.logger.error(`Error en getContratoTransformed para ID ${id}:`, error);
      throw error;
    }
  }

  private async obtenerValorTransformado(tipoParametroId: number, valorId: number): Promise<string> {
    const endpoint = this.configService.get<string>('ENDP_PARAMETROS_CRUD');
    const url = `${endpoint}parametro?query=TipoParametroId:${tipoParametroId}&limit=0`;

    try {
      const response = await axios.get(url);

      if (response.data.Status !== "200" || !response.data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }

      const parametro = response.data.Data.find(item => item.Id === valorId);
      if (parametro) {
        return parametro.Nombre;
      } else {
        throw new Error(`Parámetro no encontrado (ID: ${valorId})`);
      }
    } catch (error) {
      this.logger.error(`Error al obtener valor transformado: ${error.message}`);
      throw error;
    }
  }

  private async transformarContrato(contratoRaw: any): Promise<any> {

    const camposATransformar = Object.entries(this.parameterMap)
        .filter(([key]) => contratoRaw[key] !== null && contratoRaw[key] !== undefined);

    const chunks = chunk(camposATransformar, 2);

    const resultadosTransformados = await Promise.all(
        chunks.map(async (chunk) => {
          const transformaciones = chunk.map(async ([key, tipoParametroId]) => {
            try {
              const valorTransformado = await this.obtenerValorTransformado(tipoParametroId, contratoRaw[key]);
              return {key, valor: valorTransformado};
            } catch (error) {
              this.logger.warn(`Error al transformar ${key}: ${error.message}`);
              return Promise.resolve(null);
            }
          });
          return Promise.all(transformaciones);
        })
    );

    console.log(resultadosTransformados)
    if (resultadosTransformados.some(subArr => subArr.some(item => item == null))) {
      throw new Error("Valores obtenidos de parámetros no válidos");
    }

    const contratoTransformado = {...contratoRaw};
    flatten(resultadosTransformados).forEach(({key, valor}) => {
      contratoTransformado[key] = valor;
    });

    return contratoTransformado;
  }
}