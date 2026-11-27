'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  calculateOrderFinancials,
  DealerTierId,
  formatRM,
  getResolvedDealerTiers,
  getStockStatus,
} from '@/lib/rules';

export interface StoreSettings {
  id: string;
  brandName: string;
  tagline: string;
  logoText: string;
  supportPhone: string;
  supportEmail: string;
  supportHours: string;
  companyRegNo: string;
  footerNotice: string;
  minOrderValue: number;
  freeDeliveryCbm: number;
  standardShippingFee: number;
  rescheduleFee: number;
  cutoffHour: number;
  instalmentPromoText: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  duitNowQrUrl: string;
  whatsappOrderNumber: string;
  notifyEmail: string;
  platinumDiscountPct?: number;
  goldDiscountPct?: number;
  silverDiscountPct?: number;
  standardDiscountPct?: number;
  volumeBonus10Pct?: number;
  volumeBonus20Pct?: number;
}

export interface HeroBannerItem {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  badgeText: string;
}

export interface RegionItem {
  id: string;
  code: string;
  name: string;
  states: string;
  hubName: string;
  hubAddress: string;
  postcodePrefix: string;
  pickupHours: string;
}

export interface CategoryItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  _count: { products: number };
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: { id: string; slug: string; name: string };
  color: string;
  size: string;
  unitsPerCarton: number;
  isBicycle: boolean;
  cbm: number;
  unitPrice: number;
  costPrice?: number;
  stock: number;
  minStock: number;
  isNew: boolean;
  imageUrl: string;
  specs: string;
}

export interface UserSession {
  id: string;
  email: string;
  phone: string;
  name: string;
  companyName: string;
  role: string;
  tier: string;
  creditLimit: number;
  creditUsed: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  regionName: string;
  hubName: string;
  fulfillment: string;
  totalBikes: number;
  totalCartons: number;
  totalCbm: number;
  discountRate: number;
  totalAmount: number;
  status: string;
  requestEInvoice: boolean;
  eInvoiceTin: string;
  netProfit?: number;
  profitMargin?: number;
}

interface Props {
  initialUser: UserSession | null;
  settings: StoreSettings;
  banners: HeroBannerItem[];
  regions: RegionItem[];
  categories: CategoryItem[];
  initialProducts: ProductItem[];
  faqs: Array<{ id: string; question: string; answer: string }>;
}

const CART_STORAGE_KEY = 'velo99_live_cart_v1';

export function StorefrontClient({
  initialUser,
  settings,
  banners,
  regions,
  categories,
  initialProducts,
  faqs,
}: Props) {
  const [user, setUser] = useState<UserSession | null>(initialUser);
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [cart, setCart] = useState<Array<{ productId: string; qty: number }>>([]);
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});

  // Carousel & filters
  const [slideIdx, setSlideIdx] = useState(0);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    'featured' | 'price_asc' | 'price_desc' | 'cbm_desc' | 'stock_desc'
  >('featured');

  // Location & checkout
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regions[0]?.id || '');
  const [postcode, setPostcode] = useState<string>(regions[0]?.postcodePrefix || '40000');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<
    'bank_transfer' | 'credit_terms' | 'pay_at_hub'
  >('bank_transfer');
  const [customerName, setCustomerName] = useState(
    initialUser?.companyName || initialUser?.name || ''
  );
  const [customerPhone, setCustomerPhone] = useState(initialUser?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(initialUser?.email || '');
  const [requestEInvoice, setRequestEInvoice] = useState(false);
  const [eInvoiceCompany, setEInvoiceCompany] = useState(initialUser?.companyName || '');
  const [eInvoiceTin, setEInvoiceTin] = useState('');
  const [adminCustomDiscountPct, setAdminCustomDiscountPct] = useState('');

  // Modals & Drawers
  const [cartOpen, setCartOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [inspectProduct, setInspectProduct] = useState<ProductItem | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  // Orders & Auth form states
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [trackOrderNo, setTrackOrderNo] = useState('');
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    name: '',
    companyName: '',
    phone: '',
  });
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; kind: string }>>([]);

  // Hydrate cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Auto-advance hero banner carousel
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % banners.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [banners.length]);

  function toast(msg: string, kind: 'info' | 'success' | 'error' = 'info') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  }

  const isAdmin = user?.role === 'admin';
  const resolvedTiers = useMemo(() => getResolvedDealerTiers(settings), [settings]);
  const activeTierId = (user?.tier || 'standard') as DealerTierId;
  const activeTier = resolvedTiers[activeTierId] ?? resolvedTiers.standard;
  const activeRegion = regions.find((r) => r.id === selectedRegionId) ?? regions[0] ?? null;

  const cartLines = useMemo(() => {
    return cart
      .map((entry) => {
        const product = products.find((p) => p.id === entry.productId);
        if (!product) return null;
        return { product, qty: entry.qty };
      })
      .filter((x): x is { product: ProductItem; qty: number } => Boolean(x));
  }, [cart, products]);

  const financials = useMemo(() => {
    return calculateOrderFinancials({
      items: cartLines.map((l) => ({
        unitPrice: l.product.unitPrice,
        costPrice: l.product.costPrice ?? 0,
        qty: l.qty,
        unitsPerCarton: l.product.unitsPerCarton,
        isBicycle: l.product.isBicycle,
        cbm: l.product.cbm,
      })),
      tierId: activeTierId,
      fulfillment,
      settings: {
        minOrderValue: settings.minOrderValue,
        freeDeliveryCbm: settings.freeDeliveryCbm,
        standardShippingFee: settings.standardShippingFee,
        platinumDiscountPct: settings.platinumDiscountPct,
        goldDiscountPct: settings.goldDiscountPct,
        silverDiscountPct: settings.silverDiscountPct,
        standardDiscountPct: settings.standardDiscountPct,
        volumeBonus10Pct: settings.volumeBonus10Pct,
        volumeBonus20Pct: settings.volumeBonus20Pct,
      },
      adminCustomDiscountRate:
        isAdmin && adminCustomDiscountPct !== ''
          ? Number(adminCustomDiscountPct) / 100
          : null,
    });
  }, [cartLines, activeTierId, fulfillment, settings, isAdmin, adminCustomDiscountPct]);

  const instantSearchResults = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return products
      .filter((p) => {
        const hay = `${p.name} ${p.sku} ${p.category.name} ${p.color} ${p.size} ${p.specs}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      })
      .slice(0, 6);
  }, [products, searchQuery]);

  const filteredProducts = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (activeCategoryId !== 'all' && p.categoryId !== activeCategoryId) return false;
      if (newOnly && !p.isNew) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (tokens.length > 0) {
        const hay = `${p.name} ${p.sku} ${p.category.name} ${p.color} ${p.size} ${p.specs}`.toLowerCase();
        if (!tokens.every((tok) => hay.includes(tok))) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') sorted.sort((a, b) => a.unitPrice - b.unitPrice);
    else if (sortBy === 'price_desc') sorted.sort((a, b) => b.unitPrice - a.unitPrice);
    else if (sortBy === 'cbm_desc') sorted.sort((a, b) => b.cbm - a.cbm);
    else if (sortBy === 'stock_desc') sorted.sort((a, b) => b.stock - a.stock);
    return sorted;
  }, [products, activeCategoryId, newOnly, inStockOnly, searchQuery, sortBy]);

  const newArrivals = useMemo(() => products.filter((p) => p.isNew).slice(0, 6), [products]);
  const criticalCount = useMemo(
    () => products.filter((p) => getStockStatus(p.stock, p.minStock) === 'CRITICAL').length,
    [products]
  );

  async function refreshStorefront() {
    const res = await fetch('/api/storefront', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
      setUser(data.user || null);
      if (data.user) {
        setCustomerName(data.user.companyName || data.user.name);
        setCustomerPhone(data.user.phone || '');
        setCustomerEmail(data.user.email || '');
        setEInvoiceCompany(data.user.companyName || '');
      }
    }
  }

  function addToCart(product: ProductItem, qtyToAdd: number) {
    const qty = Math.max(1, Math.floor(qtyToAdd || 1));
    const existing = cart.find((c) => c.productId === product.id);
    const nextQty = (existing ? existing.qty : 0) + qty;
    if (nextQty > product.stock) {
      toast(
        `Insufficient stock — Only ${product.stock} carton(s) available for ${product.sku}`,
        'error'
      );
      return;
    }
    setCart((prev) =>
      existing
        ? prev.map((c) => (c.productId === product.id ? { ...c, qty: nextQty } : c))
        : [...prev, { productId: product.id, qty }]
    );
    toast(`Added ${qty}× carton (${product.sku}) to wholesale cart`, 'success');
  }

  function updateCartQty(product: ProductItem, nextQty: number) {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.productId !== product.id));
      return;
    }
    if (nextQty > product.stock) {
      toast(`Insufficient stock — Max ${product.stock} carton(s) available`, 'error');
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.productId === product.id ? { ...c, qty: nextQty } : c))
    );
  }

  async function handleCheckout() {
    if (!activeRegion) {
      toast('Please select a delivery region first.', 'error');
      setLocationOpen(true);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast('Please enter recipient name / company and phone number.', 'error');
      return;
    }
    if (fulfillment === 'delivery' && !deliveryAddress.trim()) {
      toast('Please enter your delivery street address.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartLines.map((l) => ({
            productId: l.product.id,
            sku: l.product.sku,
            qty: l.qty,
          })),
          regionId: activeRegion.id,
          postcode,
          deliveryAddress,
          fulfillment,
          paymentMethod,
          customerName,
          customerPhone,
          customerEmail,
          requestEInvoice,
          eInvoiceCompany,
          eInvoiceTin,
          adminCustomDiscountPct: isAdmin ? adminCustomDiscountPct : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Checkout failed.', 'error');
        return;
      }
      setCart([]);
      setCartOpen(false);
      setAdminCustomDiscountPct('');
      setConfirmedOrder(data.order);
      await refreshStorefront();
      toast(`Order ${data.order.orderNumber} confirmed!`, 'success');
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const endpoint = authModalMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Authentication failed.', 'error');
        return;
      }
      setAuthModalMode(null);
      setAuthForm({ email: '', password: '', name: '', companyName: '', phone: '' });
      await refreshStorefront();
      toast(`Welcome, ${data.user.name}!`, 'success');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    await refreshStorefront();
    toast('Signed out.', 'info');
  }

  async function openOrdersModal(searchNum?: string) {
    setOrdersModalOpen(true);
    const url = searchNum
      ? `/api/orders?orderNumber=${encodeURIComponent(searchNum)}`
      : '/api/orders';
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
    }
  }

  const cutoffDisplay =
    settings.cutoffHour === 12
      ? '12:00 PM'
      : settings.cutoffHour > 12
      ? `${settings.cutoffHour - 12}:00 PM`
      : `${settings.cutoffHour}:00 AM`;

  const currentBanner = banners[slideIdx] || banners[0];

  return (
    <div>
      {/* Admin Critical Stock Banner */}
      {isAdmin && criticalCount > 0 && (
        <div className="critical-banner">
          <div
            className="container"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <span>
              CRITICAL STOCK ALERT: {criticalCount} SKU(s) are critically low or out of stock.
              Overselling is blocked automatically.
            </span>
            <Link
              href="/admin"
              className="btn btn-sm"
              style={{ background: '#fff', color: 'var(--error)' }}
            >
              Open Admin Restock Queue &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Top Utility Strip */}
      <div className="utility-bar">
        <div className="utility-inner">
          <div className="cutoff-pill">
            <span>&#9200;</span>
            <span>
              {cutoffDisplay} Daily Cutoff &bull; Next-Working-Day Dispatch &bull;{' '}
              {settings.instalmentPromoText}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span>
              {settings.supportPhone} &bull; {settings.supportHours}
            </span>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#fff', fontWeight: 700 }}>
                  {user.companyName || user.name} ({user.role.toUpperCase()})
                </span>
                {isAdmin && (
                  <Link
                    href="/admin"
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontWeight: 700,
                    }}
                  >
                    Admin CMS
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.28)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Dealer / Admin Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('register')}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Register B2B
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header className="site-header">
        <div className="header-inner">
          <a href="#top" className="brand">
            <div className="brand-mark">{settings.logoText}</div>
            <div className="brand-text">
              <strong>{settings.brandName}</strong>
              <span>{settings.tagline}</span>
            </div>
          </a>

          <nav className="header-links" aria-label="Primary">
            <a href="#categories" className="nav-link">
              Categories
            </a>
            <a href="#new-arrivals" className="nav-link">
              New in Bulksales
            </a>
            <a href="#catalog" className="nav-link">
              All Cartons
            </a>
            <a href="#how-it-works" className="nav-link">
              How It Works
            </a>
            <a href="#faqs" className="nav-link">
              FAQs
            </a>
            <button
              type="button"
              className="nav-link"
              onClick={() => openOrdersModal()}
            >
              Order History
            </button>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`tier-pill ${activeTierId}`}>
              {isAdmin
                ? 'Admin (25% Cap + Profit)'
                : user
                ? `${activeTier.label} (${Math.round(activeTier.discountRate * 100)}% OFF)`
                : 'Guest B2B (0% OFF)'}
            </span>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => setCartOpen(true)}
            >
              <span>Cart</span>
              <span
                className="mono"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  padding: '1px 7px',
                  borderRadius: 999,
                  fontSize: '0.76rem',
                }}
              >
                {financials.totalCartons}
              </span>
            </button>
          </div>
        </div>

        {/* Prominent Global Product Search Bar (99bulksales.my style + live instant results) */}
        <div className="header-search-bar">
          <div className="header-search-inner">
            <form
              className="header-search-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSearchFocused(false);
                setActiveCategoryId('all');
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--ink-muted)', fontSize: '0.95rem' }}>
                &#128269;
              </span>
              <input
                type="search"
                className="header-search-input"
                aria-label="Search bicycles, models, wheel sizes, parts, or SKUs"
                placeholder='Search bicycles, wheel sizes, parts, or SKU (e.g. "29 MTB", "folding", "helmet", "V99-RD700")...'
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  &times;
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm">
                Search
              </button>
            </form>

            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="search-dropdown" role="listbox">
                {instantSearchResults.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
                    No matching cartons found for &ldquo;<strong>{searchQuery}</strong>&rdquo;. Try searching by model, wheel size, or SKU.
                  </div>
                ) : (
                  <>
                    {instantSearchResults.map((p) => {
                      const st = getStockStatus(p.stock, p.minStock);
                      return (
                        <div key={p.id} className="search-result-row">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 7, cursor: 'pointer' }}
                            onMouseDown={() => {
                              setSearchFocused(false);
                              setInspectProduct(p);
                            }}
                          />
                          <div
                            style={{ minWidth: 0, cursor: 'pointer' }}
                            onMouseDown={() => {
                              setSearchFocused(false);
                              setInspectProduct(p);
                            }}
                          >
                            <div style={{ fontSize: '0.84rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className="mono">{p.sku}</span>
                              <span>&bull; {p.cbm.toFixed(2)} m&sup3;</span>
                              <span className={`stock-pill ${st}`} style={{ padding: '1px 7px' }}>
                                {st} ({p.stock})
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <strong className="mono" style={{ fontSize: '0.88rem' }}>
                              {formatRM(p.unitPrice)}
                            </strong>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={p.stock === 0}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addToCart(p, 1);
                              }}
                            >
                              {p.stock === 0 ? 'Out' : '+ Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ padding: '9px 14px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--ink-muted)' }}>
                        Showing {instantSearchResults.length} of {filteredProducts.length} matching carton(s)
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onMouseDown={() => {
                          setSearchFocused(false);
                          setActiveCategoryId('all');
                          document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        View all in Catalog &darr;
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 99bulksales.my Signature Location + Dual Threshold Progress Bar */}
        <div className="threshold-strip">
          <div className="threshold-grid">
            <div className={`location-card ${!activeRegion ? 'warn' : ''}`}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: 'var(--ink-muted)',
                  }}
                >
                  Delivery Zone &amp; Pickup Hub
                </div>
                <div
                  style={{
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeRegion
                    ? `${activeRegion.name} • ${activeRegion.hubName} (${postcode})`
                    : 'Select your delivery zone & postcode to continue'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLocationOpen(true)}
              >
                Change
              </button>
            </div>

            <div className="progress-box">
              <div className="progress-head">
                <span>Self-Pickup (&ge; {formatRM(settings.minOrderValue)})</span>
                <span
                  className="mono"
                  style={{ color: financials.qualifiesMov ? 'var(--success)' : 'var(--primary)' }}
                >
                  {financials.pickupPct}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${financials.qualifiesMov ? 'done' : ''}`}
                  style={{ width: `${financials.pickupPct}%` }}
                />
              </div>
              <div className="progress-sub">
                <span>Hub Pickup ({activeRegion?.pickupHours || '6 PM - 10 PM'})</span>
                <span className="mono">
                  {formatRM(financials.goodsRevenue)} / {formatRM(settings.minOrderValue)}
                </span>
              </div>
            </div>

            <div className="progress-box">
              <div className="progress-head">
                <span>
                  Free Delivery (&ge; {formatRM(settings.minOrderValue)} &amp; &ge;{' '}
                  {settings.freeDeliveryCbm.toFixed(2)} m&sup3;)
                </span>
                <span
                  className="mono"
                  style={{
                    color: financials.qualifiesFreeDelivery ? 'var(--success)' : 'var(--primary)',
                  }}
                >
                  {financials.freeDeliveryPct}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${financials.qualifiesFreeDelivery ? 'done' : ''}`}
                  style={{ width: `${financials.freeDeliveryPct}%` }}
                />
              </div>
              <div className="progress-sub">
                <span>Live Carton Volume (CBM)</span>
                <span className="mono">
                  {financials.totalCbm.toFixed(2)} / {settings.freeDeliveryCbm.toFixed(2)} m&sup3;
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Banner Carousel (Editable in /admin) */}
        {currentBanner && (
          <section className="hero-section">
            <div className="container">
              <div className="hero-card">
                <div className="hero-copy">
                  <div className="hero-eyebrow">{currentBanner.eyebrow}</div>
                  <h1>{currentBanner.title}</h1>
                  <p>{currentBanner.subtitle}</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a href={currentBanner.ctaHref} className="btn btn-primary">
                      {currentBanner.ctaLabel}
                    </a>
                  </div>
                  {banners.length > 1 && (
                    <div className="carousel-dots" aria-label="Banner slides">
                      {banners.map((b, idx) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`carousel-dot ${idx === slideIdx ? 'active' : ''}`}
                          onClick={() => setSlideIdx(idx)}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="hero-media">
                  <img src={currentBanner.imageUrl} alt={currentBanner.title} />
                  <div className="hero-caption">
                    <div>
                      <strong style={{ color: '#fde68a', display: 'block' }}>
                        {currentBanner.badgeText}
                      </strong>
                      <span>{settings.instalmentPromoText}</span>
                    </div>
                    <span className="mono" style={{ whiteSpace: 'nowrap' }}>
                      MIN {formatRM(settings.minOrderValue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Visual Categories Grid (99bulksales.my style) */}
        <section id="categories" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Shop by Category</h2>
                <p>Select a category to filter wholesale bicycle cartons and master packs.</p>
              </div>
              {activeCategoryId !== 'all' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveCategoryId('all')}
                >
                  Show All Categories
                </button>
              )}
            </div>
            <div className="category-grid">
              <button
                type="button"
                className={`cat-tile ${activeCategoryId === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategoryId('all')}
              >
                <img src="/images/hero-warehouse.jpg" alt="All wholesale categories" />
                <div className="cat-tile-body">
                  <strong>All Bulk Stock</strong>
                  <span className="mono">{products.length} SKUs available</span>
                </div>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-tile ${activeCategoryId === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <img src={cat.imageUrl} alt={cat.name} />
                  <div className="cat-tile-body">
                    <strong>{cat.name}</strong>
                    <span className="mono">{cat._count.products} SKUs</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* New in Bulksales Strip */}
        {newArrivals.length > 0 && (
          <section id="new-arrivals" className="section" style={{ paddingTop: 6 }}>
            <div className="container">
              <div className="section-head">
                <div>
                  <h2>New in Bulksales</h2>
                  <p>Latest container arrivals ready for next-working-day hub dispatch.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setNewOnly(true);
                    setActiveCategoryId('all');
                    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Filter New Arrivals Only
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {newArrivals.map((p) => (
                  <div
                    key={p.id}
                    className="card"
                    style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      style={{
                        width: '100%',
                        aspectRatio: '4/3',
                        objectFit: 'cover',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                      onClick={() => setInspectProduct(p)}
                    />
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.25 }}>
                      {p.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 'auto',
                      }}
                    >
                      <strong className="mono" style={{ color: 'var(--primary)' }}>
                        {formatRM(p.unitPrice)}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={p.stock === 0}
                        onClick={() => addToCart(p, 1)}
                      >
                        {p.stock === 0 ? 'Out' : '+ Add'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Full Wholesale Catalog */}
        <section id="catalog" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Wholesale Carton Catalog</h2>
                <p>
                  All complete bikes packed 85% SKD in factory cartons. Live stock validation
                  prevents overselling.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                  />
                  In stock only
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newOnly}
                    onChange={(e) => setNewOnly(e.target.checked)}
                  />
                  New only
                </label>
                <select
                  className="field-select"
                  aria-label="Sort wholesale catalog"
                  style={{ width: 190 }}
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as
                        | 'featured'
                        | 'price_asc'
                        | 'price_desc'
                        | 'cbm_desc'
                        | 'stock_desc'
                    )
                  }
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="cbm_desc">Volume (CBM): High to Low</option>
                  <option value="stock_desc">Stock: High to Low</option>
                </select>
                <input
                  type="search"
                  className="field-input"
                  style={{ width: 250 }}
                  placeholder="Filter by model, size, or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {(searchQuery.trim() || activeCategoryId !== 'all' || newOnly || inStockOnly) && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 14,
                  padding: '9px 13px',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '0.82rem',
                }}
              >
                <span>
                  Showing <strong className="mono">{filteredProducts.length}</strong> wholesale
                  carton(s)
                  {searchQuery.trim() ? (
                    <>
                      {' '}
                      matching &ldquo;<strong>{searchQuery.trim()}</strong>&rdquo;
                    </>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategoryId('all');
                    setNewOnly(false);
                    setInStockOnly(false);
                    setSortBy('featured');
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}

            <div className="product-grid">
              {filteredProducts.length === 0 ? (
                <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px 20px' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1rem' }}>
                    No wholesale cartons match your search
                  </p>
                  <p style={{ margin: '0 0 14px', fontSize: '0.86rem', color: 'var(--ink-muted)' }}>
                    Try a shorter keyword (e.g. &ldquo;MTB&rdquo;, &ldquo;20&rdquo;, &ldquo;Road&rdquo;, &ldquo;Helmet&rdquo;) or reset your filters.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategoryId('all');
                      setNewOnly(false);
                      setInStockOnly(false);
                    }}
                  >
                    Reset Search &amp; Show All Cartons
                  </button>
                </div>
              ) : null}
              {filteredProducts.map((p) => {
                const status = getStockStatus(p.stock, p.minStock);
                const netPrice = Number((p.unitPrice * (1 - activeTier.discountRate)).toFixed(2));
                const qtyVal = qtyDraft[p.id] ?? 1;
                const inCart = cart.find((c) => c.productId === p.id)?.qty || 0;

                return (
                  <article key={p.id} className="product-card">
                    <div className="product-media" onClick={() => setInspectProduct(p)}>
                      <img src={p.imageUrl} alt={p.name} loading="lazy" />
                      <div className="card-badges">
                        <span className={`stock-pill ${status}`}>
                          {status} &bull; {p.stock} ctn
                        </span>
                        <span className="cbm-pill mono">{p.cbm.toFixed(2)} m&sup3;</span>
                      </div>
                    </div>
                    <div className="product-body">
                      <div
                        className="mono"
                        style={{ fontSize: '0.7rem', color: 'var(--ink-subtle)' }}
                      >
                        {p.sku} &bull; {p.category.name}
                      </div>
                      <h3
                        style={{
                          margin: '4px 0 5px',
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          lineHeight: 1.3,
                          cursor: 'pointer',
                        }}
                        onClick={() => setInspectProduct(p)}
                      >
                        {p.name}
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginBottom: 10 }}>
                        {p.color} &bull; {p.size} &bull; {p.unitsPerCarton}{' '}
                        {p.isBicycle ? 'bikes' : 'sets'}/carton
                      </div>

                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: 10,
                          borderTop: '1px solid var(--border)',
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                          }}
                        >
                          <strong className="mono" style={{ fontSize: '1.12rem' }}>
                            {formatRM(p.unitPrice)}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                            / carton
                          </span>
                        </div>
                        {activeTier.discountRate > 0 ? (
                          <div
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: 'var(--accent)',
                              marginTop: 2,
                            }}
                          >
                            Your {activeTier.label} Net:{' '}
                            <span className="mono">{formatRM(netPrice)}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                            Order 10+ bikes for +2% volume bonus
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <div className="qty-stepper">
                          <button
                            type="button"
                            onClick={() =>
                              setQtyDraft((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, (prev[p.id] ?? 1) - 1),
                              }))
                            }
                          >
                            &minus;
                          </button>
                          <input
                            type="number"
                            className="mono"
                            min={1}
                            max={Math.max(1, p.stock)}
                            value={qtyVal}
                            onChange={(e) =>
                              setQtyDraft((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, Number(e.target.value) || 1),
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setQtyDraft((prev) => ({
                                ...prev,
                                [p.id]: Math.min(Math.max(1, p.stock), (prev[p.id] ?? 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '8px 10px' }}
                          disabled={p.stock === 0}
                          onClick={() => addToCart(p, qtyVal)}
                        >
                          {p.stock === 0
                            ? 'Out of Stock'
                            : inCart > 0
                            ? `Add (${inCart} in cart)`
                            : 'Add Carton'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>How {settings.brandName} Works</h2>
                <p>
                  Open to bike retailers, rental operators, and bulk buyers starting from{' '}
                  {formatRM(settings.minOrderValue)}.
                </p>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
              }}
            >
              {[
                {
                  n: '01',
                  t: 'Browse & add cartons',
                  d: `Add complete SKD bicycle cartons or parts packs and watch your ${formatRM(settings.minOrderValue)} & ${settings.freeDeliveryCbm.toFixed(2)} m³ bars climb live.`,
                },
                {
                  n: '02',
                  t: 'Pick your delivery zone',
                  d: 'Choose your Peninsular Malaysia region & postcode to verify regional stock and nearest self-pickup hub.',
                },
                {
                  n: '03',
                  t: 'Check out with B2B terms',
                  d: 'Unlock Free Delivery or Hub Self-Pickup, apply dealer tier discounts, and pay via FPX, Card, or 0% 3-Month SME Plan.',
                },
                {
                  n: '04',
                  t: 'Next-working-day dispatch',
                  d: `Orders confirmed before ${cutoffDisplay} daily ship next working day. Show your Order ID on arrival or hub pickup.`,
                },
              ].map((s) => (
                <div key={s.n} className="card">
                  <div
                    className="mono"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      marginBottom: 10,
                    }}
                  >
                    {s.n}
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '0.96rem' }}>{s.t}</h3>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ink-muted)' }}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs (Editable in /admin) */}
        <section id="faqs" className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Common Questions</h2>
                <p>Everything you need to know about bulk orders, delivery volume, and invoices.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {faqs.map((f, idx) => (
                <details key={f.id} className="faq-item" open={idx === 0}>
                  <summary>{f.question}</summary>
                  <div className="faq-body">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <h4 style={{ color: '#fff', margin: '0 0 8px' }}>{settings.brandName}</h4>
              <p style={{ margin: 0 }}>{settings.footerNotice}</p>
              <p style={{ marginTop: 10, fontSize: '0.78rem', color: '#94a3b8' }}>
                {settings.companyRegNo}
              </p>
            </div>
            <div>
              <h4 style={{ color: '#fff', margin: '0 0 8px' }}>Customer Service</h4>
              <p className="mono" style={{ margin: 0 }}>
                {settings.supportPhone}
                <br />
                {settings.supportEmail}
                <br />
                {settings.supportHours}
              </p>
            </div>
            <div>
              <h4 style={{ color: '#fff', margin: '0 0 8px' }}>Wholesale Terms</h4>
              <p style={{ margin: 0 }}>
                Min Order: {formatRM(settings.minOrderValue)}
                <br />
                Free Delivery: &ge; {formatRM(settings.minOrderValue)} &amp; &ge;{' '}
                {settings.freeDeliveryCbm.toFixed(2)} m&sup3;
                <br />
                Daily Cutoff: {cutoffDisplay}
                <br />
                Redelivery Fee: {formatRM(settings.rescheduleFee)}
              </p>
            </div>
          </div>
          <div
            style={{
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: '0.78rem',
              color: '#94a3b8',
            }}
          >
            <span>&copy; {new Date().getFullYear()} {settings.brandName}. All rights reserved.</span>
            <Link href="/admin" style={{ color: '#fde68a', fontWeight: 700 }}>
              Store Owner Admin CMS &rarr;
            </Link>
          </div>
        </div>
      </footer>

      {/* ==================== CART & CHECKOUT DRAWER ==================== */}
      {cartOpen && (
        <div className="backdrop drawer" onClick={() => setCartOpen(false)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0, fontSize: '1.02rem' }}>Wholesale Cart &amp; Checkout</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCartOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="panel-body">
              {cartLines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '44px 12px', color: 'var(--ink-muted)' }}>
                  <p style={{ fontWeight: 700, color: 'var(--ink)' }}>Your wholesale cart is empty</p>
                  <p style={{ fontSize: '0.84rem' }}>
                    Add bicycle cartons to build your {formatRM(settings.minOrderValue)} and{' '}
                    {settings.freeDeliveryCbm.toFixed(2)} m&sup3; Free Delivery basket.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    {cartLines.map(({ product, qty }) => (
                      <div
                        key={product.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '54px 1fr auto',
                          gap: 10,
                          padding: '10px 0',
                          borderBottom: '1px solid var(--border)',
                          alignItems: 'center',
                        }}
                      >
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 7 }}
                        />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.25 }}>
                            {product.name}
                          </div>
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                            {product.sku} &bull; {(product.cbm * qty).toFixed(2)} m&sup3; &bull;
                            Stock: {product.stock}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="qty-stepper" style={{ marginBottom: 4 }}>
                            <button
                              type="button"
                              onClick={() => updateCartQty(product, qty - 1)}
                            >
                              &minus;
                            </button>
                            <input type="number" readOnly value={qty} className="mono" />
                            <button
                              type="button"
                              onClick={() => updateCartQty(product, qty + 1)}
                            >
                              +
                            </button>
                          </div>
                          <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                            {formatRM(product.unitPrice * qty)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Checkout details */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setFulfillment('delivery')}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 9,
                          border: `1.5px solid ${fulfillment === 'delivery' ? 'var(--primary)' : 'var(--border-strong)'}`,
                          background: fulfillment === 'delivery' ? 'var(--primary-soft)' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.82rem' }}>Lorry Delivery</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                          {financials.qualifiesFreeDelivery
                            ? 'FREE (Qualified!)'
                            : `${formatRM(settings.standardShippingFee)} (< ${settings.freeDeliveryCbm}m³)`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillment('pickup')}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 9,
                          border: `1.5px solid ${fulfillment === 'pickup' ? 'var(--primary)' : 'var(--border-strong)'}`,
                          background: fulfillment === 'pickup' ? 'var(--primary-soft)' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.82rem' }}>
                          Hub Self-Pickup
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                          FREE &bull; {activeRegion?.hubName}
                        </span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="field-group">
                        <label className="field-label">Buyer / Company Name *</label>
                        <input
                          className="field-input"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Kedai Basikal Sdn Bhd"
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Mobile Phone *</label>
                        <input
                          className="field-input"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="012-3456789"
                        />
                      </div>
                    </div>

                    {fulfillment === 'delivery' && (
                      <div className="field-group">
                        <label className="field-label">
                          Delivery Street Address ({activeRegion?.name} &bull; {postcode}) *
                        </label>
                        <input
                          className="field-input"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Lot / Street / Taman / City"
                        />
                      </div>
                    )}

                    <div className="field-group">
                      <label className="field-label">Payment Method</label>
                      <select
                        className="field-select"
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value as 'bank_transfer' | 'credit_terms' | 'pay_at_hub'
                          )
                        }
                      >
                        <option value="bank_transfer">
                          Online Bank Transfer / DuitNow QR (Manual Verification)
                        </option>
                        <option value="credit_terms">
                          Approved Dealer Credit Terms (Net 30)
                        </option>
                        <option value="pay_at_hub">
                          Pay Upon Hub Self-Pickup (Cash / DuitNow QR)
                        </option>
                      </select>
                    </div>

                    {paymentMethod === 'bank_transfer' && (
                      <div
                        style={{
                          padding: 10,
                          borderRadius: 9,
                          background: '#fff',
                          border: '1px solid var(--border)',
                          fontSize: '0.76rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--ink)' }}>
                            {settings.bankName} &bull;{' '}
                            <span className="mono">{settings.bankAccountNumber}</span>
                          </div>
                          <div style={{ color: 'var(--ink-muted)' }}>{settings.bankAccountName}</div>
                          <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                            After placing order, tap WhatsApp to send your transfer slip.
                          </div>
                        </div>
                        {settings.duitNowQrUrl && (
                          <img
                            src={settings.duitNowQrUrl}
                            alt="DuitNow QR"
                            style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 6 }}
                          />
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="field-group">
                        <label className="field-label">
                          Admin Discount Override % (Max 25%, auto{' '}
                          {Math.round(financials.autoDiscountRate * 100)}%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={25}
                          step={0.5}
                          className="field-input mono"
                          value={adminCustomDiscountPct}
                          onChange={(e) => setAdminCustomDiscountPct(e.target.value)}
                          placeholder={String(Math.round(financials.autoDiscountRate * 100))}
                        />
                      </div>
                    )}

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={requestEInvoice}
                        onChange={(e) => setRequestEInvoice(e.target.checked)}
                      />
                      Request Malaysia LHDN e-Invoice (TIN)
                    </label>
                    {requestEInvoice && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input
                          className="field-input"
                          placeholder="Company Name Sdn Bhd"
                          value={eInvoiceCompany}
                          onChange={(e) => setEInvoiceCompany(e.target.value)}
                        />
                        <input
                          className="field-input mono"
                          placeholder="TIN (e.g. C25849102030)"
                          value={eInvoiceTin}
                          onChange={(e) => setEInvoiceTin(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div
                      style={{
                        display: 'grid',
                        gap: 5,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.83rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cartons / Bikes / Volume</span>
                        <span className="mono">
                          {financials.totalCartons} ctn &bull; {financials.totalBikes} bikes &bull;{' '}
                          {financials.totalCbm.toFixed(2)} m&sup3;
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Wholesale Subtotal</span>
                        <span className="mono">{formatRM(financials.subtotal)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: 'var(--accent)',
                        }}
                      >
                        <span>
                          Discount ({Math.round(financials.discountRate * 100)}%
                          {financials.volumeBonus > 0
                            ? ` incl. +${Math.round(financials.volumeBonus * 100)}% vol`
                            : ''}
                          )
                        </span>
                        <span className="mono">&minus; {formatRM(financials.discountAmount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Shipping / Logistics</span>
                        <span className="mono">
                          {financials.shippingFee === 0
                            ? 'FREE'
                            : formatRM(financials.shippingFee)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 800,
                          fontSize: '1.02rem',
                          paddingTop: 6,
                          borderTop: '1px dashed var(--border-strong)',
                        }}
                      >
                        <span>Total Receivable</span>
                        <span className="mono">{formatRM(financials.totalAmount)}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div
                        style={{
                          background: '#15181e',
                          color: '#f1f5f9',
                          padding: 11,
                          borderRadius: 10,
                          fontSize: '0.77rem',
                          display: 'grid',
                          gap: 4,
                        }}
                      >
                        <strong style={{ color: '#fde68a' }}>
                          ADMIN PROFIT PREVIEW (Hidden from Dealers &amp; Sales)
                        </strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total COGS:</span>
                          <span className="mono">{formatRM(financials.totalCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Net Profit &amp; Margin:</span>
                          <span
                            className="mono"
                            style={{
                              color: financials.netProfit >= 0 ? '#4ade80' : '#f87171',
                              fontWeight: 700,
                            }}
                          >
                            {formatRM(financials.netProfit)} ({financials.profitMargin}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {cartLines.length > 0 && (
              <div className="panel-foot">
                {!financials.qualifiesMov && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--warning)',
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    Add {formatRM(settings.minOrderValue - financials.goodsRevenue)} more to reach{' '}
                    {formatRM(settings.minOrderValue)} minimum order value.
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={!financials.qualifiesMov || busy}
                  onClick={handleCheckout}
                >
                  {busy
                    ? 'Processing Order...'
                    : `Confirm Wholesale Order • ${formatRM(financials.totalAmount)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== LOCATION MODAL ==================== */}
      {locationOpen && (
        <div className="backdrop" onClick={() => setLocationOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>Select Delivery Region &amp; Pickup Hub</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLocationOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              <div className="field-group">
                <label className="field-label">Postcode (5 digits)</label>
                <input
                  className="field-input mono"
                  maxLength={5}
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {regions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRegionId(r.id);
                      setPostcode(r.postcodePrefix);
                      setLocationOpen(false);
                      toast(`Delivery zone set to ${r.name}`, 'success');
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: `1.5px solid ${selectedRegionId === r.id ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedRegionId === r.id ? 'var(--primary-soft)' : '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>{r.name}</strong>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                      States: {r.states}
                      <br />
                      Hub: {r.hubName} ({r.pickupHours})
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LOGIN / REGISTER MODAL ==================== */}
      {authModalMode && (
        <div className="backdrop" onClick={() => setAuthModalMode(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {authModalMode === 'login' ? 'Dealer / Admin Sign In' : 'Register B2B Account'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAuthModalMode(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: 12 }}>
              {authModalMode === 'register' && (
                <>
                  <div className="field-group">
                    <label className="field-label">Full Name *</label>
                    <input
                      required
                      className="field-input"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Bike Shop / Company Name</label>
                    <input
                      className="field-input"
                      value={authForm.companyName}
                      onChange={(e) => setAuthForm({ ...authForm, companyName: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Mobile Phone</label>
                    <input
                      className="field-input"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="field-group">
                <label className="field-label">Email *</label>
                <input
                  required
                  type="email"
                  className="field-input"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Password *</label>
                <input
                  required
                  type="password"
                  className="field-input"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy
                  ? 'Please wait...'
                  : authModalMode === 'login'
                  ? 'Sign In'
                  : 'Create B2B Account'}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setAuthModalMode(authModalMode === 'login' ? 'register' : 'login')
                }
              >
                {authModalMode === 'login'
                  ? 'Need a B2B dealer account? Register'
                  : 'Already have an account? Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ORDER HISTORY / TRACK MODAL ==================== */}
      {ordersModalOpen && (
        <div className="backdrop" onClick={() => setOrdersModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>Order History &amp; Guest Order Lookup</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOrdersModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="field-input mono"
                  placeholder="Track by Order ID (e.g. V99-2026-4102)"
                  value={trackOrderNo}
                  onChange={(e) => setTrackOrderNo(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openOrdersModal(trackOrderNo)}
                >
                  Track
                </button>
              </div>
              {orders.length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', padding: '12px 0' }}>
                  No orders found. Sign in to view your dealer history or enter an Order ID above.
                </div>
              ) : (
                orders.map((ord) => (
                  <div key={ord.id} className="card" style={{ padding: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <strong className="mono" style={{ color: 'var(--primary)' }}>
                          {ord.orderNumber}
                        </strong>
                        <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginLeft: 8 }}>
                          {new Date(ord.createdAt).toLocaleString('en-MY')}
                        </span>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, marginTop: 2 }}>
                          {ord.customerName} &bull; {ord.status}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                          {ord.fulfillment === 'pickup' ? `Self-Pickup (${ord.hubName})` : ord.regionName}{' '}
                          &bull; {ord.totalCartons} ctn / {ord.totalCbm.toFixed(2)} m&sup3;
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong className="mono" style={{ fontSize: '1rem' }}>
                          {formatRM(ord.totalAmount)}
                        </strong>
                        <div style={{ marginTop: 6 }}>
                          <Link
                            href={`/invoice/${ord.orderNumber}`}
                            className="btn btn-secondary btn-sm"
                          >
                            View / Print Invoice
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ORDER CONFIRMATION MODAL ==================== */}
      {confirmedOrder && (
        <div className="backdrop" onClick={() => setConfirmedOrder(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0, color: 'var(--success)' }}>Order Confirmed!</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmedOrder(null)}
              >
                &times;
              </button>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                Show your Order ID upon lorry delivery or hub self-pickup:
              </p>
              <div
                className="mono"
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  padding: 14,
                  background: 'var(--success-soft)',
                  color: 'var(--success)',
                  borderRadius: 10,
                }}
              >
                {confirmedOrder.orderNumber}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
                Total Payable: <strong className="mono">{formatRM(confirmedOrder.totalAmount)}</strong>{' '}
                &bull; Volume: <strong className="mono">{confirmedOrder.totalCbm.toFixed(2)} m&sup3;</strong>
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>Manual Transfer Details</div>
                  <div>{settings.bankName}</div>
                  <div className="mono" style={{ fontWeight: 800 }}>
                    {settings.bankAccountNumber}
                  </div>
                  <div style={{ color: 'var(--ink-muted)' }}>{settings.bankAccountName}</div>
                </div>
                {settings.duitNowQrUrl && (
                  <img
                    src={settings.duitNowQrUrl}
                    alt="DuitNow QR"
                    style={{ width: 88, height: 88, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }}
                  />
                )}
              </div>
              {settings.whatsappOrderNumber && (
                <a
                  href={`https://wa.me/${settings.whatsappOrderNumber}?text=${encodeURIComponent(
                    `Hi ${settings.brandName}, I have placed wholesale order ${confirmedOrder.orderNumber} (${formatRM(
                      confirmedOrder.totalAmount
                    )}) for ${confirmedOrder.customerName}. Here is my payment slip.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success"
                  style={{ width: '100%' }}
                >
                  Send Payment Slip via WhatsApp
                </a>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <Link
                  href={`/invoice/${confirmedOrder.orderNumber}`}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Open Printable Invoice
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmedOrder(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PRODUCT DETAIL MODAL ==================== */}
      {inspectProduct && (
        <div className="backdrop" onClick={() => setInspectProduct(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{inspectProduct.name}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setInspectProduct(null)}
              >
                &times;
              </button>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              <img
                src={inspectProduct.imageUrl}
                alt={inspectProduct.name}
                style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  SKU: {inspectProduct.sku} &bull; {inspectProduct.color} &bull; {inspectProduct.size}
                </span>
                <span
                  className={`stock-pill ${getStockStatus(inspectProduct.stock, inspectProduct.minStock)}`}
                >
                  {getStockStatus(inspectProduct.stock, inspectProduct.minStock)} ({inspectProduct.stock} ctn)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-muted)' }}>
                {inspectProduct.specs}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  background: 'var(--bg)',
                  padding: 12,
                  borderRadius: 10,
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  Packing: <strong>{inspectProduct.unitsPerCarton} units/carton</strong>
                </div>
                <div>
                  Volume: <strong className="mono">{inspectProduct.cbm.toFixed(2)} m&sup3;</strong>
                </div>
                <div>
                  List Carton Price:{' '}
                  <strong className="mono">{formatRM(inspectProduct.unitPrice)}</strong>
                </div>
                <div>
                  Your Net Price:{' '}
                  <strong className="mono" style={{ color: 'var(--accent)' }}>
                    {formatRM(inspectProduct.unitPrice * (1 - activeTier.discountRate))}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={inspectProduct.stock === 0}
                onClick={() => {
                  addToCart(inspectProduct, 1);
                  setInspectProduct(null);
                }}
              >
                {inspectProduct.stock === 0 ? 'Out of Stock' : 'Add 1 Carton to Wholesale Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
