import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// En la URL el parámetro se llama vigencia-id (guion, nunca guion bajo).
export class ContratosTableroQueryDto {
  @ApiPropertyOptional({
    name: 'vigencia-id',
    description:
      'Id del parámetro de vigencia (contrato_general.vigencia_id); sin él trae todas las vigencias',
    example: 6900,
  })
  @Expose({ name: 'vigencia-id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'vigencia-id debe ser un número entero' })
  @Min(1, { message: 'vigencia-id debe ser mayor o igual a 1' })
  vigenciaId?: number;
}
