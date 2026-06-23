import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_DAILY_LIMIT = 30;

@Injectable()
export class ChatRateLimitService {
  private readonly logger = new Logger(ChatRateLimitService.name);
  private readonly dailyLimit: number;

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {
    const env = process.env.CHAT_DAILY_LIMIT;
    const parsed = env ? parseInt(env, 10) : NaN;
    this.dailyLimit =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
  }

  get limit(): number {
    return this.dailyLimit;
  }

  /**
   * Llama al RPC increment_chat_usage, verifica el contador resultante y tira
   * ForbiddenException si excede el limite configurado (CHAT_DAILY_LIMIT).
   */
  async checkAndIncrement(userId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('increment_chat_usage', {
      p_user_id: userId,
    });
    if (error) {
      this.logger.error(`increment_chat_usage failed: ${error.message}`);
      // No bloqueamos al usuario si el RPC falla pero loggeamos.
      return 0;
    }
    const count = typeof data === 'number' ? data : Number(data);
    if (Number.isFinite(count) && count > this.dailyLimit) {
      throw new ForbiddenException(
        `Limite diario de chat alcanzado (${this.dailyLimit}). Vuelve mañana.`,
      );
    }
    return count;
  }
}
