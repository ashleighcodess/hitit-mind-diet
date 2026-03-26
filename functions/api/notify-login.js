// Cloudflare Pages Function — Email notification on client login
// Uses Resend API (free tier) to notify Coach Jaynie

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const { clientName, clientEmail } = await request.json();

    if (!clientName && !clientEmail) {
      return new Response(JSON.stringify({ error: 'Missing client info' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HIT IT Mind Diet <onboarding@resend.dev>',
        to: 'classymarketingusa@gmail.com',
        subject: `🧠 ${clientName || 'A client'} just logged in to HIT IT`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #333; margin-bottom: 4px;">Client Login Alert</h2>
            <p style="color: #666; margin-top: 0;">${now}</p>
            <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Name:</strong> ${clientName || 'Unknown'}</p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${clientEmail || 'Unknown'}</p>
            </div>
            <p style="color: #999; font-size: 13px;">— HIT IT Mind Diet App</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Email send failed' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Notify error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
