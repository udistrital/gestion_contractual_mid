import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ContratosTableroQueryDto {
  @ApiPropertyOptional({
    description:
      'Id del parámetro de vigencia (contrato_general.vigencia_id); sin él trae todas las vigencias',
    example: 6900,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vigencia_id?: number;
}
