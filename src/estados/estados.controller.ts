import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EstadosService } from './estados.service';


@Controller('estados')
export class EstadosController {
  constructor(private readonly estadosService: EstadosService) {}

}
