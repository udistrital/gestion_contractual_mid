import { ApiProperty } from '@nestjs/swagger';

export class SedeResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador único de la sede',
  })
  Id: number;

  @ApiProperty({
    example: 'Sede Principal',
    description: 'Nombre de la sede',
  })
  Nombre: string;
}

export class DependenciaSimpleDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador único de la dependencia',
  })
  id: number;

  @ApiProperty({
    example: 'Facultad de Ingeniería',
    description: 'Nombre de la dependencia',
  })
  nombre: string;
}
