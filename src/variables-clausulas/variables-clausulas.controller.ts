import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VariablesClausulasService } from './variables-clausulas.service';
import { CreateVariablesClausulaDto } from './dto/create-variables-clausula.dto';


@Controller('variables-clausulas')
export class VariablesClausulasController {
  constructor(private readonly variablesClausulasService: VariablesClausulasService) {}

  @Post()
  create(@Body() createVariablesClausulaDto: CreateVariablesClausulaDto) {
    return this.variablesClausulasService.create(createVariablesClausulaDto);
  }

  @Get()
  findAll() {
    return this.variablesClausulasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.variablesClausulasService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.variablesClausulasService.remove(+id);
  }
}
