import { ApiProperty } from '@nestjs/swagger';

export class StandardResponseDto<T> {
  @ApiProperty({
    example: true,
    description: 'Indica si la operación fue exitosa',
  })
  Success: boolean;

  @ApiProperty({
    example: 200,
    description: 'Código de estado HTTP de la respuesta',
  })
  Status: number;

  @ApiProperty({
    example: 'Operación exitosa',
    description: 'Mensaje descriptivo del resultado de la operación',
  })
  Message: string;

  @ApiProperty({
    description: 'Datos retornados por la operación',
    required: false,
  })
  Data?: T;
}
