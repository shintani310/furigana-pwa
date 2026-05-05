// Cloudflare Workers: CORSプロキシ
// 任意のURLをfetchして、CORSヘッダー付きで返す（家族用ふりがなリーダー専用）

// 許可するOrigin（GitHub Pages の公開URL + ローカル開発URL）
// !!! 自分のGitHub Pages URLに書き換えてください !!!
const ALLOWED_ORIGINS = [
  'https://shintani310.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
];

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // 許可リストに含まれていれば反映、それ以外はリスト先頭（GitHub Pages URL）を返す
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const corsHeaders = buildCorsHeaders(request);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target || !/^https?:\/\//i.test(target)) {
      return new Response('invalid url parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FuriganaReader/1.0; +family-internal)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.8',
        },
        // Cloudflare 側で5分キャッシュ（無料枠保護 + 速度向上）
        cf: { cacheTtl: 300, cacheEverything: true },
        redirect: 'follow',
      });

      const contentType = upstream.headers.get('Content-Type') || 'text/html; charset=utf-8';
      const body = await upstream.arrayBuffer();

      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'X-Upstream-Status': String(upstream.status),
        },
      });
    } catch (err) {
      return new Response(`fetch failed: ${err.message}`, {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};
