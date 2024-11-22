import {HttpStatus, Injectable} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { StandardResponse } from 'src/interfaces/responses.interface';

interface ContratoResponse {
  Status: string;
  Data: any;
}

@Injectable()
export class VariablesClausulasService {
  constructor(private configService: ConfigService) {}

  async dataVaribles(id: string): Promise<StandardResponse<any>> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}contratos-generales/${id}`;
      const { data } = await axios.get<ContratoResponse>(url);

      if (data.Data == undefined){
        return {
          Success: false,
          Status: HttpStatus.NOT_FOUND,
          Message: 'Contrato no encontrado',
        };
      }

      const infoContrato = data;
      const cdpInfo = await this.obetenerCDP(id);
      const proveedorInfo = await this.obetenerProveedor(id);
      const lugarEjecucionInfo = await this.obetenerLugarEjecucion(id);

      const combinedData = {
        contrato: infoContrato,
        cdp: cdpInfo,
        proveedor: proveedorInfo,
        lugarEjecucion : lugarEjecucionInfo,
      }

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Variables de contrato encontradas',
        Data: combinedData,
      };
    } catch (error) {
      return {
        Success: false,
        Status: error.response?.status || 500,
        Message: error.message || 'Error al consultar el contrato',
      };
    }
  }

  async obetenerCDP(id: string): Promise<StandardResponse<any>> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}cdp/contrato/${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data[0];
    } catch (error) {
      return null;
    }
  }

  async obetenerLugarEjecucion(id: string): Promise<any> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_GESTION_CONTRACTUAL_CRUD');
      const url = `${endpoint}lugares-ejecucion/contrato/${id}`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data;
    } catch (error) {
      return null;
    }
  }
  

  async obetenerProveedor(id: string): Promise<StandardResponse<any>> {
    try {
      const endpoint: string = this.configService.get<string>('ENDP_PROVEEDORES_MID');
      const url = `${endpoint}contratistas?id=${id}071172124`;
      const { data } = await axios.get<ContratoResponse>(url);
      return data.Data;
    } catch (error) {
      return null;
    }
  }

}
