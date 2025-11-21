/**
 * Registry PDF upload API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getBearer(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const bearer = getBearer(request);
    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const caseId = formData.get('caseId') as string | null;

    if (!file || !caseId) {
      return NextResponse.json(
        { error: 'File and caseId are required' },
        { status: 400 }
      );
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // MIME check (allow common fallback)
    const mime = file.type || '';
    if (!(mime === 'application/pdf' || mime === 'application/octet-stream')) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage (bucket: artifacts, path: user_id/caseId/filename)
    const bucket = 'artifacts';
    // Sanitize filename: remove Korean characters and special chars
    const sanitizedName = file.name
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII (Korean)
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special chars with underscore
    const finalName = sanitizedName || 'registry.pdf'; // Fallback if all chars removed
    const fileName = `${user.id}/${caseId}/${Date.now()}-${finalName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Create artifact record
    const { data: artifactData, error: artifactError } = await supabase
      .from('v2_artifacts')
      .insert({
        case_id: caseId,
        user_id: user.id,
        artifact_type: 'registry_pdf',
        file_path: `${bucket}/${uploadData.path}`, // ✅ "artifacts/user_id/caseId/file.pdf" 형태로 저장
        file_name: file.name,
        file_size: file.size,
        mime_type: mime || 'application/pdf',
      })
      .select()
      .single();

    if (artifactError) {
      console.error('Artifact creation error:', artifactError);
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // Update case state (new/legacy schema compatibility)
    const updateNew = await supabase.from('v2_cases')
      .update({ current_state: 'registry' })
      .eq('id', caseId)
      .eq('user_id', user.id);
    if (updateNew.error) {
      await supabase
        .from('v2_cases')
        .update({ state: 'registry_ready' })
        .eq('id', caseId)
        .eq('user_id', user.id);
    }

    // Trigger AI parse asynchronously with signed URL
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uploadData.path, 600);
      if (!signErr && signed?.signedUrl) {
        const aiUrl = process.env.AI_API_URL || process.env.NEXT_PUBLIC_AI_API_URL;
        if (aiUrl) {
          fetch(`${aiUrl}/parse/registry`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${bearer}`,
            },
            body: JSON.stringify({ file_url: signed.signedUrl }),
          }).catch(() => {});
        }
      }
    } catch {}

    return NextResponse.json({
      artifactId: artifactData.id,
      filePath: uploadData.path,
    });
  } catch (error) {
    console.error('Registry upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload registry' },
      { status: 500 }
    );
  }
}