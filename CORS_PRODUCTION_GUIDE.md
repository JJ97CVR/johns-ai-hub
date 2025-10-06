# 🔒 CORS Configuration for Production

## ✅ Produktionsklar CORS-implementation

Din edge function har nu **miljömedveten säkerhet**:

### 🏭 Production Mode (Strikt)
```typescript
// KRÄVER ALLOWED_ORIGINS - blockerar ALLA requests annars
if (isProduction && ALLOWED_ORIGINS.length === 0) {
  return { 'Access-Control-Allow-Origin': '' }; // ❌ Blockerar allt
}
```

### 🛠️ Development Mode (Tillåtande)
```typescript
// Tillåter alla origins för lokal utveckling
if (!isProduction && ALLOWED_ORIGINS.length === 0) {
  return { 'Access-Control-Allow-Origin': origin || '*' }; // ✅ Tillåter allt
}
```

---

## 📋 Deployment Checklist

### 1️⃣ Sätt Environment Variable (Required)
```bash
# Supabase CLI
supabase secrets set ENVIRONMENT="production"

# Verify
supabase secrets list
```

### 2️⃣ Konfigurera ALLOWED_ORIGINS (Required)
```bash
# Production domains (komma-separerade, inga mellanslag!)
supabase secrets set ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"

# För staging + production
supabase secrets set ALLOWED_ORIGINS="https://staging.yourdomain.com,https://yourdomain.com"

# Verify
supabase secrets list
```

### 3️⃣ Deploy Edge Function
```bash
supabase functions deploy chat
```

### 4️⃣ Test Production CORS
```bash
# Test från tillåten origin (ska fungera)
curl -X OPTIONS https://vvgcvyulcrgdtuzdobgn.supabase.co/functions/v1/chat \
  -H "Origin: https://yourdomain.com" \
  -i

# Förväntat: 200 OK med Access-Control-Allow-Origin: https://yourdomain.com

# Test från OTILLÅTEN origin (ska blockeras)
curl -X OPTIONS https://vvgcvyulcrgdtuzdobgn.supabase.co/functions/v1/chat \
  -H "Origin: https://evil.com" \
  -i

# Förväntat: Access-Control-Allow-Origin: '' (tom)
```

---

## 🔍 Monitoring & Debugging

### Kolla Edge Function Logs
```bash
# Real-time logs
supabase functions logs chat --tail

# Sök efter CORS-problem
supabase functions logs chat --filter "CORS"

# Sök efter blockerade origins
supabase functions logs chat --filter "BLOCKED"
```

### Förväntade Log Messages

#### ✅ Success (Whitelist Match)
```
✅ CORS allowed for origin: https://yourdomain.com
```

#### 🚫 Blocked Origin
```
🚫 CORS BLOCKED: Origin "https://unauthorized.com" not in whitelist
   Allowed origins: https://yourdomain.com, https://www.yourdomain.com
```

#### 🚨 Production Without Config (CRITICAL)
```
🚨 SECURITY ALERT: ALLOWED_ORIGINS not configured in production - blocking all requests
   Attempted origin: https://yourdomain.com
   Set ALLOWED_ORIGINS secret before deploying to production
```

---

## 🧪 Local Development

### Utveckla Lokalt Utan ALLOWED_ORIGINS
```bash
# Starta lokalt (ingen ENVIRONMENT variabel = development mode)
supabase start
supabase functions serve chat

# Edge function tillåter alla origins automatiskt
```

### Testa Production Mode Lokalt
```bash
# Simulera production
export ENVIRONMENT=production

# Starta utan ALLOWED_ORIGINS (ska blockera allt)
supabase functions serve chat

# Lägg till ALLOWED_ORIGINS
export ALLOWED_ORIGINS="http://localhost:5173"
supabase functions serve chat
```

---

## ⚠️ Vanliga Misstag

### ❌ MISSTAG 1: Glömmer sätta ENVIRONMENT
```bash
# Edge function använder development mode i produktion
# = Tillåter alla origins (OSÄKERT!)
```
**Fix:**
```bash
supabase secrets set ENVIRONMENT="production"
```

### ❌ MISSTAG 2: Felaktig ALLOWED_ORIGINS format
```bash
# FEL: Mellanslag mellan domains
ALLOWED_ORIGINS="https://domain1.com, https://domain2.com"

# FEL: Trailing slash
ALLOWED_ORIGINS="https://domain.com/"

# FEL: HTTP istället för HTTPS
ALLOWED_ORIGINS="http://domain.com"
```
**Rätt format:**
```bash
ALLOWED_ORIGINS="https://domain1.com,https://domain2.com"
```

### ❌ MISSTAG 3: Glömmer subdomain
```bash
# Endast main domain
ALLOWED_ORIGINS="https://domain.com"

# Problem: www.domain.com blockeras!
```
**Fix:**
```bash
ALLOWED_ORIGINS="https://domain.com,https://www.domain.com"
```

---

## 🔐 Säkerhetsrekommendationer

### ✅ DO: Production
- Alltid sätt `ENVIRONMENT=production`
- Lista ENDAST dina faktiska production domains
- Använd HTTPS (aldrig HTTP)
- Inkludera både `domain.com` och `www.domain.com`
- Övervaka logs för blockerade requests

### ❌ DON'T: Production
- Använd ALDRIG `*` i ALLOWED_ORIGINS
- Inkludera INTE localhost eller dev-domains
- Lämna ALDRIG ALLOWED_ORIGINS tom
- Sätt ALDRIG `ENVIRONMENT=development` i production

---

## 📊 Security Levels

| Environment | ALLOWED_ORIGINS | Behavior |
|-------------|-----------------|----------|
| **Production** | ✅ Configured | Strict whitelist - only listed origins allowed |
| **Production** | ❌ Not set | 🚨 BLOCKS ALL - requires immediate config |
| **Development** | ✅ Configured | Uses whitelist |
| **Development** | ❌ Not set | ⚠️ Allows all (for local testing) |

---

## 🚀 Pre-Launch Checklist

- [ ] `ENVIRONMENT` secret set to `production`
- [ ] `ALLOWED_ORIGINS` secret configured with production domains
- [ ] Edge function deployed: `supabase functions deploy chat`
- [ ] CORS preflight test passed from production domain
- [ ] Logs show `✅ CORS allowed` for production origin
- [ ] Test från unauthorized domain blockeras
- [ ] Frontend kan skicka requests utan CORS errors
- [ ] Rate limiting fungerar (testa flera requests)

---

## 📞 Troubleshooting

### Problem: "CORS BLOCKED" i production
**Orsak:** Origin saknas i ALLOWED_ORIGINS  
**Fix:**
```bash
# Kolla aktuell config
supabase secrets list

# Lägg till saknad origin
supabase secrets set ALLOWED_ORIGINS="https://existing.com,https://new-origin.com"

# Deploya om
supabase functions deploy chat
```

### Problem: Fungerar lokalt men inte i production
**Orsak:** ENVIRONMENT inte satt  
**Fix:**
```bash
supabase secrets set ENVIRONMENT="production"
supabase functions deploy chat
```

### Problem: www.domain.com blockeras men domain.com fungerar
**Orsak:** www-subdomain saknas i whitelist  
**Fix:**
```bash
supabase secrets set ALLOWED_ORIGINS="https://domain.com,https://www.domain.com"
```

---

**Senast uppdaterad:** 2025-10-04  
**Status:** ✅ Produktionsklar med miljömedveten säkerhet
