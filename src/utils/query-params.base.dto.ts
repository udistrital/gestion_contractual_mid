import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class BaseQueryParamsDto {
  @ApiPropertyOptional({
    description: 'Campos a retornar (separados por comas)',
  })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderBy?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Número de registros a retornar',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Número de registros a saltar',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Filtros dinámicos en formato JSON',
  })
  @IsOptional()
  @IsString()
  query?: string;
}
