"""Export the Django cake_db to JSON for the Node seed script.

Equivalent to `manage.py dumpdata` but reads the PostgreSQL tables directly.
Usage: python export_django.py > prisma/seed-data.json
"""
import json
import sys
from datetime import date, datetime
from decimal import Decimal

import psycopg2
import psycopg2.extras

DB = dict(dbname="cake_db", user="postgres", host="localhost", port=5432)

TABLES = {
    "bakery_app_menuitem": "products",
    "bakery_app_menuitemimage": "product_images",
    "bakery_app_menuitemvariant": "product_variants",
    "bakery_app_review": "reviews",
    "bakery_app_contactmessage": "contact_messages",
    "bakery_app_order": "orders",
    "bakery_app_orderitem": "order_items",
    "bakery_app_heroslide": "hero_slides",
    "bakery_app_herosettings": "hero_settings",
    "bakery_app_bespokeorder": "bespoke_orders",
    "auth_user": "auth_user",
}


def default(obj):
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(str(type(obj)))


def main():
    conn = psycopg2.connect(**DB)
    out = {}
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        for table, output_name in TABLES.items():
            cur.execute(f"SELECT * FROM {table} ORDER BY id")
            out[output_name] = [dict(r) for r in cur.fetchall()]
    conn.close()
    json.dump(out, sys.stdout, default=default, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
