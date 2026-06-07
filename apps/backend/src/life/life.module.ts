import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [PrismaModule],
  controllers: [JourneysController, PurchasesController],
  providers: [JourneysService, PurchasesService],
  exports: [JourneysService, PurchasesService],
})
export class LifeModule {}
