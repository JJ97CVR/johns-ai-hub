#!/usr/bin/env python3
"""
🚀 Volvo SQLite → Supabase Knowledge Base Importer
Läser volvo_production.db och skapar embeddings för RAG-sökning
"""

import sqlite3
import json
import os
from typing import List, Dict, Any
from datetime import datetime

# Kräver: pip install openai supabase --break-system-packages
try:
    from openai import OpenAI
    from supabase import create_client, Client
except ImportError:
    print("❌ ERROR: Missing dependencies!")
    print("Install: pip install openai supabase --break-system-packages")
    exit(1)


# ============================================================================
# CONFIGURATION
# ============================================================================

SQLITE_DB = "volvo_production.db"
BATCH_SIZE = 100  # Embeddings per batch
MAX_PRODUCTS = None  # None = alla, eller sätt t.ex. 1000 för test

# Supabase config (sätt som env vars)
SUPABASE_URL = os.getenv("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "YOUR_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_KEY")


# ============================================================================
# HELPERS
# ============================================================================

def init_clients():
    """Initiera OpenAI och Supabase clients"""
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return openai_client, supabase_client


def get_all_names(row: Dict) -> List[str]:
    """Samla ALLA namn från olika källor"""
    names = []
    
    # Primära namn
    if row['normalized_name']: names.append(row['normalized_name'])
    if row['swedish_translation']: names.append(row['swedish_translation'])
    if row['skandix_name_eng']: names.append(row['skandix_name_eng'])
    
    # Källspecifika namn
    for field in ['kl_namn', 'folkrace_namn', 'vp_namn', 'cvr_namn', 'fordon_namn']:
        if row[field] and row[field] not in names:
            names.append(row[field])
    
    return [n for n in names if n and n != 'NULL' and len(n) > 3]


def format_fitments(product_id: int, conn: sqlite3.Connection) -> str:
    """Hämta och formatera alla fitments för en produkt"""
    cursor = conn.cursor()
    
    # Hämta från expanded_fitments (grupperat för att undvika 4M rader)
    cursor.execute("""
        SELECT 
            model,
            GROUP_CONCAT(DISTINCT variant) as variants,
            MIN(year_from) as year_start,
            MAX(year_to) as year_end,
            GROUP_CONCAT(DISTINCT engine) as engines
        FROM expanded_fitments
        WHERE product_id = ?
        GROUP BY model
        ORDER BY model
    """, (product_id,))
    
    fitments = cursor.fetchall()
    
    if not fitments:
        return ""
    
    parts = ["Passar till:"]
    for model, variants, year_start, year_end, engines in fitments:
        # Hantera engines (kan vara NULL)
        engine_list = engines.split(',') if engines else []
        engine_list = [e.strip() for e in engine_list if e and e != 'NULL']
        
        # Format: "Volvo 740 1985-1992 (B200, B230)"
        line = f"Volvo {model}"
        if year_start and year_end:
            line += f" {year_start}-{year_end}"
        if engine_list:
            line += f" ({', '.join(engine_list[:5])})"  # Max 5 motorer
        
        parts.append(f"- {line}")
    
    return "\n".join(parts)


def format_alternative_names(product_id: int, conn: sqlite3.Connection) -> str:
    """Hämta alternativa namn"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT alternative_name, source_site
        FROM alternative_names
        WHERE product_id = ?
        LIMIT 20
    """, (product_id,))
    
    alts = cursor.fetchall()
    if not alts:
        return ""
    
    return "Även känd som: " + ", ".join([f"{name} ({site})" for name, site in alts[:10]])


def get_product_variants(oe_nummer: str, conn: sqlite3.Connection) -> List[Dict]:
    """Hämta alla varianter av samma OE-nummer"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id,
            skandix_product_id,
            vp_artikelnummer,
            normalized_name,
            skandix_name_eng,
            skandix_price,
            source
        FROM products
        WHERE oe_nummer = ?
        AND (has_fitments = 1 OR translation_status = 'verified')
        ORDER BY has_fitments DESC, skandix_price ASC
    """, (oe_nummer,))
    
    return [dict(row) for row in cursor.fetchall()]


def create_chunk(row: Dict, fitments: str, alt_names: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    """Skapa en sökbar text-chunk från produktdata med alla varianter"""
    
    # Primärt namn (bästa tillgängliga)
    primary_name = (
        row['normalized_name'] or 
        row['swedish_translation'] or 
        row['skandix_name_eng'] or 
        'Okänd produkt'
    )
    
    # Samla alla namn
    all_names = get_all_names(row)
    names_section = " / ".join(all_names[:5]) if all_names else primary_name
    
    # OE-nummer
    oe_section = f"OE-nummer: {row['oe_nummer']}"
    if row['vp_artikelnummer']:
        oe_section += f", VP: {row['vp_artikelnummer']}"
    
    # System/kategori
    system = row['part_system'] or 'allmänt'
    
    # Hämta alla varianter av denna produkt
    variants = get_product_variants(row['oe_nummer'], conn)
    
    # Bygg variants-section
    variants_section = ""
    if len(variants) > 1:
        variants_section = "\n\nTILLGÄNGLIGA VARIANTER:"
        for i, var in enumerate(variants, 1):
            var_name = var['normalized_name'] or var['skandix_name_eng'] or 'Variant'
            var_price = f"{var['skandix_price']:.2f} SEK" if var['skandix_price'] else "Pris saknas"
            
            # Lägg till Skandix/VP ID
            var_ids = []
            if var['skandix_product_id']:
                var_ids.append(f"Skandix {var['skandix_product_id']}")
            if var['vp_artikelnummer']:
                var_ids.append(f"VP {var['vp_artikelnummer']}")
            
            id_str = f" ({', '.join(var_ids)})" if var_ids else ""
            variants_section += f"\n{i}. {var_name} - {var_price}{id_str}"
    
    # Pris (lägsta om flera varianter)
    prices = [v['skandix_price'] for v in variants if v['skandix_price']]
    if prices:
        if len(prices) > 1:
            price = f"Från {min(prices):.2f} SEK (finns {len(variants)} varianter)"
        else:
            price = f"{prices[0]:.2f} SEK"
    else:
        price = "Pris saknas"
    
    # Bygg content
    content_parts = [
        f"PRODUKTNAMN: {primary_name}",
        f"ALTERNATIVA NAMN: {names_section}",
        f"OE-NUMMER: {oe_section}",
        f"SYSTEM: {system}",
        f"PRIS: {price}",
    ]
    
    if variants_section:
        content_parts.append(variants_section)
    
    if fitments:
        content_parts.append(f"\n{fitments}")
    
    if alt_names:
        content_parts.append(f"\n{alt_names}")
    
    # Skandix engelsk beskrivning om den finns
    if row['skandix_name_eng'] and row['skandix_name_eng'] not in names_section:
        content_parts.append(f"\nEngelsk benämning: {row['skandix_name_eng']}")
    
    content = "\n".join(content_parts)
    
    # Metadata (inkludera alla variant-IDs)
    metadata = {
        'product_id': row['id'],
        'oe_nummer': row['oe_nummer'],
        'part_system': system,
        'price_from': min(prices) if prices else None,
        'price_to': max(prices) if prices else None,
        'variant_count': len(variants),
        'variant_ids': [v['id'] for v in variants],
        'skandix_ids': [v['skandix_product_id'] for v in variants if v['skandix_product_id']],
        'vp_ids': [v['vp_artikelnummer'] for v in variants if v['vp_artikelnummer']],
        'has_fitments': bool(row['has_fitments']),
        'source': row['source'],
        'verified': row['translation_status'] == 'verified'
    }
    
    return {
        'title': primary_name,
        'content': content,
        'metadata': metadata
    }


def generate_embeddings(chunks: List[Dict], openai_client: OpenAI) -> List[Dict]:
    """Generera embeddings för chunks"""
    
    print(f"  📊 Generating embeddings for {len(chunks)} chunks...")
    
    # Extrahera bara content för embeddings
    texts = [chunk['content'] for chunk in chunks]
    
    # Batch API call
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    
    # Attach embeddings to chunks
    for i, chunk in enumerate(chunks):
        chunk['embedding'] = response.data[i].embedding
    
    return chunks


def insert_to_supabase(chunks: List[Dict], supabase: Client):
    """Lägg till chunks i Supabase knowledge base"""
    
    print(f"  💾 Inserting {len(chunks)} chunks to Supabase...")
    
    # Förbered records
    records = []
    for chunk in chunks:
        records.append({
            'title': chunk['title'],
            'content': chunk['content'],
            'embedding': chunk['embedding'],
            'metadata': chunk['metadata'],
            'source': 'volvo_sqlite',
            'tokens': len(chunk['content']) // 4  # Rough estimate
        })
    
    # Batch insert
    result = supabase.table('knowledge_base').insert(records).execute()
    
    if not result.data:
        raise Exception("Failed to insert to Supabase")
    
    return len(result.data)


# ============================================================================
# MAIN IMPORT LOGIC
# ============================================================================

def import_products():
    """Main import function"""
    
    print("="*80)
    print("🚀 VOLVO SQLITE → SUPABASE IMPORTER")
    print("="*80)
    print()
    
    # 1. Connect to SQLite
    print("📂 Connecting to SQLite database...")
    if not os.path.exists(SQLITE_DB):
        print(f"❌ ERROR: {SQLITE_DB} not found!")
        return
    
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 2. Initialize clients
    print("🔌 Initializing OpenAI and Supabase clients...")
    openai_client, supabase_client = init_clients()
    
    # 3. Get products count
    cursor.execute("SELECT COUNT(*) FROM products")
    total_products = cursor.fetchone()[0]
    
    if MAX_PRODUCTS:
        total_products = min(total_products, MAX_PRODUCTS)
    
    print(f"📦 Found {total_products} products to process")
    print()
    
    # 4. Process in batches
    # Välj EN representant per OE-nummer (den med bäst data)
    query = """
        SELECT * FROM products 
        WHERE id IN (
            SELECT id FROM products p1
            WHERE id = (
                SELECT id FROM products p2
                WHERE p2.oe_nummer = p1.oe_nummer
                ORDER BY 
                    has_fitments DESC,
                    translation_status = 'verified' DESC,
                    normalized_name IS NOT NULL DESC,
                    skandix_price IS NOT NULL DESC
                LIMIT 1
            )
        )
        AND (has_fitments = 1 OR translation_status = 'verified')
        ORDER BY has_fitments DESC, id 
        LIMIT ?
    """
    
    cursor.execute(query, (total_products,))
    
    batch_chunks = []
    processed = 0
    inserted = 0
    
    print("🔄 Processing products...")
    print("-" * 80)
    
    for row in cursor:
        row_dict = dict(row)
        
        # Get fitments and alternative names
        fitments = format_fitments(row_dict['id'], conn)
        alt_names = format_alternative_names(row_dict['id'], conn)
        
        # Create chunk (inkluderar alla varianter)
        chunk = create_chunk(row_dict, fitments, alt_names, conn)
        batch_chunks.append(chunk)
        
        processed += 1
        
        # Process batch when full
        if len(batch_chunks) >= BATCH_SIZE:
            print(f"  📦 Batch {processed // BATCH_SIZE}: Processing {len(batch_chunks)} products...")
            
            # Generate embeddings
            chunks_with_embeddings = generate_embeddings(batch_chunks, openai_client)
            
            # Insert to Supabase
            count = insert_to_supabase(chunks_with_embeddings, supabase_client)
            inserted += count
            
            print(f"  ✅ Inserted {count} chunks. Total: {inserted}/{processed}")
            print()
            
            batch_chunks = []
    
    # Process remaining chunks
    if batch_chunks:
        print(f"  📦 Final batch: Processing {len(batch_chunks)} products...")
        chunks_with_embeddings = generate_embeddings(batch_chunks, openai_client)
        count = insert_to_supabase(chunks_with_embeddings, supabase_client)
        inserted += count
        print(f"  ✅ Inserted {count} chunks. Total: {inserted}/{processed}")
    
    # 5. Summary
    print()
    print("="*80)
    print("✅ IMPORT COMPLETE!")
    print("="*80)
    print(f"📊 Products processed: {processed}")
    print(f"💾 Chunks inserted: {inserted}")
    print(f"🎯 Success rate: {(inserted/processed*100):.1f}%")
    print()
    
    # Calculate cost
    total_tokens = sum([len(c['content']) // 4 for c in batch_chunks]) * processed // len(batch_chunks) if batch_chunks else 0
    cost = total_tokens / 1_000_000 * 0.02  # $0.02 per 1M tokens
    print(f"💰 Estimated cost: ${cost:.2f}")
    print()
    
    conn.close()


if __name__ == "__main__":
    import sys
    
    # Check environment variables
    if SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("❌ ERROR: Set SUPABASE_URL environment variable!")
        print("export SUPABASE_URL='https://your-project.supabase.co'")
        sys.exit(1)
    
    if SUPABASE_KEY == "YOUR_SERVICE_ROLE_KEY":
        print("❌ ERROR: Set SUPABASE_SERVICE_ROLE_KEY environment variable!")
        sys.exit(1)
    
    if OPENAI_API_KEY == "YOUR_OPENAI_KEY":
        print("❌ ERROR: Set OPENAI_API_KEY environment variable!")
        sys.exit(1)
    
    # Run import
    import_products()
