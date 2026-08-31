import { Global, Module } from '@nestjs/common';
import { ScopeGuard } from './scope.guard';

/**
 * Makes `ScopeGuard` injectable anywhere. The guard reads through the global
 * TypeORM `DataSource`, so no repository wiring is needed here.
 */
@Global()
@Module({
  providers: [ScopeGuard],
  exports: [ScopeGuard],
})
export class ScopeModule {}
