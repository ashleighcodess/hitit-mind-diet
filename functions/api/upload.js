// Cloudflare Pages Function — R2 file upload
// Bound to R2 bucket via wrangler.toml as MEDIA_BUCKET

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (50MB max)' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique key
    const ext = file.name.split('.').pop().toLowerCase();
    const key = `assignments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to R2
    await env.MEDIA_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Public URL (via R2 custom domain or r2.dev subdomain)
    const publicUrl = `${env.R2_PUBLIC_URL || ''}/${key}`;

    return new Response(JSON.stringify({ url: publicUrl, key }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
