import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { ActionStatus } from '../entities/recommendation-action.entity';

export const ACTION_STATUSES: ActionStatus[] = ['open', 'in_progress', 'done'];

export class CreateRecommendationActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  recommendation: string;
}

export class UpdateRecommendationActionDto {
  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: ActionStatus;

  /** Free-text assignee (name or role); null clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  assignedTo?: string | null;

  /** ISO date (YYYY-MM-DD); null clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueDate?: string | null;
}
