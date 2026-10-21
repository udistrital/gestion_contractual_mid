import { Controller, Delete, Get, HttpStatus, Param, Query, ValidationPipe } from "@nestjs/common";
import { ParametroService } from "./parametro.service";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";

@Controller('parametros')
export class ParametrosController {

  constructor(
    private readonly parametrosService: ParametroService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna los parámetros de los tipos indicados por ls IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna los listados de parámetros solicitados.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({
    name: 'ids',
    type: 'string',
    description: 'ID del/los tipo(s) de parámetro(s) solicitado(s) separados por coma',
  })
  async obtenerParametrosPorTipo(
    @Query('ids') ids: string,
  ) {
    try {
      const arregloIds = ids.split(',');
  
      const result = await this.parametrosService.getParametrosPorTipoId(arregloIds)
  
      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Parametros consultados exitosamente',
        Data: result,
      };
    } catch(error: any) {
      console.log(error)
      return {
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al consultar el Caché de parametros',
        Data: error
      };
    }
  }

  @Delete()
  @ApiOperation({
    summary: 'Limpia la memoria caché de los tipos de parámetro.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna el estado final de la solicitud.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  async limpiarCacheParametros() {
    try {
      this.parametrosService.limpiarCache()
      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Caché de parametros limpiado exitosamente',
      };
    } catch (error) {
      return {
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error al limpiar el Caché de parametros',
        Data: error
      };
    }
  }
}