import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY;

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = path.join('/');
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  
  const url = `${API_BASE_URL}/${pathString}${queryString ? `?${queryString}` : ''}`;
  
  // Get cookies from the incoming request
  const cookieHeader = request.headers.get('cookie') || '';
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY || '',
  };
  
  // Forward cookies if present
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  
  // Forward other relevant headers
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text()
        : undefined,
    });
    
    // Get response data
    const data = await response.text();
    
    // Create response with cookies from backend
    const nextResponse = NextResponse.json(data ? JSON.parse(data) : null, {
      status: response.status,
    });
    
    // Forward Set-Cookie headers from backend
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    
    return nextResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
