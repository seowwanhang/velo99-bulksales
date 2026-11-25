import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

const CSV_HEADERS = [
  'sku',
  'name',
  'categorySlug',
  'color',
  'size',
  'unitsPerCarton',
  'isBicycle',
  'cbm',
  'unitPrice',
  'costPrice',
  'stock',
  'minStock',
  'isNew',
  'active',
  'imageUrl',
  'specs',
];

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"' && normalized[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const products = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    include: { category: { select: { slug: true } } },
  });

  const lines = [
    CSV_HEADERS.join(','),
    ...products.map((p) =>
      [
        p.sku,
        p.name,
        p.category.slug,
        p.color,
        p.size,
        p.unitsPerCarton,
        p.isBicycle,
        p.cbm,
        p.unitPrice,
        p.costPrice,
        p.stock,
        p.minStock,
        p.isNew,
        p.active,
        p.imageUrl,
        p.specs,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="velo99-bicycle-catalog.csv"',
    },
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const body = await req.json();
    const csvText = String(body.csv || '');
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'CSV must contain a header row and at least one product row.' },
        { status: 400 }
      );
    }

    const headerMap: Record<string, number> = {};
    rows[0].forEach((h, idx) => {
      headerMap[h.toLowerCase().trim()] = idx;
    });

    if (headerMap['sku'] === undefined || headerMap['name'] === undefined) {
      return NextResponse.json(
        { error: 'CSV header must include at least "sku" and "name" columns.' },
        { status: 400 }
      );
    }

    const categories = await prisma.category.findMany();
    const fallbackCategory = categories[0];
    if (!fallbackCategory) {
      return NextResponse.json(
        { error: 'Please create at least one category before importing products.' },
        { status: 400 }
      );
    }

    const getCell = (cols: string[], key: string) => {
      const idx = headerMap[key.toLowerCase()];
      return idx !== undefined ? (cols[idx] ?? '').trim() : '';
    };

    const parseBool = (v: string, fallback: boolean) => {
      if (!v) return fallback;
      const lower = v.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    };

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const sku = getCell(cols, 'sku').toUpperCase();
      const name = getCell(cols, 'name');
      if (!sku || !name) {
        errors.push(`Row ${r + 1}: Missing sku or name`);
        continue;
      }

      const catKey = getCell(cols, 'categoryslug').toLowerCase();
      const matchedCat =
        categories.find(
          (c) => c.slug.toLowerCase() === catKey || c.name.toLowerCase() === catKey
        ) ?? fallbackCategory;

      const stock = Math.max(0, Math.floor(Number(getCell(cols, 'stock')) || 0));
      const payload = {
        name,
        categoryId: matchedCat.id,
        color: getCell(cols, 'color') || 'Standard',
        size: getCell(cols, 'size') || 'One Size',
        unitsPerCarton: Math.max(1, Math.floor(Number(getCell(cols, 'unitspercarton')) || 1)),
        isBicycle: parseBool(getCell(cols, 'isbicycle'), true),
        cbm: Math.max(0.01, Number(getCell(cols, 'cbm')) || 0.30),
        unitPrice: Math.max(0, Number(getCell(cols, 'unitprice')) || 0),
        costPrice: Math.max(0, Number(getCell(cols, 'costprice')) || 0),
        stock,
        minStock: Math.max(1, Math.floor(Number(getCell(cols, 'minstock')) || 8)),
        isNew: parseBool(getCell(cols, 'isnew'), false),
        active: parseBool(getCell(cols, 'active'), true),
        imageUrl: getCell(cols, 'imageurl') || '/images/bike-mtb.jpg',
        specs: getCell(cols, 'specs') || '',
      };

      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        const delta = stock - existing.stock;
        const upd = await prisma.product.update({ where: { sku }, data: payload });
        if (delta !== 0) {
          await prisma.inventoryLog.create({
            data: {
              productId: upd.id,
              sku: upd.sku,
              type: 'ADJUSTMENT',
              delta,
              balanceAfter: upd.stock,
              reference: 'CSV-IMPORT',
              note: `Bulk CSV import by ${admin.name}`,
            },
          });
        }
        updated++;
      } else {
        const crt = await prisma.product.create({ data: { sku, ...payload } });
        if (stock > 0) {
          await prisma.inventoryLog.create({
            data: {
              productId: crt.id,
              sku: crt.sku,
              type: 'INBOUND',
              delta: stock,
              balanceAfter: crt.stock,
              reference: 'CSV-IMPORT',
              note: `Opening stock via CSV import (${admin.name})`,
            },
          });
        }
        created++;
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch {
    return NextResponse.json({ error: 'CSV import failed.' }, { status: 500 });
  }
}
