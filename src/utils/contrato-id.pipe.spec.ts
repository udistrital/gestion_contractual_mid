import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  CONTRATO_ID_MAXIMO,
  ContratoIdPipe,
  MENSAJE_CONTRATO_ID_INVALIDO,
} from './contrato-id.pipe';

describe('ContratoIdPipe', () => {
  const pipe = new ContratoIdPipe();

  it.each([
    ['1', 1],
    ['42', 42],
    [String(CONTRATO_ID_MAXIMO), CONTRATO_ID_MAXIMO],
  ])('acepta %p y devuelve el número %p', (valor, esperado) => {
    expect(pipe.transform(valor)).toBe(esperado);
  });

  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['texto', 'abc'],
    ['decimal', '1.5'],
    ['hexadecimal', '0x10'],
    ['notación científica', '1e3'],
    ['con espacio', ' 1'],
    ['cero', '0'],
    ['negativo', '-1'],
    ['mayor que int4', '2147483648'],
    ['con ceros a la izquierda', '007'],
    ['repetido (arreglo)', ['1', '2']],
  ])('rechaza %s con 400 y el cuerpo estándar', (_caso, valor) => {
    let error: unknown;
    try {
      pipe.transform(valor);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(
      HttpStatus.BAD_REQUEST,
    );
    expect((error as BadRequestException).getResponse()).toEqual({
      Success: false,
      Status: HttpStatus.BAD_REQUEST,
      Message: MENSAJE_CONTRATO_ID_INVALIDO,
      Data: null,
    });
  });
});
