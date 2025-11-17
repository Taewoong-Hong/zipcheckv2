/**
 * Chat Storage with IndexedDB + Supabase Sync
 *
 * Architecture:
 * 1. IndexedDB: Local cache for fast reads and offline support
 * 2. Supabase API: Server-side source of truth
 * 3. Idempotency: client_message_id (ULID) prevents duplicates
 * 4. SSE Streaming: Real-time message updates via EventSource
 */

import { Message } from "@/types/chat";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  conversationId?: string; // Supabase conversation ID
  synced: boolean; // Whether session is synced to server
}

const DB_NAME = 'zipcheck_chat';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_MESSAGES = 'messages';

class ChatStorage {
  private db: IDBDatabase | null = null;
  private currentSessionId: string | null = null;
  private initPromise: Promise<void> | null = null;
  private sseConnections: Map<number, EventSource> = new Map(); // message_id -> EventSource

  constructor() {
    // Initialize database on instantiation
    this.initPromise = this.initDatabase();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDatabase(): Promise<void> {
    if (typeof window === 'undefined') return; // Skip in SSR

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ChatStorage] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ChatStorage] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sessions store
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          sessionStore.createIndex('conversationId', 'conversationId', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messageStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('[ChatStorage] Database schema created');
      };
    });
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Generate ULID for client-side message IDs
   * (idempotency key)
   */
  private generateULID(): string {
    // Simple ULID implementation (timestamp + random)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${random}`;
  }

  /**
   * Create a new chat session
   */
  async createSession(firstMessage?: string, conversationId?: string): Promise<string> {
    await this.ensureReady();

    const id = Date.now().toString();
    const session: ChatSession = {
      id,
      title: firstMessage ? this.generateTitle(firstMessage) : "새 대화",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      conversationId,
      synced: !!conversationId, // Synced if conversationId provided
    };

    // Save to IndexedDB
    if (this.db) {
      const tx = this.db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      await new Promise<void>((resolve, reject) => {
        const request = store.add(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    this.currentSessionId = id;
    console.log('[ChatStorage] Session created:', id, conversationId ? `(conversation: ${conversationId})` : '');

    return id;
  }

  /**
   * Generate title from first message
   */
  private generateTitle(message: string): string {
    const maxLength = 30;
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<ChatSession | null> {
    await this.ensureReady();

    if (!this.currentSessionId || !this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.get(this.currentSessionId!);

      request.onsuccess = () => {
        const session = request.result as ChatSession | undefined;
        if (session) {
          // Convert date strings back to Date objects
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
        }
        resolve(session || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set current session
   */
  async setCurrentSession(id: string): Promise<boolean> {
    await this.ensureReady();

    if (!this.db) return false;

    const session = await new Promise<ChatSession | undefined>((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (session) {
      this.currentSessionId = id;
      return true;
    }

    return false;
  }

  /**
   * Update current session with conversationId
   */
  async updateSessionConversationId(conversationId: string): Promise<boolean> {
    await this.ensureReady();

    if (!this.db || !this.currentSessionId) return false;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.get(this.currentSessionId!);

      request.onsuccess = () => {
        const session = request.result as ChatSession;
        if (session) {
          session.conversationId = conversationId;
          session.synced = true;
          session.updatedAt = new Date();

          const putRequest = store.put(session);
          putRequest.onsuccess = () => {
            console.log('[ChatStorage] Session updated with conversationId:', conversationId);
            resolve(true);
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(false);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add message to current session (local + server sync)
   *
   * @param message Message to add
   * @param syncToServer Whether to sync message to Supabase (default: true)
   */
  async addMessage(message: Message, syncToServer: boolean = true): Promise<void> {
    await this.ensureReady();

    // Auto-create session if needed
    if (!this.currentSessionId) {
      await this.createSession(message.role === 'user' ? message.content : undefined);
    }

    if (!this.db || !this.currentSessionId) return;

    // 1. Save to IndexedDB (local cache)
    const tx = this.db.transaction([STORE_SESSIONS, STORE_MESSAGES], 'readwrite');
    const sessionStore = tx.objectStore(STORE_SESSIONS);
    const messageStore = tx.objectStore(STORE_MESSAGES);

    // Update session
    const sessionRequest = sessionStore.get(this.currentSessionId);
    sessionRequest.onsuccess = () => {
      const session = sessionRequest.result as ChatSession;
      if (session) {
        session.messages.push(message);
        session.updatedAt = new Date();

        // Update title if it's the first user message
        if (session.messages.filter(m => m.role === 'user').length === 1 && message.role === 'user') {
          session.title = this.generateTitle(message.content);
        }

        sessionStore.put(session);

        // Save message separately for indexing
        messageStore.add({
          ...message,
          sessionId: this.currentSessionId,
        });
      }
    };

    // 2. Sync to Supabase (if enabled)
    if (syncToServer && message.role === 'user') {
      await this.syncMessageToServer(message);
    }
  }

  /**
   * Sync user message to Supabase API
   *
   * Uses idempotency key (client_message_id) to prevent duplicates
   *
   * ⚠️ TEMPORARILY DISABLED - 서버 동기화 임시 비활성화
   */
  private async syncMessageToServer(message: Message): Promise<void> {
    console.log('[ChatStorage] ⚠️ Server sync disabled - skipping');
    return; // ✅ 일단 서버 동기화 건너뛰기

    try {
      const session = await this.getCurrentSession();
      if (!session?.conversationId) {
        console.warn('[ChatStorage] No conversation ID, skipping server sync');
        return;
      }

      // Generate idempotency key if not exists
      const clientMessageId = message.id || this.generateULID();

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': clientMessageId,
        },
        body: JSON.stringify({
          conversation_id: session.conversationId,
          content: message.content,
          client_message_id: clientMessageId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ChatStorage] Message synced to server:', data.message_id);

        // Start SSE streaming for AI response
        if (data.message_id) {
          this.subscribeToMessageStream(data.message_id);
        }
      } else {
        console.error('[ChatStorage] Failed to sync message:', response.status);
      }
    } catch (error) {
      console.error('[ChatStorage] Error syncing message:', error);
    }
  }

  /**
   * Subscribe to SSE streaming for AI message updates
   */
  private subscribeToMessageStream(messageId: number): void {
    // Close existing connection if any
    const existing = this.sseConnections.get(messageId);
    if (existing) {
      existing.close();
    }

    // Create new EventSource connection
    const eventSource = new EventSource(`/api/chat/stream/${messageId}`);

    eventSource.addEventListener('chunk', async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[ChatStorage] Received chunk:', data.seq, data.delta);

        // Update message in IndexedDB with accumulated content
        await this.updateStreamingMessage(messageId, data.delta);
      } catch (error) {
        console.error('[ChatStorage] Error processing chunk:', error);
      }
    });

    eventSource.addEventListener('done', async (event) => {
      console.log('[ChatStorage] Streaming completed for message:', messageId);
      eventSource.close();
      this.sseConnections.delete(messageId);

      // Finalize message on server
      await this.finalizeMessage(messageId);
    });

    eventSource.addEventListener('error', (error) => {
      console.error('[ChatStorage] SSE error:', error);
      eventSource.close();
      this.sseConnections.delete(messageId);
    });

    this.sseConnections.set(messageId, eventSource);
  }

  /**
   * Update streaming message content in IndexedDB
   */
  private async updateStreamingMessage(messageId: number, delta: string): Promise<void> {
    if (!this.db || !this.currentSessionId) return;

    const tx = this.db.transaction([STORE_SESSIONS], 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);

    const request = store.get(this.currentSessionId);
    request.onsuccess = () => {
      const session = request.result as ChatSession;
      if (session) {
        // Find the streaming message (last assistant message)
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content += delta;
          lastMessage.isStreaming = true;
          session.updatedAt = new Date();
          store.put(session);
        }
      }
    };
  }

  /**
   * Finalize message streaming on server
   */
  private async finalizeMessage(messageId: number): Promise<void> {
    try {
      const response = await fetch(`/api/chat/message/${messageId}/finalize`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ChatStorage] Message finalized:', data.message_id);

        // Mark message as complete in IndexedDB
        if (this.db && this.currentSessionId) {
          const tx = this.db.transaction([STORE_SESSIONS], 'readwrite');
          const store = tx.objectStore(STORE_SESSIONS);

          const request = store.get(this.currentSessionId);
          request.onsuccess = () => {
            const session = request.result as ChatSession;
            if (session) {
              const lastMessage = session.messages[session.messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.isStreaming = false;
                session.updatedAt = new Date();
                store.put(session);
              }
            }
          };
        }
      } else {
        console.error('[ChatStorage] Failed to finalize message:', response.status);
      }
    } catch (error) {
      console.error('[ChatStorage] Error finalizing message:', error);
    }
  }

  /**
   * Get all sessions sorted by date
   */
  async getAllSessions(): Promise<ChatSession[]> {
    await this.ensureReady();

    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev'); // Descending order

      const sessions: ChatSession[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const session = cursor.value as ChatSession;
          // Convert date strings back to Date objects
          session.createdAt = new Date(session.createdAt);
          session.updatedAt = new Date(session.updatedAt);
          sessions.push(session);
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recent sessions (last 10)
   */
  async getRecentSessions(): Promise<ChatSession[]> {
    const allSessions = await this.getAllSessions();
    return allSessions.slice(0, 10);
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<boolean> {
    await this.ensureReady();

    if (!this.db) return false;

    // Clear current session if deleting active session
    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS, STORE_MESSAGES], 'readwrite');
      const sessionStore = tx.objectStore(STORE_SESSIONS);
      const messageStore = tx.objectStore(STORE_MESSAGES);

      // Delete session
      const deleteSessionRequest = sessionStore.delete(id);

      // Delete associated messages
      const messageIndex = messageStore.index('sessionId');
      const messagesRequest = messageIndex.openCursor(IDBKeyRange.only(id));

      messagesRequest.onsuccess = () => {
        const cursor = messagesRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      deleteSessionRequest.onsuccess = () => {
        console.log('[ChatStorage] Session deleted:', id);
        resolve(true);
      };

      deleteSessionRequest.onerror = () => reject(deleteSessionRequest.error);
    });
  }

  /**
   * Clear all sessions and messages
   */
  async clearAll(): Promise<void> {
    await this.ensureReady();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_SESSIONS, STORE_MESSAGES], 'readwrite');

      tx.objectStore(STORE_SESSIONS).clear();
      tx.objectStore(STORE_MESSAGES).clear();

      tx.oncomplete = () => {
        this.currentSessionId = null;
        console.log('[ChatStorage] All data cleared');
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Sync sessions from Supabase server
   * (called when user logs in or reconnects)
   */
  async syncFromServer(accessToken: string): Promise<void> {
    try {
      console.log('[ChatStorage] Syncing from server...');

      // Fetch recent conversations from Supabase
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[ChatStorage] Failed to fetch conversations:', response.status);
        return;
      }

      const conversations = await response.json();

      // Save to IndexedDB
      for (const conv of conversations) {
        await this.createSession(conv.title, conv.id);

        // Fetch messages for this conversation
        const messagesResponse = await fetch(`/api/chat/conversation/${conv.id}/messages`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();

          for (const msg of messages) {
            await this.addMessage({
              id: msg.id.toString(),
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at),
            }, false); // Don't sync back to server
          }
        }
      }

      console.log('[ChatStorage] Sync from server completed');
    } catch (error) {
      console.error('[ChatStorage] Error syncing from server:', error);
    }
  }

  /**
   * Close all SSE connections (cleanup)
   */
  closeAllConnections(): void {
    this.sseConnections.forEach((source) => {
      source.close();
    });
    this.sseConnections.clear();
    console.log('[ChatStorage] All SSE connections closed');
  }
}

// Singleton instance
export const chatStorage = new ChatStorage();