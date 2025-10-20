import { NextRequest } from 'next/server';

const AI_API_URL = process.env.AI_API_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const contentType = request.headers.get('content-type');
    
    let body;
    if (contentType?.includes('multipart/form-data')) {
      // For file uploads, pass the request directly
      body = await request.formData();
    } else {
      // For JSON requests
      body = await request.json();
    }

    const response = await fetch(`${AI_API_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType || 'application/json',
      },
      body: contentType?.includes('multipart/form-data') 
        ? body 
        : JSON.stringify(body),
    });

    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const response = await fetch(`${AI_API_URL}/${path}`, {
      method: 'GET',
    });

    const data = await response.json();

    return Response.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}