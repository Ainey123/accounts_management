import { NextResponse } from 'next/server';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete('nexus_user');
  return response;
}
