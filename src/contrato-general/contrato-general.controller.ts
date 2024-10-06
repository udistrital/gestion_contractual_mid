import {
  Controller,
  Get,
  ValidationPipe,
  Query,
  HttpStatus,
  HttpException, Logger, Param
} from '@nestjs/common';
import { ContratoGeneralService } from './contrato-general.service';
import {ApiOperation, ApiParam, ApiQuery, ApiResponse} from "@nestjs/swagger";
import {ParametrosConsultarContratoDto} from "./dto/params.dto";

@Controller('contratos-generales')
export class ContratoGeneralController {

  private readonly logger = new Logger(ContratoGeneralController.name);

  constructor(private readonly contratoGeneralService: ContratoGeneralService) {}

  @Get(':id')
  @ApiOperation({
    summary:
        'Retorna información de contrato-general por ID.',
  })
  @ApiResponse({ status: 200, description: 'Retorna detalle de un contrato-general.' })
  @ApiResponse({ status: 400, description: 'Error en la solicitud.' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del contrato general',
  })
  async consultarInfoContrato(@Param(ValidationPipe) param: ParametrosConsultarContratoDto): Promise<StandardResponse<any>> {
    try {
      const result = await this.contratoGeneralService.getContratoTransformed(+param.id);
      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Contrato consultado exitosamente',
        Data: result,
      };
    } catch (error) {
      this.logger.error(`Error en consultarInfoContrato: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw new HttpException({
          Success: false,
          Status: HttpStatus.NOT_FOUND,
          Message: error.message,
          Data: null,
        }, HttpStatus.NOT_FOUND);
      }
      throw new HttpException({
        Success: false,
        Status: HttpStatus.INTERNAL_SERVER_ERROR,
        Message: 'Error interno del servidor',
        Data: null,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
