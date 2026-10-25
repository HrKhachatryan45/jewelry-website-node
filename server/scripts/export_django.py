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

TABLES = [
    "bakery_app_menuitem",
    "bakery_app_menuitemimage",
    "bakery_app_menuitemvariant",
    "bakery_app_review",
    "bakery_app_contactmessage",
    "bakery_app_order",
    "bakery_app_orderitem",
    "bakery_app_heroslide",
    "bakery_app_herosettings",
    "bakery_app_bespokeorder",
    "auth_user",
]


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
        for table in TABLES:
            cur.execute(f"SELECT * FROM {table} ORDER BY id")
            out[table] = [dict(r) for r in cur.fetchall()]
    conn.close()
    json.dump(out, sys.stdout, default=default, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
