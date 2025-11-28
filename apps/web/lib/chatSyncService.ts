/**
 * 채팅 동기화 서비스
 *
 * IndexedDB ↔ 서버 동기화 관리
 *
 * 기능:
 * - 오프라인 큐 처리
 * - 백그라운드 동기화
 * - 네트워크 복구 시 자동 재시도
 */

import {
  getChatDB,
  Message,
  Conversation,
  getNextSyncItems,
  removeSyncQueueItem,
  updateSyncQueueItem,
  markMessageAsSynced,
  markSyncFailed,
} from './chatDB';

// ===========================
// Types
// ===========================
export interface SyncOptions {
  autoRetry?: boolean;      // 자동 재시도 활성화
  retryInterval?: number;   // 재시도 간격 (ms)
  maxRetries?: number;      // 최대 재시도 횟수
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// ===========================
// Sync Service Class
// ===========================
class ChatSyncService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 네트워크 상태 모니터링
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  // ===========================
  // Network Status
  // ===========================
  private handleOnline() {
    console.log('[ChatSyncService] Network online - starting sync');
    this.isOnline = true;
    this.startAutoSync();
  }

  private handleOffline() {
    console.log('[ChatSyncService] Network offline - pausing sync');
    this.isOnline = false;
    this.stopAutoSync();
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // ===========================
  // Auto Sync
  // ===========================
  startAutoSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log('[ChatSyncService] Auto sync started (interval:', intervalMs, 'ms)');

    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.syncQueue();
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[ChatSyncService] Auto sync stopped');
    }
  }

  // ===========================
  // Sync Queue Processing
  // ===========================
  async syncQueue(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      maxRetries = 3,
    } = options;

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    if (!this.isOnline) {
      result.success = false;
      result.errors.push('Network offline');
      return result;
    }

    try {
      const items = await getNextSyncItems(10);

      if (items.length === 0) {
        return result;
      }

      console.log('[ChatSyncService] Processing', items.length, 'sync items');

      for (const item of items) {
        // 최대 재시도 횟수 초과 시 건너뛰기
        if (item.attempts >= maxRetries) {
          console.error('[ChatSyncService] Max retries exceeded for item:', item.id);
          await removeSyncQueueItem(item.id);
          result.failed++;
          result.errors.push(`Item ${item.id} exceeded max retries`);
          continue;
        }

        try {
          // 동기화 시도
          await this.syncItem(item);

          // 성공 시 큐에서 제거
          await removeSyncQueueItem(item.id);
          result.synced++;

          console.log('[ChatSyncService] Synced item:', item.id);
        } catch (error) {
          // 실패 시 재시도 카운트 증가
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[ChatSyncService] Sync failed for item:', item.id, errorMessage);

          await updateSyncQueueItem({
            ...item,
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
          });

          // 메시지 동기화 실패 시 로컬 메시지에도 에러 기록
          if (item.entity_type === 'message') {
            await markSyncFailed(item.entity_id, errorMessage);
          }

          result.failed++;
          result.errors.push(`Item ${item.id}: ${errorMessage}`);
        }
      }

      if (result.failed > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ChatSyncService] Sync queue error:', errorMessage);

      result.success = false;
      result.errors.push(errorMessage);

      return result;
    }
  }

  // ===========================
  // Individual Item Sync
  // ===========================
  private async syncItem(item: any): Promise<void> {
    const { operation, entity_type, entity_id, payload } = item;

    if (operation === 'create_message' && entity_type === 'message') {
      await this.syncCreateMessage(payload);
    } else if (operation === 'create_conversation' && entity_type === 'conversation') {
      await this.syncCreateConversation(payload);
    } else if (operation === 'update_message' && entity_type === 'message') {
      await this.syncUpdateMessage(payload);
    } else {
      throw new Error(`Unknown sync operation: ${operation}`);
    }
  }

  private async syncCreateMessage(message: Message): Promise<void> {
    // 서버 API 호출
    const response = await fetch(`${process.env.NEXT_PUBLIC_AI_API_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': String(message.client_message_id || message.id),
        // Authorization 헤더는 상위 레벨에서 추가
      },
      body: JSON.stringify({
        conversation_id: message.conversation_id,
        content: message.content,
        parent_id: message.parent_id,
        client_message_id: String(message.client_message_id || message.id),
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }

    const serverMessage = await response.json();

    // 로컬 DB 업데이트
    await markMessageAsSynced(message.id, serverMessage);
  }

  private async syncCreateConversation(conversation: Conversation): Promise<void> {
    // 서버 API 호출
    const response = await fetch(`${process.env.NEXT_PUBLIC_AI_API_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization 헤더는 상위 레벨에서 추가
      },
      body: JSON.stringify({
        title: conversation.title,
        metadata: conversation.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }

    // 성공 처리
    console.log('[ChatSyncService] Conversation synced:', conversation.id);
  }

  private async syncUpdateMessage(message: Message): Promise<void> {
    // TODO: 메시지 업데이트 API 호출
    console.log('[ChatSyncService] Update message sync not implemented yet');
  }
}

// ===========================
// Singleton Instance
// ===========================
let syncServiceInstance: ChatSyncService | null = null;

export function getChatSyncService(): ChatSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ChatSyncService();
  }
  return syncServiceInstance;
}

// ===========================
// Convenience Functions
// ===========================
export async function startChatSync(intervalMs?: number): Promise<void> {
  const service = getChatSyncService();
  service.startAutoSync(intervalMs);
}

export async function stopChatSync(): Promise<void> {
  const service = getChatSyncService();
  service.stopAutoSync();
}

export async function forceSyncNow(): Promise<SyncResult> {
  const service = getChatSyncService();
  return await service.syncQueue();
}
