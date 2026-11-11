import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StandardResponse } from '../interfaces/responses.interface';
import { ContratosTableroQueryDto } from './dto/tableros.dto';
import { TablerosService } from './tableros.service';

@Controller('tableros')
export class TablerosController {
  constructor(private readonly tablerosService: TablerosService) {}

  @Get('contratos')
  @ApiOperation({
    summary: 'Contratos del tablero de control',
    description:
      'Metadatos de seguimiento por contrato activo: estado general actual, fecha desde la que está en ese estado, fecha final, dependencia solicitante y abogado (solo Ids), desde el CRUD',
  })
  @ApiResponse({
    status: 200,
    description: 'Contratos consultados exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Filtro inválido' })
  @ApiResponse({ status: 500, description: 'Error al consultar el CRUD' })
  async getContratos(@Query() query: ContratosTableroQueryDto) {
    const respuesta: StandardResponse<any[]> = {
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Contratos del tablero consultados exitosamente',
      Data: await this.tablerosService.getContratos(query),
    };
    return respuesta;
  }
}
