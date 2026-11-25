import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Database already initialized — skipping starter seed.');
    return;
  }

  console.log('Seeding Velo99 Bulksales database...');

  // 1. Site Settings (Singleton)
  await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      brandName: 'Velo99 Bulksales',
      tagline: 'Malaysia Online Bicycle Wholesale Platform',
      logoText: 'V99',
      supportPhone: '+6011-1600-0099',
      supportEmail: 'bulksales@velo99.my',
      supportHours: '09:00 AM - 05:00 PM (Mon-Sat)',
      companyRegNo: 'Velo99 Wholesale Sdn Bhd 202401016930 (1562780-X)',
      footerNotice:
        'This online bulk service is available for Central (KL & Selangor), Southern (Negeri Sembilan, Melaka & Johor), Northern (Perak, Penang, Kedah & Perlis), and East Coast South (Pahang & Terengganu) in Peninsular Malaysia.',
      minOrderValue: 500,
      freeDeliveryCbm: 0.5,
      standardShippingFee: 80,
      rescheduleFee: 30,
      cutoffHour: 13,
      instalmentPromoText: 'Manual Bank Transfer, DuitNow QR & Approved Dealer Credit Terms',
      bankName: 'Maybank Islamic',
      bankAccountName: 'Velo99 Wholesale Sdn Bhd',
      bankAccountNumber: '5123 4567 8901',
      duitNowQrUrl: '',
      whatsappOrderNumber: '601116000099',
      notifyEmail: 'bulksales@velo99.my',
    },
  });

  // 2. Hero Banners (Editable carousel slides)
  const existingBanners = await prisma.heroBanner.count();
  if (existingBanners === 0) {
    await prisma.heroBanner.createMany({
      data: [
        {
          eyebrow: 'FACTORY-DIRECT BICYCLE CARTONS',
          title: 'Order bicycles in bulk cartons. Unlock free next-day lorry delivery.',
          subtitle:
            'Built for Malaysian bike shops, rental fleets, and corporate buyers. Stack dealer tier discounts up to 15% OFF plus volume bonuses up to 20% OFF.',
          ctaLabel: 'Browse Bulk Cartons',
          ctaHref: '#catalog',
          imageUrl: '/images/hero-warehouse.jpg',
          badgeText: '1:00 PM DAILY CUTOFF',
          sortOrder: 1,
          active: true,
        },
        {
          eyebrow: 'FLEXIBLE SME CASH FLOW',
          title: '0% 3-Month SME Instalment Plan on bulk orders RM 500 and above.',
          subtitle:
            'Keep your bike shop showroom stocked without upfront cash crunch. Convert eligible bulk checkout orders to 3-month 0% instalments with LHDN e-Invoice support.',
          ctaLabel: 'Explore New Arrivals',
          ctaHref: '#new-arrivals',
          imageUrl: '/images/bike-road.jpg',
          badgeText: 'LHDN E-INVOICE READY',
          sortOrder: 2,
          active: true,
        },
        {
          eyebrow: 'ZERO-GUESSWORK LOGISTICS',
          title: 'Real-time CBM metering unlocks Free Delivery automatically at 0.50 m³.',
          subtitle:
            'No manual box calculations. Add SKD bicycle cartons or parts packs and watch your Self-Pickup (RM 500) and Free Delivery (0.50 m³) bars update live.',
          ctaLabel: 'Check Delivery Hubs',
          ctaHref: '#how-it-works',
          imageUrl: '/images/bike-ebike-fold.jpg',
          badgeText: 'PENINSULAR HUBS',
          sortOrder: 3,
          active: true,
        },
      ],
    });
  }

  // 3. Delivery Regions & Hubs
  const regions = [
    {
      code: 'central',
      name: 'Central Region (KL & Selangor)',
      states: 'Kuala Lumpur, Selangor, Putrajaya',
      hubName: 'Shah Alam Distribution Hub (Seksyen 15)',
      hubAddress: 'No. 18, Jalan Pahat 15/18, Seksyen 15, 40200 Shah Alam, Selangor',
      postcodePrefix: '40000',
      pickupHours: '6:00 PM - 10:00 PM',
      sortOrder: 1,
    },
    {
      code: 'southern',
      name: 'Southern Region (N. Sembilan, Melaka & Johor)',
      states: 'Negeri Sembilan, Melaka, Johor',
      hubName: 'Senai Logistics Hub (Johor)',
      hubAddress: 'Lot 24, Jalan Perindustrian Senai 3, 81400 Senai, Johor',
      postcodePrefix: '81400',
      pickupHours: '6:00 PM - 10:00 PM',
      sortOrder: 2,
    },
    {
      code: 'northern',
      name: 'Northern Region (Perak, Penang, Kedah & Perlis)',
      states: 'Perak, Pulau Pinang, Kedah, Perlis',
      hubName: 'Prai Industrial Hub (Penang)',
      hubAddress: 'No. 9, Lorong Perusahaan 4, Kawasan Perusahaan Perai, 13600 Perai, Penang',
      postcodePrefix: '13600',
      pickupHours: '6:00 PM - 10:00 PM',
      sortOrder: 3,
    },
    {
      code: 'eastcoast',
      name: 'East Coast South (Pahang & Terengganu)',
      states: 'Pahang, Terengganu',
      hubName: 'Kuantan Gebeng Hub (Pahang)',
      hubAddress: 'Lot 12, Kawasan Perindustrian Gebeng, 26080 Kuantan, Pahang',
      postcodePrefix: '26080',
      pickupHours: '6:00 PM - 9:30 PM',
      sortOrder: 4,
    },
  ];
  for (const r of regions) {
    await prisma.deliveryRegion.upsert({
      where: { code: r.code },
      update: {},
      create: r,
    });
  }

  // 4. Categories
  const categories = [
    { slug: 'mtb', name: 'Mountain Bikes (MTB)', description: '27.5" & 29" hardtail and trail SKD cartons', imageUrl: '/images/bike-mtb.jpg', sortOrder: 1 },
    { slug: 'road', name: 'Road & Aero Bikes', description: 'Alloy endurance & carbon aero racing cartons', imageUrl: '/images/bike-road.jpg', sortOrder: 2 },
    { slug: 'folding-ebike', name: 'Folding & E-Bikes', description: 'Compact 20" folding commuter & electric bikes', imageUrl: '/images/bike-ebike-fold.jpg', sortOrder: 3 },
    { slug: 'gravel', name: 'Gravel & City Hybrid', description: '700C gravel tourers and urban fleet hybrids', imageUrl: '/images/bike-gravel.jpg', sortOrder: 4 },
    { slug: 'kids-bmx', name: 'Kids & BMX', description: 'High-turnover 16" & 20" youth and stunt BMX cartons', imageUrl: '/images/bike-kids-bmx.jpg', sortOrder: 5 },
    { slug: 'parts-gear', name: 'Wheelsets, Helmets & Parts', description: 'Master cartons of wheelsets, brakes & safety gear', imageUrl: '/images/bike-parts.jpg', sortOrder: 6 },
  ];
  const catMap: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    catMap[c.slug] = row.id;
  }

  // 5. Products (12 wholesale SKUs covering CRITICAL, WARNING, HEALTHY states)
  const products = [
    {
      sku: 'V99-MTB29-CHR-M',
      name: 'APEX TRAIL 29" ALLOY MTB • 2× UNITS/CTN',
      categoryId: catMap['mtb'],
      color: 'Charcoal / Orange',
      size: '29" (M)',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.36,
      unitPrice: 1780,
      costPrice: 1210,
      stock: 18,
      minStock: 8,
      isNew: true,
      imageUrl: '/images/bike-mtb.jpg',
      specs: '6061 Hydroformed Alloy • 1×12 Speed • Hydraulic Disc • 100mm Lockout Fork • 85% SKD Carton',
    },
    {
      sku: 'V99-MTB27-BLK-S',
      name: 'RIDGE XC 27.5" HARDTAIL MTB • 2× UNITS/CTN',
      categoryId: catMap['mtb'],
      color: 'Stealth Matte Black',
      size: '27.5" (S/M)',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.34,
      unitPrice: 1420,
      costPrice: 980,
      stock: 6,
      minStock: 8,
      isNew: false,
      imageUrl: '/images/bike-mtb.jpg',
      specs: 'Alloy 6061 Frame • 21-Speed Shimano Tourney • Mechanical Disc Brakes • Ideal for entry retail & rentals',
    },
    {
      sku: 'V99-RD700-CRM-54',
      name: 'VELOCE AERO CARBON ROAD 700C • 1× UNIT/CTN',
      categoryId: catMap['road'],
      color: 'Crimson / Carbon',
      size: '54cm (M)',
      unitsPerCarton: 1,
      isBicycle: true,
      cbm: 0.24,
      unitPrice: 3250,
      costPrice: 2340,
      stock: 11,
      minStock: 6,
      isNew: true,
      imageUrl: '/images/bike-road.jpg',
      specs: 'T800 Carbon Aero Frame • 2×11 Shimano 105 • 50mm Deep-Section Wheelset • Internal Routing',
    },
    {
      sku: 'V99-RD700-SLV-52',
      name: 'STRADA ALLOY ENDURANCE ROAD • 2× UNITS/CTN',
      categoryId: catMap['road'],
      color: 'Brushed Silver',
      size: '52cm (S)',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.38,
      unitPrice: 2180,
      costPrice: 1520,
      stock: 2,
      minStock: 8,
      isNew: false,
      imageUrl: '/images/bike-road.jpg',
      specs: 'Double-butted 6061 Alloy • Carbon Fork • 16-Speed • Flat-Mount Disc Brakes',
    },
    {
      sku: 'V99-EFL20-EMR-OS',
      name: 'AEROVOLT 20" FOLDING E-BIKE • 1× UNIT/CTN',
      categoryId: catMap['folding-ebike'],
      color: 'Emerald / Brushed Alloy',
      size: '20" Folding',
      unitsPerCarton: 1,
      isBicycle: true,
      cbm: 0.26,
      unitPrice: 2490,
      costPrice: 1740,
      stock: 14,
      minStock: 6,
      isNew: true,
      imageUrl: '/images/bike-ebike-fold.jpg',
      specs: '250W Rear Hub Motor • 36V 10.4Ah Frame Battery (65km Range) • 10-Second Fold • SIRIM Charger',
    },
    {
      sku: 'V99-FLD20-GRY-OS',
      name: 'METRO FOLD 20" 9-SPD COMMUTER • 2× UNITS/CTN',
      categoryId: catMap['folding-ebike'],
      color: 'Titanium Grey',
      size: '20" Folding',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.30,
      unitPrice: 1360,
      costPrice: 920,
      stock: 0,
      minStock: 10,
      isNew: false,
      imageUrl: '/images/bike-ebike-fold.jpg',
      specs: 'Lightweight Alloy Folding Frame • 9-Speed Drivetrain • Magnetic Fold Clasp • Fits car boots & LRT',
    },
    {
      sku: 'V99-GRV700-SND-54',
      name: 'NOMAD GRV 700C GRAVEL TOUR • 2× UNITS/CTN',
      categoryId: catMap['gravel'],
      color: 'Desert Sand',
      size: '54cm (M)',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.38,
      unitPrice: 2640,
      costPrice: 1860,
      stock: 9,
      minStock: 6,
      isNew: true,
      imageUrl: '/images/bike-gravel.jpg',
      specs: 'Alloy Gravel Frame • 42mm Tan-Wall Tires • Flared Drop Bars • 2×10 Gravel Drivetrain',
    },
    {
      sku: 'V99-HYB700-OLV-M',
      name: 'CITILINE 700C URBAN HYBRID • 2× UNITS/CTN',
      categoryId: catMap['gravel'],
      color: 'Olive Matte',
      size: '700C (M)',
      unitsPerCarton: 2,
      isBicycle: true,
      cbm: 0.35,
      unitPrice: 1290,
      costPrice: 870,
      stock: 5,
      minStock: 8,
      isNew: false,
      imageUrl: '/images/bike-gravel.jpg',
      specs: 'Flat-bar City Geometry • 24-Speed • Puncture-Guard 35c Tires • Ideal for corporate & resort fleets',
    },
    {
      sku: 'V99-BMX20-COB-20',
      name: 'JUNIOR PRO 20" FREESTYLE BMX • 4× UNITS/CTN',
      categoryId: catMap['kids-bmx'],
      color: 'Cobalt Blue',
      size: '20" Wheel',
      unitsPerCarton: 4,
      isBicycle: true,
      cbm: 0.42,
      unitPrice: 1560,
      costPrice: 1040,
      stock: 15,
      minStock: 8,
      isNew: true,
      imageUrl: '/images/bike-kids-bmx.jpg',
      specs: 'Hi-Ten Freestyle Frame • 360° Rotor Detangler • 4 Steel Stunt Pegs • High-margin retail best-seller',
    },
    {
      sku: 'V99-KID16-RED-16',
      name: 'SPARK 16" KIDS TRAINING BIKE • 4× UNITS/CTN',
      categoryId: catMap['kids-bmx'],
      color: 'Cobalt / Red Mix',
      size: '16" Wheel',
      unitsPerCarton: 4,
      isBicycle: true,
      cbm: 0.36,
      unitPrice: 980,
      costPrice: 640,
      stock: 6,
      minStock: 10,
      isNew: false,
      imageUrl: '/images/bike-kids-bmx.jpg',
      specs: 'Full Chain Guard • Removable Training Wheels • Assorted Carton (2 Blue, 2 Red)',
    },
    {
      sku: 'V99-PRT-WHL-29',
      name: 'PRO-DISC 29" ALLOY WHEELSET • 5× PAIRS/CTN',
      categoryId: catMap['parts-gear'],
      color: 'Matte Black',
      size: '29" Boost',
      unitsPerCarton: 5,
      isBicycle: false,
      cbm: 0.18,
      unitPrice: 1150,
      costPrice: 760,
      stock: 12,
      minStock: 6,
      isNew: true,
      imageUrl: '/images/bike-parts.jpg',
      specs: 'Sealed Bearing Thru-Axle Hubs • 6-Bolt Disc Mount • Tubeless Ready Double-Wall Rim',
    },
    {
      sku: 'V99-PRT-HLM-12',
      name: 'AERO-SAFE HELMET & LED KIT • 12× SETS/CTN',
      categoryId: catMap['parts-gear'],
      color: 'Slate Matte Mix',
      size: 'M/L Adjustable',
      unitsPerCarton: 12,
      isBicycle: false,
      cbm: 0.14,
      unitPrice: 680,
      costPrice: 410,
      stock: 22,
      minStock: 10,
      isNew: true,
      imageUrl: '/images/bike-parts.jpg',
      specs: 'CE EN1078 In-Mold Helmet + USB Rechargeable Front/Rear LED Set • 12 Retail Sets/Master Carton',
    },
  ];
  const prodMap: Record<string, string> = {};
  for (const p of products) {
    const row = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    prodMap[p.sku] = row.id;
  }

  // 6. FAQs
  const existingFaqs = await prisma.faqItem.count();
  if (existingFaqs === 0) {
    await prisma.faqItem.createMany({
      data: [
        {
          question: 'What is the minimum order value for online wholesale shopping?',
          answer: 'We accept online bulk orders starting from RM 500.00 (net goods value after dealer discount) and above.',
          sortOrder: 1,
        },
        {
          question: 'How do I qualify for Free Delivery?',
          answer: 'Orders above RM 500.00 whose combined carton volume reaches at least 0.50 m³ automatically unlock Free Delivery across our Peninsular Malaysia zones. Volume is calculated automatically in your cart.',
          sortOrder: 2,
        },
        {
          question: 'What is the daily cutoff time for next-working-day dispatch?',
          answer: 'The daily cutoff time is 1:00 PM. Confirmed orders placed before 1:00 PM are processed for next-working-day lorry delivery or evening hub self-pickup (6:00 PM - 10:00 PM).',
          sortOrder: 3,
        },
        {
          question: 'How do Dealer Tier Discounts and Volume Bonuses work?',
          answer: 'Approved B2B dealers receive Platinum (15% OFF), Gold (10% OFF), Silver (5% OFF), or Standard (0% OFF) pricing automatically. Ordering 10+ complete bikes adds +2% and 20+ bikes adds +3% (auto-capped at 20% OFF).',
          sortOrder: 4,
        },
        {
          question: 'Can I request a Malaysia LHDN e-Invoice?',
          answer: 'Yes. Toggle "Request Malaysia LHDN e-Invoice" during checkout and provide your Company Name and TIN. Your formal invoice is accessible immediately under Order History.',
          sortOrder: 5,
        },
        {
          question: 'What payment methods are accepted?',
          answer: 'We accept FPX Online Banking, Visa / Mastercard Credit & Debit Cards, and a 0% 3-Month SME Instalment Plan on eligible orders RM 500 and above.',
          sortOrder: 6,
        },
      ],
    });
  }

  // 7. Users (Admin, Sales, Dealers with bcrypt hashed passwords)
  const adminHash = await bcrypt.hash('admin123', 10);
  const dealerHash = await bcrypt.hash('dealer123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@velo99.my' },
    update: {},
    create: {
      email: 'admin@velo99.my',
      phone: '011-16000099',
      passwordHash: adminHash,
      name: 'Mei Ling Tan',
      companyName: 'Velo99 Wholesale HQ',
      role: 'admin',
      tier: 'platinum',
      creditLimit: 120000,
      creditUsed: 0,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sales@velo99.my' },
    update: {},
    create: {
      email: 'sales@velo99.my',
      phone: '012-3344556',
      passwordHash: dealerHash,
      name: 'Aiman Hakim (Sales Rep)',
      companyName: 'Velo99 Sales Team',
      role: 'sales',
      tier: 'gold',
      creditLimit: 60000,
      creditUsed: 0,
    },
  });

  const goldDealer = await prisma.user.upsert({
    where: { email: 'dealer@kvcycles.my' },
    update: {},
    create: {
      email: 'dealer@kvcycles.my',
      phone: '016-8899100',
      passwordHash: dealerHash,
      name: 'Jason Lim',
      companyName: 'Klang Valley Cycles Sdn Bhd',
      role: 'dealer',
      tier: 'gold',
      creditLimit: 60000,
      creditUsed: 7832,
    },
  });

  await prisma.user.upsert({
    where: { email: 'platinum@penangbikes.my' },
    update: {},
    create: {
      email: 'platinum@penangbikes.my',
      phone: '019-4455120',
      passwordHash: dealerHash,
      name: 'Faridah Zainal',
      companyName: 'Penang Pro Bike Distributors',
      role: 'dealer',
      tier: 'platinum',
      creditLimit: 120000,
      creditUsed: 18500,
    },
  });

  // 8. Sample Order, Purchase Orders & Inventory Logs
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    const centralRegion = await prisma.deliveryRegion.findUnique({ where: { code: 'central' } });
    await prisma.order.create({
      data: {
        orderNumber: 'V99-2026-4102',
        userId: goldDealer.id,
        customerName: 'Klang Valley Cycles Sdn Bhd',
        customerPhone: '016-8899100',
        customerEmail: 'dealer@kvcycles.my',
        dealerTier: 'gold',
        regionId: centralRegion?.id,
        regionName: centralRegion?.name || 'Central Region (KL & Selangor)',
        hubName: centralRegion?.hubName || 'Shah Alam Distribution Hub',
        deliveryAddress: 'No. 45, Jalan SS2/67, Petaling Jaya, Selangor',
        postcode: '47300',
        fulfillment: 'delivery',
        paymentMethod: 'instalment_3m',
        requestEInvoice: true,
        eInvoiceCompany: 'Klang Valley Cycles Sdn Bhd',
        eInvoiceTin: 'C25849102030',
        totalBikes: 10,
        totalCartons: 5,
        totalCbm: 1.8,
        discountRate: 0.12,
        subtotal: 8900,
        discountAmount: 1068,
        goodsRevenue: 7832,
        shippingFee: 0,
        totalAmount: 7832,
        totalCost: 6050,
        netProfit: 1782,
        profitMargin: 22.8,
        status: 'CONFIRMED',
        items: {
          create: [
            {
              productId: prodMap['V99-MTB29-CHR-M'],
              sku: 'V99-MTB29-CHR-M',
              productName: 'APEX TRAIL 29" ALLOY MTB • 2× UNITS/CTN',
              qty: 5,
              unitsPerCarton: 2,
              cbm: 0.36,
              unitPrice: 1780,
              costPrice: 1210,
            },
          ],
        },
      },
    });
  }

  const existingPos = await prisma.purchaseOrder.count();
  if (existingPos === 0) {
    await prisma.purchaseOrder.createMany({
      data: [
        {
          poNumber: 'PO-2026-0814',
          productId: prodMap['V99-FLD20-GRY-OS'],
          sku: 'V99-FLD20-GRY-OS',
          productName: 'METRO FOLD 20" 9-SPD COMMUTER • 2× UNITS/CTN',
          qty: 20,
          unitCost: 920,
          supplier: 'Shenzhen VeloFrame Mfg Co.',
          status: 'pending',
        },
        {
          poNumber: 'PO-2026-0809',
          productId: prodMap['V99-MTB29-CHR-M'],
          sku: 'V99-MTB29-CHR-M',
          productName: 'APEX TRAIL 29" ALLOY MTB • 2× UNITS/CTN',
          qty: 12,
          unitCost: 1210,
          supplier: 'Taichung Alloy Works Ltd.',
          status: 'received',
          receivedAt: new Date(),
        },
      ],
    });
  }

  const existingLogs = await prisma.inventoryLog.count();
  if (existingLogs === 0) {
    await prisma.inventoryLog.createMany({
      data: [
        {
          productId: prodMap['V99-MTB29-CHR-M'],
          sku: 'V99-MTB29-CHR-M',
          type: 'INBOUND',
          delta: 12,
          balanceAfter: 23,
          reference: 'PO-2026-0809',
          note: 'Supplier container received at Shah Alam Hub',
        },
        {
          productId: prodMap['V99-MTB29-CHR-M'],
          sku: 'V99-MTB29-CHR-M',
          type: 'OUTBOUND',
          delta: -5,
          balanceAfter: 18,
          reference: 'V99-2026-4102',
          note: 'Wholesale order dispatch (Klang Valley Cycles Sdn Bhd)',
        },
      ],
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
