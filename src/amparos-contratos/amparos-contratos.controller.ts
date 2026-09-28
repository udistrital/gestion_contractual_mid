import {
  Controller,
  Get,
  Param,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { AmparosContratosService } from './amparos-contratos.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardResponse } from '../interfaces/responses.interface';

@ApiTags('amparos-contratos')
@Controller('amparos-contratos')
export class AmparosContratosController {
  private readonly logger = new Logger(AmparosContratosController.name);

  constructor(
    private readonly amparosContratosService: AmparosContratosService,
  ) {}

  @Get(':contratoId')
  @ApiOperation({ summary: 'Obtener amparos por ID de contrato' })
  @ApiParam({
    name: 'contratoId',
    type: 'number',
    description: 'ID del contrato',
  })
  @ApiResponse({
    status: 200,
    description: 'Amparos encontrados con éxito',
  })
  @ApiResponse({ status: 404, description: 'Amparos no encontrados' })
  async getAmparosByContratoId(
    @Param('contratoId') contratoId: string,
  ): Promise<StandardResponse<any[]>> {
    try {
      const result = await this.amparosContratosService.getAmparosByContratoId(
        +contratoId,
      );

      return {
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Amparos de pólizas encontrados',
        Data: result,
      };
    } catch (error) {
      this.logger.error(
        `Error en getAmparosByContratoId: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          Success: false,
          Status: HttpStatus.INTERNAL_SERVER_ERROR,
          Message: 'Error al consultar los amparos',
          Data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
