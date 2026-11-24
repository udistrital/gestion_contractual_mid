import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

const VIGENCIA_ID_INVALIDA = 'vigencia-id debe ser un entero positivo';

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
  @IsInt({ message: VIGENCIA_ID_INVALIDA })
  @Min(1, { message: VIGENCIA_ID_INVALIDA })
  vigenciaId?: number;
}
