import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { chunk, flatten } from 'lodash';

@Injectable()
export class ContratoGeneralService {
  private readonly logger = new Logger(ContratoGeneralService.name);

  constructor(private configService: ConfigService) {}

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

  private readonly UNIDADES = [
    '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
  ];

  private readonly DECENAS = [
    '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
  ];

  private readonly CENTENAS = [
    '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
  ];

  private convertirGrupo(n: number): string {
    let resultado = '';
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const centenas = Math.floor(n / 100);
    if (centenas > 0) {
      resultado += this.CENTENAS[centenas] + ' ';
    }

    const decenas = n % 100;
    if (decenas > 0) {
      if (decenas < 20) {
        resultado += this.UNIDADES[decenas];
      } else {
        const unidades = decenas % 10;
        const decenasPiso = Math.floor(decenas / 10);
        if (unidades === 0) {
          resultado += this.DECENAS[decenasPiso];
        } else {
          resultado += this.DECENAS[decenasPiso] + ' y ' + this.UNIDADES[unidades].toLowerCase();
        }
      }
    }

    return resultado.trim();
  }

  private numeroATexto(numero: number): string {
    if (numero === 0) return 'cero';
    if (numero < 0) return 'Menos ' + this.numeroATexto(Math.abs(numero));

    let resultado = '';
    let billones = Math.floor(numero / 1000000000000);
    let millones = Math.floor((numero % 1000000000000) / 1000000);
    let miles = Math.floor((numero % 1000000) / 1000);
    let resto = numero % 1000;

    if (billones > 0) {resultado += this.convertirGrupo(billones) + ' billon' + (billones > 1 ? 'es ' : ' ');}
    if (millones > 0) {resultado += this.convertirGrupo(millones) + ' millon' + (millones > 1 ? 'es ' : ' ');}
    if (miles > 0) {resultado += this.convertirGrupo(miles) + ' mil ';}
    if (resto > 0) {resultado += this.convertirGrupo(resto);}

    return resultado.trim();
  }

  async consultarInfoContrato(id: number): Promise<any> {
    const endpoint: string = this.configService.get<string>(
      'ENDP_GESTION_CONTRACTUAL_CRUD',
    );
    const url = `${endpoint}contratos-generales/${id}`;

    try {
      const response = await axios.get(url);

      if (!response.data || !response.data.Data) {
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
          `Detalles del error de Axios: ${JSON.stringify(error.response?.data)}`,
        );
      }
      throw new InternalServerErrorException(
        `Error al consultar el contrato: ${error.message}`,
      );
    } finally {
      this.logger.log(`Finalizada la consulta para el contrato ${id}`);
    }
  }

  async getContratoTransformed(id: number): Promise<any> {
    try {
      const contratoRaw = await this.consultarInfoContrato(id);
      console.log(this.numeroATexto(35740150));
      console.log('Contrato raw:', contratoRaw);
      const contratoTransformado = await this.transformarContrato(contratoRaw);
      console.log('Contrato transformado:', contratoTransformado);
      return contratoTransformado;
    } catch (error) {
      this.logger.error(
        `Error en getContratoTransformed para ID ${id}:`,
        error,
      );
      throw error;
    }
  }

  private async obtenerValorTransformado(
    tipoParametroId: number,
    valorId: number,
  ): Promise<string> {
    const endpoint = this.configService.get<string>('ENDP_PARAMETROS_CRUD');
    const url = `${endpoint}parametro?query=TipoParametroId:${tipoParametroId}&limit=0`;

    try {
      const response = await axios.get(url);

      if (response.data.Status !== '200' || !response.data.Data) {
        throw new Error('Respuesta inválida del servidor de parámetros');
      }

      const parametro = response.data.Data.find((item) => item.Id === valorId);
      if (parametro) {
        return parametro.Nombre;
      } else {
        throw new Error(`Parámetro no encontrado (ID: ${valorId})`);
      }
    } catch (error) {
      this.logger.error(
        `Error al obtener valor transformado: ${error.message}`,
      );
      throw error;
    }
  }

  private async transformarContrato(contratoRaw: any): Promise<any> {
    const camposATransformar = Object.entries(this.parameterMap).filter(
      ([key]) => contratoRaw[key] !== null && contratoRaw[key] !== undefined,
    );

    const chunks = chunk(camposATransformar, 2);

    const resultadosTransformados = await Promise.all(
      chunks.map(async (chunk) => {
        const transformaciones = chunk.map(async ([key, tipoParametroId]) => {
          try {
            const valorTransformado = await this.obtenerValorTransformado(
              tipoParametroId,
              contratoRaw[key],
            );
            return { key, valor: valorTransformado };
          } catch (error) {
            this.logger.warn(`Error al transformar ${key}: ${error.message}`);
            return Promise.resolve(null);
          }
        });
        return Promise.all(transformaciones);
      }),
    );

    console.log(resultadosTransformados);
    if (
      resultadosTransformados.some((subArr) =>
        subArr.some((item) => item == null),
      )
    ) {
      throw new Error('Valores obtenidos de parámetros no válidos');
    }

    const contratoTransformado = { ...contratoRaw };
    flatten(resultadosTransformados).forEach(({ key, valor }) => {
      contratoTransformado[key] = valor;
    });

    if (contratoTransformado.valorPesos) {
      contratoTransformado.valorPesosTexto = this.numeroATexto(contratoTransformado.valorPesos) + ' Pesos';
      console.log(contratoTransformado.valorPesosTexto);
    }

    return contratoTransformado;
  }
}
