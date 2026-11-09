import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

// El número de contrato no viaja en el cuerpo: lo asigna el MID al pasar a SUSCRITO.
export class RegistrarEstadoContratoDto {
  @ApiProperty({ example: 6774 })
  @IsInt()
  @IsPositive()
  estado_parametro_id: number;

  @ApiProperty({ example: 6802 })
  @IsInt()
  @IsPositive()
  estado_interno_parametro_id: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  usuario_id: number;

  @ApiProperty({ example: 'JEFE_CONTRATACION_RECTOR' })
  @IsString()
  @IsNotEmpty()
  usuario_rol: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}
