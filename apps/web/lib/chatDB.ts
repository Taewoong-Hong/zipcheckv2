/**
 * IndexedDB 기반 채팅 캐시 레이어
 *
 * 목적:
 * - 오프라인 우선 UX (낙관적 업데이트)
 * - 서버 동기화 큐 관리
 * - 빠른 로컬 조회
 *
 * 구조:
 * - conversations: 대화방 메타데이터
 * - messages: 메시지 (conversation_id 인덱스)
 * - sync_queue: 서버 동기화 대기 큐
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ===========================
// Types
// ===========================
export interface Conversation {
  id: string;  // ulid
  title?: string;
  created_by?: string;
  is_archived: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // 로컬 전용 필드
  last_synced_at?: string;  // 마지막 서버 동기화 시간
  needs_sync?: boolean;      // 서버 동기화 필요 여부
}

export interface Message {
  id: string;  // ulid
  conversation_id: string;
  parent_id?: string;
  author_type: 'user' | 'assistant' | 'system';
  author_id?: string;
  content: {
    type: 'text' | 'rich' | 'tool';
    text?: string;
    blocks?: any[];
    componentType?: string;
    componentData?: any;
  };
  status: 'pending' | 'streaming' | 'completed' | 'failed' | 'deleted';
  client_message_id?: string;  // Idempotency key
  created_at: string;
  updated_at: string;
  // 로컬 전용 필드
  needs_sync?: boolean;         // 서버 동기화 필요 여부
  sync_attempts?: number;       // 동기화 재시도 횟수
  last_error?: string;          // 마지막 동기화 에러
}

export interface SyncQueueItem {
  id: number;  // Auto-increment
  operation: 'create_conversation' | 'create_message' | 'update_message';
  entity_type: 'conversation' | 'message';
  entity_id: string;
  payload: any;
  attempts: number;
  last_attempt_at?: string;
  created_at: string;
}

// IndexedDB 스키마
interface ChatDBSchema extends DBSchema {
  // @ts-ignore - idb v8 typing compatibility
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by_created_at': string;
      'by_needs_sync': boolean;
    };
  };
  // @ts-ignore - idb v8 typing compatibility
  messages: {
    key: string;
    value: Message;
    indexes: {
      'by_conversation': string;
      'by_conversation_and_created_at': [string, string];
      'by_needs_sync': boolean;
      'by_client_message_id': string;
    };
  };
  sync_queue: {
    key: number;
    value: SyncQueueItem;
    indexes: {
      'by_created_at': string;
    };
  };
}

// ===========================
// Database Initialization
// ===========================
const DB_NAME = 'zipcheck_chat';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ChatDBSchema> | null = null;

export async function getChatDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ChatDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<ChatDBSchema>, oldVersion: number, newVersion: number | null, transaction: any) {
      console.log('[ChatDB] Upgrading database from', oldVersion, 'to', newVersion);

      // conversations store
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by_created_at', 'created_at');
        convStore.createIndex('by_needs_sync', 'needs_sync');
      }

      // messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by_conversation', 'conversation_id');
        msgStore.createIndex('by_conversation_and_created_at', [
          'conversation_id',
          'created_at',
        ]);
        msgStore.createIndex('by_needs_sync', 'needs_sync');
        msgStore.createIndex('by_client_message_id', 'client_message_id');
      }

      // sync_queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('by_created_at', 'created_at');
      }
    },
    blocked() {
      console.error('[ChatDB] Database upgrade blocked. Close other tabs.');
    },
    blocking() {
      console.warn('[ChatDB] This version is blocking a newer version.');
    },
  });

  return dbInstance;
}

// ===========================
// Conversation Operations
// ===========================
export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await getChatDB();
  await db.put('conversations', conversation);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getChatDB();
  return await db.get('conversations', id);
}

export async function listConversations(limit: number = 50): Promise<Conversation[]> {
  const db = await getChatDB();
  const tx = db.transaction('conversations', 'readonly');
  const index = tx.store.index('by_created_at');

  // 최신순 정렬
  let cursor = await index.openCursor(null, 'prev');
  const conversations: Conversation[] = [];

  while (cursor && conversations.length < limit) {
    conversations.push(cursor.value);
    cursor = await cursor.continue();
  }

  return conversations;
}

// ===========================
// Message Operations
// ===========================
export async function saveMessage(message: Message): Promise<void> {
  const db = await getChatDB();
  await db.put('messages', message);
}

export async function getMessage(id: string): Promise<Message | undefined> {
  const db = await getChatDB();
  return await db.get('messages', id);
}

export async function getMessageByClientId(
  conversation_id: string,
  client_message_id: string
): Promise<Message | undefined> {
  const db = await getChatDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.store.index('by_client_message_id');

  // client_message_id로 조회 후 conversation_id 확인
  let cursor = await index.openCursor(IDBKeyRange.only(client_message_id));

  while (cursor) {
    if (cursor.value.conversation_id === conversation_id) {
      return cursor.value;
    }
    cursor = await cursor.continue();
  }

  return undefined;
}

export async function listMessages(
  conversation_id: string,
  limit: number = 50,
  cursor?: string  // 마지막 메시지 created_at (페이지네이션)
): Promise<Message[]> {
  const db = await getChatDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.store.index('by_conversation_and_created_at');

  // 최신순 정렬 (created_at DESC)
  const range = cursor
    ? IDBKeyRange.bound(
        [conversation_id, ''],
        [conversation_id, cursor],
        false,
        true  // upper bound exclusive
      )
    : IDBKeyRange.bound([conversation_id, ''], [conversation_id, '\uffff']);

  let dbCursor = await index.openCursor(range, 'prev');
  const messages: Message[] = [];

  while (dbCursor && messages.length < limit) {
    messages.push(dbCursor.value);
    dbCursor = await dbCursor.continue();
  }

  return messages;
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getChatDB();
  await db.delete('messages', id);
}

// ===========================
// Sync Queue Operations
// ===========================
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await getChatDB();
  return await db.add('sync_queue', item as SyncQueueItem);
}

export async function getNextSyncItems(limit: number = 10): Promise<SyncQueueItem[]> {
  const db = await getChatDB();
  const tx = db.transaction('sync_queue', 'readonly');
  const index = tx.store.index('by_created_at');

  let cursor = await index.openCursor();
  const items: SyncQueueItem[] = [];

  while (cursor && items.length < limit) {
    items.push(cursor.value);
    cursor = await cursor.continue();
  }

  return items;
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = await getChatDB();
  await db.delete('sync_queue', id);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getChatDB();
  await db.put('sync_queue', item);
}

// ===========================
// Optimistic Updates
// ===========================

/**
 * 낙관적 메시지 추가
 *
 * - 즉시 로컬 DB에 저장 (needs_sync=true)
 * - sync_queue에 등록
 * - 백그라운드에서 서버 동기화
 */
export async function addOptimisticMessage(message: Message): Promise<void> {
  // 로컬 DB에 저장
  await saveMessage({
    ...message,
    needs_sync: true,
    sync_attempts: 0,
  });

  // sync_queue에 등록
  await addToSyncQueue({
    operation: 'create_message',
    entity_type: 'message',
    entity_id: message.id,
    payload: message,
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  console.log('[ChatDB] Optimistic message added:', message.id);
}

/**
 * 서버 동기화 성공 시 호출
 *
 * - needs_sync 플래그 제거
 * - sync_queue에서 제거
 */
export async function markMessageAsSynced(
  message_id: string,
  server_message?: Message
): Promise<void> {
  const db = await getChatDB();

  // 로컬 메시지 업데이트
  const localMessage = await getMessage(message_id);
  if (!localMessage) return;

  const updatedMessage: Message = {
    ...(server_message || localMessage),
    needs_sync: false,
    sync_attempts: undefined,
    last_error: undefined,
  };

  await saveMessage(updatedMessage);

  // sync_queue에서 제거
  const queueItems = await getNextSyncItems(100);
  for (const item of queueItems) {
    if (item.entity_id === message_id && item.entity_type === 'message') {
      await removeSyncQueueItem(item.id);
    }
  }

  console.log('[ChatDB] Message synced:', message_id);
}

/**
 * 서버 동기화 실패 시 호출
 *
 * - sync_attempts 증가
 * - last_error 기록
 */
export async function markSyncFailed(
  message_id: string,
  error: string
): Promise<void> {
  const message = await getMessage(message_id);
  if (!message) return;

  await saveMessage({
    ...message,
    sync_attempts: (message.sync_attempts || 0) + 1,
    last_error: error,
  });

  console.warn('[ChatDB] Sync failed for message:', message_id, error);
}

// ===========================
// Cleanup & Maintenance
// ===========================

/**
 * 오래된 대화 정리 (30일 이상)
 */
export async function cleanupOldConversations(daysOld: number = 30): Promise<number> {
  const db = await getChatDB();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();

  const tx = db.transaction(['conversations', 'messages'], 'readwrite');
  const convStore = tx.objectStore('conversations');
  const msgStore = tx.objectStore('messages');

  let deletedCount = 0;

  // 오래된 대화 찾기
  let cursor = await convStore.openCursor();

  while (cursor) {
    const conv = cursor.value;

    if (conv.created_at < cutoffISO && !conv.is_archived) {
      // 해당 대화의 모든 메시지 삭제
      const msgIndex = msgStore.index('by_conversation');
      let msgCursor = await msgIndex.openCursor(IDBKeyRange.only(conv.id));

      while (msgCursor) {
        await msgCursor.delete();
        msgCursor = await msgCursor.continue();
      }

      // 대화 삭제
      await cursor.delete();
      deletedCount++;
    }

    cursor = await cursor.continue();
  }

  await tx.done;

  console.log('[ChatDB] Cleaned up', deletedCount, 'old conversations');
  return deletedCount;
}

/**
 * 동기화 실패 항목 재시도
 */
export async function retrySyncQueue(): Promise<void> {
  const items = await getNextSyncItems(10);

  for (const item of items) {
    // 5회 이상 실패한 항목은 제거
    if (item.attempts >= 5) {
      await removeSyncQueueItem(item.id);
      console.error('[ChatDB] Sync item exceeded max attempts:', item);
      continue;
    }

    // 재시도 로직은 syncService에서 처리
    console.log('[ChatDB] Queued for retry:', item);
  }
}
