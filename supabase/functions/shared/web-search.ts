import { logWarn, logError } from './logger-utils.ts';

// Web search using Brave Search API
export async function searchWeb(query: string, count: number = 5) {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  
  if (!apiKey) {
    logWarn('web-search', 'No Brave API key - web search disabled');
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        }
      }
    );
    
    if (!response.ok) {
      logError('web-search', `Search failed: ${response.statusText}`, undefined, { query, status: response.status });
      return null;
    }
    
    const data = await response.json();
    
    return {
      query,
      results: data.web?.results?.map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description,
        snippet: r.extra_snippets?.[0] || r.description,
      })) || []
    };
  } catch (error) {
    logError('web-search', 'Web search error', error instanceof Error ? error : new Error(String(error)), { query });
    return null;
  }
}

// SECURITY: Enhanced SSRF protection with comprehensive validation
export async function fetchWebPage(url: string, maxRedirects = 3): Promise<string | null> {
  try {
    // 1. Protocol validation - only http/https allowed
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logWarn('web-search', `Blocked protocol: ${parsed.protocol}`, { url });
      return null;
    }
    
    // 2. Extended IP blocklist - prevent access to private networks and cloud metadata
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,                    // IPv4 loopback
      /^10\./,                     // Private Class A
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
      /^192\.168\./,               // Private Class C
      /^169\.254\./,               // Link-local (AWS metadata: 169.254.169.254)
      /^::1$/,                     // IPv6 loopback
      /^fc00:/,                    // IPv6 private
      /^fe80:/,                    // IPv6 link-local
    ];
    
    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      logWarn('web-search', `Blocked private/internal IP: ${hostname}`, { url, hostname });
      return null;
    }
    
    // 2b. DNS Rebinding Protection - resolve hostname and check IP
    try {
      const dnsResults = await Deno.resolveDns(hostname, 'A');
      for (const ip of dnsResults) {
        if (blockedPatterns.some(pattern => pattern.test(ip))) {
          logWarn('web-search', `DNS rebinding attempt detected: ${hostname} → ${ip}`, { url, hostname, ip });
          return null;
        }
      }
    } catch (dnsError) {
      logWarn('web-search', `DNS resolution failed for ${hostname}`, { hostname });
      // Continue anyway - DNS might be temporarily unavailable
    }
    
    // 3. Port validation - only standard HTTP/HTTPS ports
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    if (!['80', '443'].includes(port)) {
      logWarn('web-search', `Blocked non-standard port: ${port}`, { url, port });
      return null;
    }
    
    // 4. User-Agent rotation for better compatibility
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // 5. Fetch with manual redirect handling for validation
    let redirectCount = 0;
    let currentUrl = url;
    
    while (redirectCount < maxRedirects) {
      const response = await fetch(currentUrl, {
        headers: { 'User-Agent': randomUA },
        signal: AbortSignal.timeout(8000), // 8s timeout
        redirect: 'manual', // Handle redirects manually to validate each URL
      });
      
      // Check for redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) break;
        
        // SECURITY: Validate redirect URL against blocklist
        try {
          const redirectUrl = new URL(location, currentUrl);
          const redirectHostname = redirectUrl.hostname.toLowerCase();
          
          // Check protocol
          if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
            logWarn('web-search', `Blocked redirect to protocol: ${redirectUrl.protocol}`, { url, redirectUrl: redirectUrl.href });
            return null;
          }
          
          // Check if redirect leads to private IP
          if (blockedPatterns.some(p => p.test(redirectHostname))) {
            logWarn('web-search', `Blocked redirect to private IP: ${redirectHostname}`, { url, redirectHostname });
            return null;
          }
          
          currentUrl = redirectUrl.href;
          redirectCount++;
          continue;
        } catch (redirectError) {
          logWarn('web-search', 'Invalid redirect URL', { url, location });
          return null;
        }
      }
      
      if (!response.ok) return null;
      
      // 5. Content-length check (4MB max)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 4 * 1024 * 1024) {
        logWarn('web-search', 'Content too large (max 4MB)', { url, contentLength });
        return null;
      }
      
      const html = await response.text();
      
      // 6. Strip HTML to extract text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return text.slice(0, 5000); // Max 5000 chars
    }
    
    logWarn('web-search', 'Max redirects exceeded', { url, maxRedirects });
    return null;
    
  } catch (error) {
    logError('web-search', 'Fetch failed', error instanceof Error ? error : new Error(String(error)), { url });
    return null;
  }
}
