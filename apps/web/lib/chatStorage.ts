// Simple in-memory chat storage (in production, this should be persisted to database)
import { Message } from "@/types/chat";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

class ChatStorage {
  private sessions: Map<string, ChatSession> = new Map();
  private currentSessionId: string | null = null;

  // Create a new chat session
  createSession(firstMessage?: string): string {
    const id = Date.now().toString();
    const session: ChatSession = {
      id,
      title: firstMessage ? this.generateTitle(firstMessage) : "새 대화",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(id, session);
    this.currentSessionId = id;
    return id;
  }

  // Generate title from first message
  private generateTitle(message: string): string {
    const maxLength = 30;
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  }

  // Get current session
  getCurrentSession(): ChatSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  // Set current session
  setCurrentSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.currentSessionId = id;
      return true;
    }
    return false;
  }

  // Add message to current session
  addMessage(message: Message): void {
    if (!this.currentSessionId) {
      this.createSession(message.role === 'user' ? message.content : undefined);
    }
    const session = this.sessions.get(this.currentSessionId!);
    if (session) {
      session.messages.push(message);
      session.updatedAt = new Date();
      // Update title if it's the first user message
      if (session.messages.filter(m => m.role === 'user').length === 1 && message.role === 'user') {
        session.title = this.generateTitle(message.content);
      }
    }
  }

  // Get all sessions sorted by date
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // Get recent sessions (last 10)
  getRecentSessions(): ChatSession[] {
    return this.getAllSessions().slice(0, 10);
  }

  // Delete a session
  deleteSession(id: string): boolean {
    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }
    return this.sessions.delete(id);
  }

  // Clear all sessions
  clearAll(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }
}

// Singleton instance
export const chatStorage = new ChatStorage();