import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!validOrigin(request)) return new Response('Invalid origin', { status: 403 });
  const origin = request.headers.get('origin')!;
  const token = (await cookies()).get('re_access_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', origin), 303);
  const form = await request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const patientId = field('patient_id');
  const message = field('message') || 'Take your prescribed daily medication';
  const scheduleTime = field('schedule_time') || '09:00';
  const active = field('active') !== 'false';
  if (!UUID.test(patientId) || !/^\d{2}:\d{2}$/.test(scheduleTime) || message.length > 240) {
    return new Response('Invalid request', { status: 422 });
  }
  const back = `/?patient=${encodeURIComponent(patientId)}`;
  try {
    const response = await fetch(
      new URL(`/v1/doctor/patients/${encodeURIComponent(patientId)}/medication-reminder`, process.env.RE_API_URL ?? 'http://127.0.0.1:8000'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ message, schedule_time: scheduleTime, active }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      },
    );
    return NextResponse.redirect(new URL(response.ok ? `${back}&medication=saved` : `${back}&error=medication-unavailable`, origin), 303);
  } catch {
    return NextResponse.redirect(new URL(`${back}&error=medication-unavailable`, origin), 303);
  }
}
