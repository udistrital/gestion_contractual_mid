import {
  Controller,
  Get,
  ValidationPipe,
  HttpStatus,
  HttpException,
  Logger,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { StandardResponse } from '../interfaces/responses.interface';
import { ParametrosConsultarContratoDto } from './dto/params.dto';
import { OrdenadoresService } from './ordenadores.service';

@Controller('ordenadores')
export class OrdenadoresController {
  private readonly logger = new Logger(OrdenadoresController.name);

  constructor(private readonly ordenadoresService: OrdenadoresService) {}

  @Get('/contrato/:id')
  @ApiOperation({
    summary: 'Retorna información de Supervisor por ID de contrato.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna detalle de un supervisor.',
  })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del contrato general',
  })
  async consultarInfoOrdenador(
    @Param(ValidationPipe) param: ParametrosConsultarContratoDto,
  ): Promise<StandardResponse<any>> {
    try {
      const result = await this.ordenadoresService.getSupervisorData(+param.id);

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Supervisor para el contrato consultado exitosamente',
        Data: result,
      };
    } catch (error) {
      this.logger.error(
        `Error en consultarInfoSupervisor: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: `Error interno del servidor: ${error.message}`,
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
