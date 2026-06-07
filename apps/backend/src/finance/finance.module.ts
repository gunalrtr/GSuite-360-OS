import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { EmiController } from './emi.controller';
import { EmiService } from './emi.service';
import { SipController } from './sip.controller';
import { SipService } from './sip.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ExpensesController,
    BudgetsController,
    EmiController,
    SipController,
  ],
  providers: [
    ExpensesService,
    BudgetsService,
    EmiService,
    SipService,
  ],
  exports: [
    ExpensesService,
    BudgetsService,
    EmiService,
    SipService,
  ],
})
export class FinanceModule {}
