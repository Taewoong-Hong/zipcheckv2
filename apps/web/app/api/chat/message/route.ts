/**
 * POST /api/chat/message
 *
 * Client-side message submission with idempotency support
 * Used by chatStorage.syncMessageToServer()
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, content, client_message_id } = body;

    // Idempotency key
    const idempotencyKey = request.headers.get('X-Idempotency-Key') || client_message_id;

    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: conversation_id, content' },
        { status: 400 }
      );
    }

    // Create Supabase client with cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn(`[POST /api/chat/message] Cookie set failed for ${name}:`, error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              console.warn(`[POST /api/chat/message] Cookie remove failed for ${name}:`, error);
            }
          },
        },
      }
    );

    // Check auth
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if message already exists (idempotency)
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('client_message_id', idempotencyKey)
        .maybeSingle();

      if (existing) {
        console.log('[POST /api/chat/message] Duplicate detected, returning existing:', existing.id);
        return NextResponse.json({
          message_id: existing.id,
          duplicate: true,
        });
      }
    }

    // Insert user message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        role: 'user',
        content,
        client_message_id: idempotencyKey,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[POST /api/chat/message] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save message', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('[POST /api/chat/message] Message saved:', message.id);

    return NextResponse.json({
      message_id: message.id,
      duplicate: false,
    });

  } catch (error: any) {
    console.error('[POST /api/chat/message] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
