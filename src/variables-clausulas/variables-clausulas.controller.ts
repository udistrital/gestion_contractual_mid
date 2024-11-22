import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpStatus, HttpException } from '@nestjs/common';
import { VariablesClausulasService } from './variables-clausulas.service';
import { CreateVariablesClausulaDto } from './dto/create-variables-clausula.dto';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { StandardResponse } from 'src/interfaces/responses.interface';


@Controller('variables-clausulas')
export class VariablesClausulasController {
  constructor(private readonly variablesClausulasService: VariablesClausulasService) {}

  @Get('')
  @ApiOperation({ summary: 'Consulta las variables del Contrato para las clausulas' })
  @ApiResponse({
    status: 200,
    description: 'Contrato encontrado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta' })
  @ApiResponse({ status: 404, description: 'Contrato no encontrado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async encontrarContratista(
    @Query('id') id: string,
  ): Promise<StandardResponse<any>> {
    if (!id) {
      return Promise.resolve({
        Success: false,
        Status: HttpStatus.BAD_REQUEST,
        Message: 'El id es requerido',
      });
    }
    const result = await this.variablesClausulasService.dataVaribles(id);

    if (!result.Success) {
      throw new HttpException(
        {
          Success: false,
          Status: result.Status,
          Message: result.Message,
        },
        result.Status,
      );
    }
    return result;
  }
  
}
