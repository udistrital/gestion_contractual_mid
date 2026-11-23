import { BadRequestException, HttpStatus, PipeTransform } from '@nestjs/common';

// Llave de contrato_general: SERIAL (int4) en el CRUD.
export const CONTRATO_ID_MAXIMO = 2147483647;

export const MENSAJE_CONTRATO_ID_INVALIDO =
  "El parámetro de consulta 'contrato-id' es obligatorio y debe ser un entero entre 1 y 2147483647";

// Lee el parámetro de consulta obligatorio `contrato-id`: entero en base 10,
// sin signo, espacios, decimales ni notación científica o hexadecimal.
export class ContratoIdPipe implements PipeTransform<unknown, number> {
  transform(valor: unknown): number {
    if (
      typeof valor !== 'string' ||
      !/^[1-9]\d{0,9}$/.test(valor) ||
      Number(valor) > CONTRATO_ID_MAXIMO
    ) {
      throw new BadRequestException({
        Success: false,
        Status: HttpStatus.BAD_REQUEST,
        Message: MENSAJE_CONTRATO_ID_INVALIDO,
        Data: null,
      });
    }
    return Number(valor);
  }
}
