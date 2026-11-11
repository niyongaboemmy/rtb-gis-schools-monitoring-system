import { Module } from '@nestjs/common';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient } from './tdmp-api.client';
import { TdmpOAuthClient } from './tdmp-oauth.client';
import { TdmpSchoolSource } from './tdmp-school.source';

/**
 * TDMP connection only: settings, the data API client, the OAuth client and
 * the school reader.
 * No routes and no dependencies on other modules, so both AuthModule (sign-in)
 * and the school modules (sync, staff) can import it.
 */
@Module({
  providers: [TdmpConfig, TdmpApiClient, TdmpOAuthClient, TdmpSchoolSource],
  exports: [TdmpConfig, TdmpApiClient, TdmpOAuthClient, TdmpSchoolSource],
})
export class TdmpModule {}
