# 🚀 Import Guide: SQLite → Supabase

## Snabbstart

```bash
# 1. Installera dependencies
pip install openai supabase --break-system-packages

# 2. Sätt environment variables
export SUPABASE_URL="https://vvgcvyulcrgdtuzdobgn.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="din_service_role_key"
export OPENAI_API_KEY="din_openai_key"

# 3. Kör import
python3 import_volvo_to_supabase.py
```

## Förberedelser

### 1. Skapa Knowledge Base Tabell i Supabase

Kör denna SQL i Supabase SQL Editor:

```sql
-- Skapa knowledge_base tabell
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Vector embedding
  embedding vector(1536) NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  source TEXT NOT NULL,
  tokens INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för vector search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
  ON knowledge_base 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index för metadata
CREATE INDEX IF NOT EXISTS knowledge_base_metadata_idx 
  ON knowledge_base 
  USING gin(metadata);

-- Index för source
CREATE INDEX IF NOT EXISTS knowledge_base_source_idx 
  ON knowledge_base (source);

-- RLS policies
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON knowledge_base FOR SELECT
  USING (true);

CREATE POLICY "Service role full access"
  ON knowledge_base FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

### 2. Hitta Dina Nycklar

**Supabase URL:**
- Gå till Supabase Dashboard
- Project Settings → API
- Kopiera "Project URL"

**Service Role Key:**
- Samma sida → "service_role" (secret)
- ⚠️ Håll denna hemlig!

**OpenAI API Key:**
- platform.openai.com
- API Keys → Create new key

## Kör Import

### Test (1000 produkter först)

```python
# Redigera import_volvo_to_supabase.py rad 21:
MAX_PRODUCTS = 1000  # Test med 1000 först

# Kör
python3 import_volvo_to_supabase.py
```

**Förväntat:**
- Tid: ~5-10 minuter
- Kostnad: ~$0.10
- Resultat: 1000 chunks i Supabase

### Full Import (60,363 produkter)

```python
# Redigera import_volvo_to_supabase.py rad 21:
MAX_PRODUCTS = None  # Alla produkter

# Kör
python3 import_volvo_to_supabase.py
```

**Förväntat:**
- Tid: ~2-4 timmar
- Kostnad: ~$6-8
- Resultat: 60k chunks i Supabase

## Vad Händer Under Import?

```
1. Läser volvo_production.db
2. För varje produkt:
   ├─ Samlar alla namn (normalized, skandix, kl, folkrace, vp, cvr, fordon)
   ├─ Hämtar fitments (modeller, motorer, år)
   ├─ Hämtar alternativa namn från andra källor
   └─ Skapar en sökbar text-chunk
3. Batch om 100 produkter:
   ├─ Generera embeddings (OpenAI)
   └─ Spara i Supabase
4. Upprepa till alla klara
```

## Output Format

Varje chunk i Supabase ser ut så här:

```json
{
  "title": "Kuggremsspännare",
  "content": "PRODUKTNAMN: Kuggremsspännare\nALTERNATIVA NAMN: Kuggremsspännare / Remspännare / Spännrulle kuggrem\nOE-NUMMER: 673797, VP: 673797\nSYSTEM: engine\nPRIS: 1299.00 SEK\n\nPassar till:\n- Volvo V70 2001-2007 (D5, D5244T)\n- Volvo S80 1999-2006 (D5)\n- Volvo XC90 2003-2014 (D5)\n\nÄven känd som: Kuggremsspännare (folkraceshop.se), Remspännare (klracing.se)",
  "embedding": [0.123, -0.456, ...],
  "metadata": {
    "product_id": 12345,
    "oe_nummer": "673797",
    "part_system": "engine",
    "price": 1299.00,
    "has_fitments": true,
    "source": "both",
    "verified": true
  },
  "source": "volvo_sqlite",
  "tokens": 250
}
```

## Felsökning

**"ModuleNotFoundError: No module named 'openai'"**
```bash
pip install openai supabase --break-system-packages
```

**"Invalid API key"**
- Kontrollera att OPENAI_API_KEY är korrekt
- Test: `echo $OPENAI_API_KEY`

**"Supabase connection failed"**
- Kontrollera SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY
- Test: Kopiera URL i webbläsare (ska visa JSON)

**"Rate limit exceeded"**
- OpenAI: Vänta 1 minut, kör igen
- Eller: Minska BATCH_SIZE från 100 till 50

**Import avbröts - kan jag fortsätta?**
Ja! Lägg till detta i scriptet (rad 200):
```python
# Skip already imported products
cursor.execute("""
    SELECT id FROM products 
    WHERE id NOT IN (
        SELECT (metadata->>'product_id')::int 
        FROM knowledge_base 
        WHERE source = 'volvo_sqlite'
    )
    ORDER BY has_fitments DESC, id 
    LIMIT ?
""", (total_products,))
```

## Nästa Steg

Efter importen:

1. ✅ Verifiera i Supabase:
   ```sql
   SELECT COUNT(*) FROM knowledge_base WHERE source = 'volvo_sqlite';
   ```

2. ✅ Test vector search:
   ```sql
   SELECT title, content, metadata
   FROM knowledge_base
   WHERE source = 'volvo_sqlite'
   LIMIT 5;
   ```

3. ✅ Integrera med LEX (nästa guide)

## Kostnader

| Steg | Produkter | Tokens | Kostnad |
|------|-----------|--------|---------|
| Test | 1,000 | ~500k | $0.10 |
| Halv | 30,000 | ~15M | $3.00 |
| Full | 60,363 | ~30M | $6.00 |

*Baserat på text-embedding-3-small @ $0.02/1M tokens*

## Support

Problem? Skicka output från:
```bash
python3 import_volvo_to_supabase.py 2>&1 | tee import.log
```
Till Claude med "Import misslyckades, här är loggen"
