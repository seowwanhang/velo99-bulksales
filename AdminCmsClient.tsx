'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatRM, getStockStatus, getSuggestedReorderQty } from '@/lib/rules';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'restock'
  | 'dealers'
  | 'cms'
  | 'settings';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AdminCmsClient({ initialUser }: { initialUser: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; kind: string }>>([]);

  // Login gate state
  const [loginEmail, setLoginEmail] = useState('admin@velo99.my');
  const [loginPassword, setLoginPassword] = useState('');

  // Loaded Admin datasets
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  // Modal editors
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [editingFaq, setEditingFaq] = useState<any | null>(null);
  const [editingRegion, setEditingRegion] = useState<any | null>(null);
  const [editingDealer, setEditingDealer] = useState<any | null>(null);
  const [restockProduct, setRestockProduct] = useState<any | null>(null);
  const [restockForm, setRestockForm] = useState({ qty: 10, supplier: 'Taichung Alloy Works Ltd.' });
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('all');
  const [productStockFilter, setProductStockFilter] = useState('all');
  const [editingPo, setEditingPo] = useState<any | null>(null);
  const [adjustModal, setAdjustModal] = useState<any | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const toast = useCallback((msg: string, kind: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes, cRes, oRes, poRes, lRes, dRes, bRes, fRes, rRes] = await Promise.all([
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/admin/products', { cache: 'no-store' }),
        fetch('/api/admin/categories', { cache: 'no-store' }),
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/admin/purchase-orders', { cache: 'no-store' }),
        fetch('/api/admin/inventory-logs', { cache: 'no-store' }),
        fetch('/api/admin/dealers', { cache: 'no-store' }),
        fetch('/api/admin/banners', { cache: 'no-store' }),
        fetch('/api/admin/faqs', { cache: 'no-store' }),
        fetch('/api/admin/regions', { cache: 'no-store' }),
      ]);
      if (sRes.ok) setSettings((await sRes.json()).settings);
      if (pRes.ok) setProducts((await pRes.json()).products || []);
      if (cRes.ok) setCategories((await cRes.json()).categories || []);
      if (oRes.ok) setOrders((await oRes.json()).orders || []);
      if (poRes.ok) setPos((await poRes.json()).purchaseOrders || []);
      if (lRes.ok) setLogs((await lRes.json()).logs || []);
      if (dRes.ok) setDealers((await dRes.json()).users || []);
      if (bRes.ok) setBanners((await bRes.json()).banners || []);
      if (fRes.ok) setFaqs((await fRes.json()).faqs || []);
      if (rRes.ok) setRegions((await rRes.json()).regions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAll();
    }
  }, [user, loadAll]);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Login failed', 'error');
      return;
    }
    if (data.user.role !== 'admin') {
      toast('This account does not have Admin permissions.', 'error');
      return;
    }
    setUser(data.user);
    toast('Signed into Admin CMS.', 'success');
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Upload failed', 'error');
        return null;
      }
      toast('Image uploaded!', 'success');
      return data.url;
    } finally {
      setUploading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      toast('Storefront settings saved live!', 'success');
      loadAll();
    } else {
      toast('Failed to save settings.', 'error');
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingProduct.id;
    const res = await fetch('/api/admin/products', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProduct),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Failed to save product.', 'error');
      return;
    }
    setEditingProduct(null);
    toast(isNew ? 'Product created!' : 'Product updated!', 'success');
    loadAll();
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete or archive this product SKU?')) return;
    const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Product removed/archived.', 'info');
      loadAll();
    }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingCategory.id;
    const res = await fetch('/api/admin/categories', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingCategory),
    });
    if (res.ok) {
      setEditingCategory(null);
      toast('Category saved!', 'success');
      loadAll();
    } else {
      toast((await res.json()).error || 'Failed to save category', 'error');
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category?')) return;
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Category deleted.', 'info');
      loadAll();
    } else {
      toast((await res.json()).error || 'Cannot delete category', 'error');
    }
  }

  async function createRestockPo(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: restockProduct.id,
        qty: restockForm.qty,
        supplier: restockForm.supplier,
      }),
    });
    if (res.ok) {
      setRestockProduct(null);
      setTab('restock');
      toast('Pending Purchase Order created!', 'success');
      loadAll();
    }
  }

  async function receivePo(id: string) {
    const res = await fetch('/api/admin/purchase-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast('PO received! Stock incremented & INBOUND logged.', 'success');
      loadAll();
    }
  }

  async function savePo(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingPo.id;
    const res = await fetch('/api/admin/purchase-orders', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPo),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Failed to save Purchase Order.', 'error');
      return;
    }
    setEditingPo(null);
    toast(isNew ? 'Purchase Order created!' : 'Purchase Order updated!', 'success');
    loadAll();
  }

  async function deletePo(id: string) {
    if (!confirm('Delete this Purchase Order record?')) return;
    const res = await fetch(`/api/admin/purchase-orders?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Purchase Order deleted.', 'info');
      loadAll();
    } else {
      toast('Failed to delete Purchase Order.', 'error');
    }
  }

  async function saveStockAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/inventory-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adjustModal),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Stock adjustment failed.', 'error');
      return;
    }
    setAdjustModal(null);
    toast(`Stock updated (new balance: ${data.balanceAfter} ctn) & logged!`, 'success');
    loadAll();
  }

  async function deleteLog(id: string) {
    if (!confirm('Delete this log entry? (Current product stock will not change.)')) return;
    const res = await fetch(`/api/admin/inventory-logs?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Log entry deleted.', 'info');
      loadAll();
    }
  }

  async function clearAllLogs() {
    if (
      !confirm(
        'Clear ALL inventory log entries? (This only clears log history; your current product stock levels remain untouched.)'
      )
    )
      return;
    const res = await fetch('/api/admin/inventory-logs?clearAll=true', { method: 'DELETE' });
    if (res.ok) {
      toast('All inventory logs cleared.', 'info');
      loadAll();
    }
  }

  async function updateOrderStatus(id: string, status: string) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(`Order status updated to ${status}`, 'success');
      loadAll();
    }
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingBanner.id;
    const res = await fetch('/api/admin/banners', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingBanner),
    });
    if (res.ok) {
      setEditingBanner(null);
      toast('Hero banner saved!', 'success');
      loadAll();
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return;
    await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' });
    toast('Banner deleted.', 'info');
    loadAll();
  }

  async function saveFaq(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingFaq.id;
    const res = await fetch('/api/admin/faqs', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingFaq),
    });
    if (res.ok) {
      setEditingFaq(null);
      toast('FAQ saved!', 'success');
      loadAll();
    }
  }

  async function deleteFaq(id: string) {
    if (!confirm('Delete this FAQ?')) return;
    await fetch(`/api/admin/faqs?id=${id}`, { method: 'DELETE' });
    toast('FAQ deleted.', 'info');
    loadAll();
  }

  async function saveRegion(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingRegion.id;
    const res = await fetch('/api/admin/regions', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingRegion),
    });
    if (res.ok) {
      setEditingRegion(null);
      toast('Delivery region saved!', 'success');
      loadAll();
    }
  }

  async function deleteRegion(id: string) {
    if (!confirm('Delete this delivery region?')) return;
    await fetch(`/api/admin/regions?id=${id}`, { method: 'DELETE' });
    toast('Region deleted.', 'info');
    loadAll();
  }

  async function saveDealer(e: React.FormEvent) {
    e.preventDefault();
    const isNew = !editingDealer.id;
    const res = await fetch('/api/admin/dealers', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingDealer),
    });
    if (res.ok) {
      setEditingDealer(null);
      toast('Account saved!', 'success');
      loadAll();
    } else {
      toast((await res.json()).error || 'Failed to save account', 'error');
    }
  }

  // ---------- Admin Login Gate ----------
  if (!user || user.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div className="card" style={{ width: 'min(430px, 100%)', padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.15rem' }}>Admin CMS Login</strong>
            <Link href="/" className="btn btn-secondary btn-sm">
              &larr; Storefront
            </Link>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', marginTop: 0 }}>
            Sign in with your store owner Administrator account to manage products, banners, delivery
            hubs, dealers, restock POs, and profit analytics.
          </p>
          <form onSubmit={handleAdminLogin} style={{ display: 'grid', gap: 12 }}>
            <div className="field-group">
              <label className="field-label">Admin Email</label>
              <input
                type="email"
                required
                className="field-input"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Password</label>
              <input
                type="password"
                required
                className="field-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter administrator password"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Sign In to Admin CMS
            </button>
          </form>
        </div>
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const criticalSkus = products.filter((p) => getStockStatus(p.stock, p.minStock) === 'CRITICAL');
  const warningSkus = products.filter((p) => getStockStatus(p.stock, p.minStock) === 'WARNING');
  const totalGoodsRev = orders.reduce((s, o) => s + Number(o.goodsRevenue || 0), 0);
  const totalNetProfit = orders.reduce((s, o) => s + Number(o.netProfit || 0), 0);
  const avgMargin = totalGoodsRev > 0 ? ((totalNetProfit / totalGoodsRev) * 100).toFixed(1) : '0.0';

  return (
    <div>
      {/* Top Bar */}
      <div className="utility-bar">
        <div className="utility-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
              {settings?.brandName || 'Velo99'} &mdash; Self-Editable Admin CMS
            </strong>
            {loading && <span style={{ color: '#fcd34d' }}>Syncing...</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Signed in as {user.name}</span>
            <Link href="/" className="btn btn-primary btn-sm">
              View Live Storefront &rarr;
            </Link>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                setUser(null);
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {criticalSkus.length > 0 && (
        <div className="critical-banner">
          <div
            className="container"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <span>
              CRITICAL STOCK ALERT: {criticalSkus.length} SKU(s) critically low or out of stock (
              {criticalSkus.map((s) => s.sku).join(', ')}). Overselling blocked.
            </span>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#fff', color: 'var(--error)' }}
              onClick={() => setTab('overview')}
            >
              View Restock Queue
            </button>
          </div>
        </div>
      )}

      <div className="admin-shell">
        <aside className="admin-sidebar">
          {(
            [
              ['overview', 'Overview & Alerts', criticalSkus.length + warningSkus.length],
              ['products', 'Products & SKUs', products.length],
              ['categories', 'Categories', categories.length],
              ['orders', 'Orders & Profit', orders.length],
              ['restock', 'Restock POs & Logs', pos.filter((x) => x.status === 'pending').length],
              ['dealers', 'Dealers & Tiers', dealers.length],
              ['cms', 'Banners & FAQs', banners.length + faqs.length],
              ['settings', 'Site & Delivery Rules', regions.length],
            ] as Array<[AdminTab, string, number]>
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`admin-nav-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span>{label}</span>
              <span className="mono" style={{ fontSize: '0.72rem', opacity: 0.78 }}>
                {count}
              </span>
            </button>
          ))}
        </aside>

        <main className="admin-content">
          {/* ========== TAB 1: OVERVIEW & ALERTS ========== */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem' }}>Operations Overview &amp; Stock Alerts</h1>
              <div className="kpi-grid">
                <div className="card">
                  <div className="field-label">Critical SKUs</div>
                  <strong className="mono" style={{ fontSize: '1.55rem', color: 'var(--error)' }}>
                    {criticalSkus.length}
                  </strong>
                </div>
                <div className="card">
                  <div className="field-label">Low-Stock Warnings</div>
                  <strong className="mono" style={{ fontSize: '1.55rem', color: 'var(--warning)' }}>
                    {warningSkus.length}
                  </strong>
                </div>
                <div className="card">
                  <div className="field-label">Wholesale Goods Revenue</div>
                  <strong className="mono" style={{ fontSize: '1.55rem' }}>
                    {formatRM(totalGoodsRev)}
                  </strong>
                </div>
                <div className="card">
                  <div className="field-label">Total Net Profit (Admin Only)</div>
                  <strong className="mono" style={{ fontSize: '1.55rem', color: 'var(--success)' }}>
                    {formatRM(totalNetProfit)}{' '}
                    <span style={{ fontSize: '0.82rem' }}>({avgMargin}%)</span>
                  </strong>
                </div>
              </div>

              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h2>Low-Stock &amp; Critical Restock Queue</h2>
                  <p>
                    Formula: <code className="mono">target = max(minStock*2, minStock+10)</code>,{' '}
                    <code className="mono">suggested = max(target - stock, minStock)</code>
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Stock / Min</th>
                      <th>Status</th>
                      <th>Suggested Reorder</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...criticalSkus, ...warningSkus].length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--success)' }}>
                          All SKUs are healthy!
                        </td>
                      </tr>
                    ) : (
                      [...criticalSkus, ...warningSkus].map((p) => {
                        const st = getStockStatus(p.stock, p.minStock);
                        const sug = getSuggestedReorderQty(p.stock, p.minStock);
                        return (
                          <tr key={p.id}>
                            <td className="mono">
                              <strong>{p.sku}</strong>
                            </td>
                            <td>{p.name}</td>
                            <td className="mono">
                              <strong>{p.stock}</strong> / {p.minStock}
                            </td>
                            <td>
                              <span className={`stock-pill ${st}`}>{st}</span>
                            </td>
                            <td className="mono">
                              <strong>+{sug} ctn</strong>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-accent btn-sm"
                                onClick={() => {
                                  setRestockProduct(p);
                                  setRestockForm({
                                    qty: sug,
                                    supplier: 'Taichung Alloy Works Ltd.',
                                  });
                                }}
                              >
                                Quick Restock
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== TAB 2: PRODUCTS & SKUS ========== */}
          {tab === 'products' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Products &amp; Carton Inventory</h1>
                  <p>Add, edit, upload photos, or adjust prices and stock live.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href="/api/admin/products/csv"
                    download="velo99-bicycle-catalog.csv"
                    className="btn btn-secondary btn-sm"
                  >
                    Export CSV Template
                  </a>
                  <label className="btn btn-accent btn-sm" style={{ cursor: 'pointer' }}>
                    Import CSV SKUs
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const csvText = await file.text();
                        const res = await fetch('/api/admin/products/csv', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ csv: csvText }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          toast(data.error || 'CSV import failed.', 'error');
                          return;
                        }
                        toast(
                          `CSV Imported: ${data.created} created, ${data.updated} updated${
                            data.errors?.length ? ` (${data.errors.length} skipped)` : ''
                          }`,
                          'success'
                        );
                        loadAll();
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setEditingProduct({
                        sku: '',
                        name: '',
                        categoryId: categories[0]?.id || '',
                        color: 'Matte Black',
                        size: '29" (M)',
                        unitsPerCarton: 2,
                        isBicycle: true,
                        cbm: 0.36,
                        unitPrice: 1500,
                        costPrice: 1000,
                        stock: 10,
                        minStock: 8,
                        isNew: true,
                        active: true,
                        imageUrl: '/images/bike-mtb.jpg',
                        specs: '',
                      })
                    }
                  >
                    + Add New Bicycle SKU
                  </button>
                </div>
              </div>

              {/* Live Product Search & Filter Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <input
                  type="search"
                  className="field-input"
                  style={{ flex: '1 1 240px' }}
                  placeholder="Search SKU, model name, color, size, or specs..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <select
                  className="field-select"
                  style={{ width: 190 }}
                  value={productCatFilter}
                  onChange={(e) => setProductCatFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field-select"
                  style={{ width: 170 }}
                  value={productStockFilter}
                  onChange={(e) => setProductStockFilter(e.target.value)}
                >
                  <option value="all">All Stock Levels</option>
                  <option value="CRITICAL">CRITICAL Only</option>
                  <option value="WARNING">WARNING Only</option>
                  <option value="HEALTHY">HEALTHY Only</option>
                </select>
                {(productSearch || productCatFilter !== 'all' || productStockFilter !== 'all') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setProductSearch('');
                      setProductCatFilter('all');
                      setProductStockFilter('all');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>SKU &amp; Name</th>
                      <th>Category</th>
                      <th>CBM</th>
                      <th>List / Cost (RM)</th>
                      <th>Stock / Min</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .filter((p) => {
                        if (productCatFilter !== 'all' && p.categoryId !== productCatFilter)
                          return false;
                        const st = getStockStatus(p.stock, p.minStock);
                        if (productStockFilter !== 'all' && st !== productStockFilter) return false;
                        const tokens = productSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
                        if (tokens.length > 0) {
                          const hay = `${p.sku} ${p.name} ${p.color} ${p.size} ${p.specs} ${p.category?.name || ''}`.toLowerCase();
                          if (!tokens.every((t) => hay.includes(t))) return false;
                        }
                        return true;
                      })
                      .map((p) => {
                      const st = getStockStatus(p.stock, p.minStock);
                      return (
                        <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                          <td>
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6 }}
                            />
                          </td>
                          <td>
                            <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                              {p.sku}
                            </span>
                            {p.isNew && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: '0.68rem',
                                  background: 'var(--primary-soft)',
                                  color: 'var(--primary)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontWeight: 800,
                                }}
                              >
                                NEW
                              </span>
                            )}
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.name}</div>
                          </td>
                          <td>{p.category?.name}</td>
                          <td className="mono">{p.cbm.toFixed(2)} m&sup3;</td>
                          <td className="mono">
                            <strong>{formatRM(p.unitPrice)}</strong>
                            <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                              Cost: {formatRM(p.costPrice)}
                            </div>
                          </td>
                          <td className="mono">
                            <strong>{p.stock}</strong> / {p.minStock}
                          </td>
                          <td>
                            <span className={`stock-pill ${st}`}>{st}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingProduct({ ...p })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-accent btn-sm"
                                onClick={() => {
                                  setRestockProduct(p);
                                  setRestockForm({
                                    qty: getSuggestedReorderQty(p.stock, p.minStock),
                                    supplier: 'Taichung Alloy Works Ltd.',
                                  });
                                }}
                              >
                                Restock
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteProduct(p.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== TAB 3: CATEGORIES ========== */}
          {tab === 'categories' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Product Categories</h1>
                  <p>Manage storefront category cards, display order, and cover images.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    setEditingCategory({
                      name: '',
                      slug: '',
                      description: '',
                      imageUrl: '/images/bike-mtb.jpg',
                      sortOrder: categories.length + 1,
                      active: true,
                    })
                  }
                >
                  + Add Category
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name &amp; Slug</th>
                      <th>Products</th>
                      <th>Order</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 6 }}
                          />
                        </td>
                        <td>
                          <strong>{c.name}</strong>
                          <div className="mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)' }}>
                            /{c.slug}
                          </div>
                        </td>
                        <td className="mono">{c._count?.products ?? 0}</td>
                        <td className="mono">{c.sortOrder}</td>
                        <td>{c.active ? 'Visible' : 'Hidden'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingCategory({ ...c })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteCategory(c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== TAB 4: ORDERS & PROFIT LEDGER ========== */}
          {tab === 'orders' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Orders, Fulfillment &amp; Profit Ledger</h1>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Buyer &amp; Tier</th>
                      <th>Volume</th>
                      <th>Revenue</th>
                      <th>COGS</th>
                      <th>Net Profit</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong className="mono">{o.orderNumber}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                            {new Date(o.createdAt).toLocaleString('en-MY')}
                          </div>
                        </td>
                        <td>
                          <strong>{o.customerName}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                            {o.dealerTier.toUpperCase()} ({Math.round(o.discountRate * 100)}% OFF) &bull;{' '}
                            {o.fulfillment}
                          </div>
                        </td>
                        <td className="mono">
                          {o.totalBikes} bikes
                          <br />
                          {Number(o.totalCbm).toFixed(2)} m&sup3;
                        </td>
                        <td className="mono">
                          <strong>{formatRM(o.goodsRevenue)}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                            Ship: {formatRM(o.shippingFee)}
                          </div>
                        </td>
                        <td className="mono">{formatRM(o.totalCost)}</td>
                        <td
                          className="mono"
                          style={{
                            color: o.netProfit >= 0 ? 'var(--success)' : 'var(--error)',
                            fontWeight: 800,
                          }}
                        >
                          {formatRM(o.netProfit)}
                          <div style={{ fontSize: '0.72rem' }}>{o.profitMargin}%</div>
                        </td>
                        <td>
                          <select
                            className="field-select"
                            style={{ width: 155, padding: '5px 8px', fontSize: '0.78rem' }}
                            value={o.status}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          >
                            {[
                              'CONFIRMED',
                              'PACKING',
                              'READY_FOR_PICKUP',
                              'OUT_FOR_DELIVERY',
                              'COMPLETED',
                              'RESCHEDULED',
                              'CANCELLED',
                            ].map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Link
                            href={`/invoice/${o.orderNumber}`}
                            className="btn btn-secondary btn-sm"
                          >
                            Invoice
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== TAB 5: RESTOCK POS & INVENTORY LOGS ========== */}
          {tab === 'restock' && (
            <div style={{ display: 'grid', gap: 22 }}>
              <div>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Purchase Orders (Inbound Restock)</h1>
                    <p>Create, edit, delete, or receive factory restock purchase orders.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const firstProd = products[0];
                      setEditingPo({
                        productId: firstProd?.id || '',
                        qty: firstProd
                          ? getSuggestedReorderQty(firstProd.stock, firstProd.minStock)
                          : 10,
                        unitCost: firstProd?.costPrice ?? 1000,
                        supplier: 'Taichung Alloy Works Ltd.',
                        status: 'pending',
                      });
                    }}
                  >
                    + New Purchase Order
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>SKU &amp; Product</th>
                        <th>Supplier</th>
                        <th>Qty</th>
                        <th>Total Cost</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>
                            No purchase orders yet. Click &ldquo;+ New Purchase Order&rdquo; to create one.
                          </td>
                        </tr>
                      ) : (
                        pos.map((po) => (
                          <tr key={po.id}>
                            <td className="mono">
                              <strong>{po.poNumber}</strong>
                            </td>
                            <td>
                              <span className="mono">{po.sku}</span>
                              <div style={{ fontSize: '0.8rem' }}>{po.productName}</div>
                            </td>
                            <td>{po.supplier}</td>
                            <td className="mono">
                              <strong>+{po.qty}</strong>
                            </td>
                            <td className="mono">{formatRM(po.qty * po.unitCost)}</td>
                            <td>
                              <span
                                className={`stock-pill ${po.status === 'received' ? 'HEALTHY' : 'WARNING'}`}
                              >
                                {po.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {po.status === 'pending' && (
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={() => receivePo(po.id)}
                                  >
                                    Mark Received (+Stock)
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingPo({ ...po })}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => deletePo(po.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="section-head" style={{ marginBottom: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.18rem' }}>
                      Inventory Movement Ledger (INBOUND / OUTBOUND / ADJUSTMENT)
                    </h2>
                    <p>Record manual stocktakes/adjustments or clean up sample log history.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      onClick={() =>
                        setAdjustModal({
                          productId: products[0]?.id || '',
                          type: 'ADJUSTMENT',
                          delta: 1,
                          reference: 'STOCKTAKE',
                          note: '',
                        })
                      }
                    >
                      + Manual Stock Adjustment
                    </button>
                    {logs.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={clearAllLogs}
                      >
                        Clear All Logs
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                    background: 'var(--surface)',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  <input
                    type="search"
                    className="field-input"
                    style={{ flex: '1 1 220px' }}
                    placeholder="Filter logs by SKU, reference, or note..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                  <select
                    className="field-select"
                    style={{ width: 170 }}
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                  >
                    <option value="all">All Movement Types</option>
                    <option value="INBOUND">INBOUND Only</option>
                    <option value="OUTBOUND">OUTBOUND Only</option>
                    <option value="ADJUSTMENT">ADJUSTMENT Only</option>
                  </select>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Type</th>
                        <th>SKU</th>
                        <th>Delta</th>
                        <th>Balance</th>
                        <th>Ref</th>
                        <th>Note</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs
                        .filter((l) => {
                          if (logTypeFilter !== 'all' && l.type !== logTypeFilter) return false;
                          const q = logSearch.trim().toLowerCase();
                          if (q && !`${l.sku} ${l.reference} ${l.note}`.toLowerCase().includes(q))
                            return false;
                          return true;
                        })
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="mono" style={{ fontSize: '0.75rem' }}>
                              {new Date(l.createdAt).toLocaleString('en-MY')}
                            </td>
                            <td>
                              <span
                                className={`stock-pill ${l.type === 'INBOUND' ? 'HEALTHY' : l.type === 'OUTBOUND' ? 'CRITICAL' : 'WARNING'}`}
                              >
                                {l.type}
                              </span>
                            </td>
                            <td className="mono">{l.sku}</td>
                            <td className="mono" style={{ fontWeight: 800 }}>
                              {l.delta > 0 ? `+${l.delta}` : l.delta}
                            </td>
                            <td className="mono">{l.balanceAfter} ctn</td>
                            <td className="mono">{l.reference}</td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                              {l.note}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteLog(l.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>
                            No inventory logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB 6: DEALERS & TIER ACCOUNTS ========== */}
          {tab === 'dealers' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Dealers, Tiers &amp; Credit Limits</h1>
                  <p>Approve B2B dealers, upgrade Platinum/Gold/Silver tiers, and manage credit.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    setEditingDealer({
                      email: '',
                      password: '',
                      name: '',
                      companyName: '',
                      phone: '',
                      role: 'dealer',
                      tier: 'silver',
                      creditLimit: 30000,
                      creditUsed: 0,
                      active: true,
                    })
                  }
                >
                  + Create Dealer / Staff Account
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Company &amp; Contact</th>
                      <th>Role</th>
                      <th>Tier</th>
                      <th>Credit Used / Limit</th>
                      <th>Orders</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealers.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.companyName || d.name}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                            {d.name} &bull; {d.email} &bull; {d.phone}
                          </div>
                        </td>
                        <td className="mono">{d.role.toUpperCase()}</td>
                        <td>
                          <span className={`tier-pill ${d.tier}`}>{d.tier.toUpperCase()}</span>
                        </td>
                        <td className="mono">
                          {formatRM(d.creditUsed)} / <strong>{formatRM(d.creditLimit)}</strong>
                        </td>
                        <td className="mono">{d._count?.orders ?? 0}</td>
                        <td>{d.active ? 'Active' : 'Suspended'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingDealer({ ...d, newPassword: '' })}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== TAB 7: BANNERS & FAQS (HOMEPAGE CMS) ========== */}
          {tab === 'cms' && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Homepage Hero Banners</h1>
                    <p>Control the promotional carousel slides shown on your storefront homepage.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setEditingBanner({
                        eyebrow: 'SEASONAL BULK PROMO',
                        title: '',
                        subtitle: '',
                        ctaLabel: 'Browse Catalog',
                        ctaHref: '#catalog',
                        imageUrl: '/images/hero-warehouse.jpg',
                        badgeText: 'LIMITED OFFER',
                        sortOrder: banners.length + 1,
                        active: true,
                      })
                    }
                  >
                    + Add Hero Banner
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Slide</th>
                        <th>Title &amp; Badge</th>
                        <th>Order</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {banners.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <img
                              src={b.imageUrl}
                              alt={b.title}
                              style={{ width: 92, height: 50, objectFit: 'cover', borderRadius: 6 }}
                            />
                          </td>
                          <td>
                            <strong>{b.title}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                              {b.eyebrow} &bull; {b.badgeText}
                            </div>
                          </td>
                          <td className="mono">{b.sortOrder}</td>
                          <td>{b.active ? 'Live' : 'Hidden'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingBanner({ ...b })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteBanner(b.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2>Storefront FAQs</h2>
                    <p>Edit the accordion questions &amp; answers displayed on your storefront.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setEditingFaq({
                        question: '',
                        answer: '',
                        sortOrder: faqs.length + 1,
                        active: true,
                      })
                    }
                  >
                    + Add FAQ
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Order</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faqs.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <strong>{f.question}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                              {f.answer}
                            </div>
                          </td>
                          <td className="mono">{f.sortOrder}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingFaq({ ...f })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteFaq(f.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB 8: SITE SETTINGS & DELIVERY HUBS ========== */}
          {tab === 'settings' && settings && (
            <div style={{ display: 'grid', gap: 24 }}>
              <form onSubmit={saveSettings} className="card" style={{ display: 'grid', gap: 14 }}>
                <h1 style={{ margin: 0, fontSize: '1.35rem' }}>
                  Store Branding, Thresholds &amp; Contact Info
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div className="field-group">
                    <label className="field-label">Brand / Platform Name</label>
                    <input
                      className="field-input"
                      value={settings.brandName}
                      onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Logo Mark (2-4 chars)</label>
                    <input
                      className="field-input mono"
                      maxLength={5}
                      value={settings.logoText}
                      onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Tagline</label>
                    <input
                      className="field-input"
                      value={settings.tagline}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Support Phone</label>
                    <input
                      className="field-input mono"
                      value={settings.supportPhone}
                      onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Support Email</label>
                    <input
                      className="field-input"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Operating Hours</label>
                    <input
                      className="field-input"
                      value={settings.supportHours}
                      onChange={(e) => setSettings({ ...settings, supportHours: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Minimum Order Value (RM)</label>
                    <input
                      type="number"
                      className="field-input mono"
                      value={settings.minOrderValue}
                      onChange={(e) =>
                        setSettings({ ...settings, minOrderValue: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Free Delivery Volume (m³)</label>
                    <input
                      type="number"
                      step="0.05"
                      className="field-input mono"
                      value={settings.freeDeliveryCbm}
                      onChange={(e) =>
                        setSettings({ ...settings, freeDeliveryCbm: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Standard Lorry Shipping Fee (RM)</label>
                    <input
                      type="number"
                      className="field-input mono"
                      value={settings.standardShippingFee}
                      onChange={(e) =>
                        setSettings({ ...settings, standardShippingFee: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Reschedule Fee (RM)</label>
                    <input
                      type="number"
                      className="field-input mono"
                      value={settings.rescheduleFee}
                      onChange={(e) =>
                        setSettings({ ...settings, rescheduleFee: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Daily Cutoff Hour (0-23, e.g. 13 = 1 PM)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className="field-input mono"
                      value={settings.cutoffHour}
                      onChange={(e) =>
                        setSettings({ ...settings, cutoffHour: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Company Reg No (SSM)</label>
                    <input
                      className="field-input"
                      value={settings.companyRegNo}
                      onChange={(e) => setSettings({ ...settings, companyRegNo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Top Bar Promo / Payment Banner Text</label>
                  <input
                    className="field-input"
                    value={settings.instalmentPromoText}
                    onChange={(e) =>
                      setSettings({ ...settings, instalmentPromoText: e.target.value })
                    }
                  />
                </div>
                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: '1.02rem' }}>
                    Manual Payment (Bank Transfer / DuitNow QR) &amp; Order Alerts
                  </h2>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div className="field-group">
                      <label className="field-label">Bank Name</label>
                      <input
                        className="field-input"
                        value={settings.bankName || ''}
                        onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                        placeholder="Maybank Islamic"
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Bank Account Name</label>
                      <input
                        className="field-input"
                        value={settings.bankAccountName || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, bankAccountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Bank Account Number</label>
                      <input
                        className="field-input mono"
                        value={settings.bankAccountNumber || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, bankAccountNumber: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">WhatsApp Order Slip Number (digits, e.g. 601116000099)</label>
                      <input
                        className="field-input mono"
                        value={settings.whatsappOrderNumber || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, whatsappOrderNumber: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">New Order Alert Email (via Resend)</label>
                      <input
                        type="email"
                        className="field-input"
                        value={settings.notifyEmail || ''}
                        onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.value })}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">DuitNow QR Image (Upload or URL)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="field-input"
                          value={settings.duitNowQrUrl || ''}
                          onChange={(e) =>
                            setSettings({ ...settings, duitNowQrUrl: e.target.value })
                          }
                          placeholder="/api/assets/..."
                        />
                        <label className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                          {uploading ? '...' : 'Upload QR'}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const url = await uploadImage(f);
                              if (url) setSettings({ ...settings, duitNowQrUrl: url });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Footer Service Area Notice</label>
                  <textarea
                    rows={2}
                    className="field-textarea"
                    value={settings.footerNotice}
                    onChange={(e) => setSettings({ ...settings, footerNotice: e.target.value })}
                  />
                </div>
                <div>
                  <button type="submit" className="btn btn-primary">
                    Save Storefront Settings Live
                  </button>
                </div>
              </form>

              <div>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2>Delivery Regions &amp; Self-Pickup Hubs</h2>
                    <p>Add or update regional hubs and pickup hours shown in the buyer location bar.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setEditingRegion({
                        name: '',
                        code: '',
                        states: '',
                        hubName: '',
                        hubAddress: '',
                        postcodePrefix: '40000',
                        pickupHours: '6:00 PM - 10:00 PM',
                        sortOrder: regions.length + 1,
                        active: true,
                      })
                    }
                  >
                    + Add Delivery Region
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Region &amp; States</th>
                        <th>Pickup Hub</th>
                        <th>Postcode</th>
                        <th>Hours</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                              {r.states}
                            </div>
                          </td>
                          <td>
                            <strong>{r.hubName}</strong>
                            <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                              {r.hubAddress}
                            </div>
                          </td>
                          <td className="mono">{r.postcodePrefix}</td>
                          <td>{r.pickupHours}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingRegion({ ...r })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteRegion(r.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== PRODUCT EDITOR MODAL ==================== */}
      {editingProduct && (
        <div className="backdrop" onClick={() => setEditingProduct(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingProduct.id ? `Edit SKU: ${editingProduct.sku}` : 'Add New Wholesale SKU'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingProduct(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveProduct} style={{ display: 'grid', gap: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">SKU Code *</label>
                  <input
                    required
                    className="field-input mono"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Category *</label>
                  <select
                    className="field-select"
                    value={editingProduct.categoryId}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Product Name &amp; Carton Spec *</label>
                <input
                  required
                  className="field-input"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Color</label>
                  <input
                    className="field-input"
                    value={editingProduct.color}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, color: e.target.value })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Size</label>
                  <input
                    className="field-input"
                    value={editingProduct.size}
                    onChange={(e) => setEditingProduct({ ...editingProduct, size: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Units / Carton</label>
                  <input
                    type="number"
                    min={1}
                    className="field-input mono"
                    value={editingProduct.unitsPerCarton}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        unitsPerCarton: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Wholesale List (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input mono"
                    value={editingProduct.unitPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unitPrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Cost Price (RM, Admin)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input mono"
                    value={editingProduct.costPrice}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Carton CBM (m³)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input mono"
                    value={editingProduct.cbm}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, cbm: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Current Stock (Cartons)</label>
                  <input
                    type="number"
                    min={0}
                    className="field-input mono"
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Safety Min Stock Alert</label>
                  <input
                    type="number"
                    min={1}
                    className="field-input mono"
                    value={editingProduct.minStock}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, minStock: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Product Image (Upload file or paste URL)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    value={editingProduct.imageUrl}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, imageUrl: e.target.value })
                    }
                  />
                  <label className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadImage(f);
                        if (url) setEditingProduct({ ...editingProduct, imageUrl: url });
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Technical Specifications</label>
                <textarea
                  rows={2}
                  className="field-textarea"
                  value={editingProduct.specs}
                  onChange={(e) => setEditingProduct({ ...editingProduct, specs: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', fontWeight: 700 }}>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={editingProduct.isBicycle}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isBicycle: e.target.checked })
                    }
                  />
                  Complete Bicycle (counts toward 10/20 volume bonus)
                </label>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={editingProduct.isNew}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isNew: e.target.checked })
                    }
                  />
                  New Arrival
                </label>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={editingProduct.active}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, active: e.target.checked })
                    }
                  />
                  Visible
                </label>
              </div>
              <button type="submit" className="btn btn-primary">
                Save Product SKU
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== QUICK RESTOCK PO MODAL ==================== */}
      {restockProduct && (
        <div className="backdrop" onClick={() => setRestockProduct(null)}>
          <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>Quick Restock PO &mdash; {restockProduct.sku}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRestockProduct(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={createRestockPo} style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: '0.84rem' }}>
                <strong>{restockProduct.name}</strong>
                <div style={{ color: 'var(--ink-muted)', marginTop: 3 }}>
                  Stock: <strong className="mono">{restockProduct.stock}</strong> &bull; Min Stock:{' '}
                  <strong className="mono">{restockProduct.minStock}</strong> &bull; Suggested:{' '}
                  <strong className="mono" style={{ color: 'var(--accent)' }}>
                    +{getSuggestedReorderQty(restockProduct.stock, restockProduct.minStock)} ctn
                  </strong>
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Reorder Quantity (Cartons)</label>
                <input
                  type="number"
                  min={1}
                  className="field-input mono"
                  value={restockForm.qty}
                  onChange={(e) => setRestockForm({ ...restockForm, qty: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Supplier Name</label>
                <input
                  className="field-input"
                  value={restockForm.supplier}
                  onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })}
                />
              </div>
              <div style={{ fontSize: '0.84rem' }}>
                Estimated PO Cost:{' '}
                <strong className="mono">
                  {formatRM(restockProduct.costPrice * restockForm.qty)}
                </strong>
              </div>
              <button type="submit" className="btn btn-primary">
                Create Pending Purchase Order
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CATEGORY MODAL ==================== */}
      {editingCategory && (
        <div className="backdrop" onClick={() => setEditingCategory(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingCategory.id ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingCategory(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveCategory} style={{ display: 'grid', gap: 11 }}>
              <div className="field-group">
                <label className="field-label">Category Name *</label>
                <input
                  required
                  className="field-input"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label">Description</label>
                <input
                  className="field-input"
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label">Cover Image</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    value={editingCategory.imageUrl}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, imageUrl: e.target.value })
                    }
                  />
                  <label className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadImage(f);
                        if (url) setEditingCategory({ ...editingCategory, imageUrl: url });
                      }}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Sort Order</label>
                  <input
                    type="number"
                    className="field-input mono"
                    value={editingCategory.sortOrder}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, sortOrder: Number(e.target.value) })
                    }
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={editingCategory.active}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, active: e.target.checked })
                    }
                  />
                  Visible on Storefront
                </label>
              </div>
              <button type="submit" className="btn btn-primary">
                Save Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== BANNER MODAL ==================== */}
      {editingBanner && (
        <div className="backdrop" onClick={() => setEditingBanner(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingBanner.id ? 'Edit Hero Banner' : 'Add Hero Banner'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingBanner(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveBanner} style={{ display: 'grid', gap: 11 }}>
              <div className="field-group">
                <label className="field-label">Eyebrow Tag</label>
                <input
                  className="field-input"
                  value={editingBanner.eyebrow}
                  onChange={(e) => setEditingBanner({ ...editingBanner, eyebrow: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Headline Title *</label>
                <input
                  required
                  className="field-input"
                  value={editingBanner.title}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Subtitle</label>
                <textarea
                  rows={2}
                  className="field-textarea"
                  value={editingBanner.subtitle}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, subtitle: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">CTA Button Label</label>
                  <input
                    className="field-input"
                    value={editingBanner.ctaLabel}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, ctaLabel: e.target.value })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Overlay Badge Text</label>
                  <input
                    className="field-input"
                    value={editingBanner.badgeText}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, badgeText: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Banner Image</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    value={editingBanner.imageUrl}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, imageUrl: e.target.value })
                    }
                  />
                  <label className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const url = await uploadImage(f);
                        if (url) setEditingBanner({ ...editingBanner, imageUrl: url });
                      }}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="field-group" style={{ width: 120 }}>
                  <label className="field-label">Sort Order</label>
                  <input
                    type="number"
                    className="field-input mono"
                    value={editingBanner.sortOrder}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, sortOrder: Number(e.target.value) })
                    }
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={editingBanner.active}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, active: e.target.checked })
                    }
                  />
                  Active Slide
                </label>
              </div>
              <button type="submit" className="btn btn-primary">
                Save Hero Banner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== FAQ MODAL ==================== */}
      {editingFaq && (
        <div className="backdrop" onClick={() => setEditingFaq(null)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>{editingFaq.id ? 'Edit FAQ' : 'Add FAQ'}</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingFaq(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveFaq} style={{ display: 'grid', gap: 11 }}>
              <div className="field-group">
                <label className="field-label">Question *</label>
                <input
                  required
                  className="field-input"
                  value={editingFaq.question}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Answer *</label>
                <textarea
                  required
                  rows={3}
                  className="field-textarea"
                  value={editingFaq.answer}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Save FAQ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== REGION MODAL ==================== */}
      {editingRegion && (
        <div className="backdrop" onClick={() => setEditingRegion(null)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingRegion.id ? 'Edit Delivery Region' : 'Add Delivery Region'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingRegion(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveRegion} style={{ display: 'grid', gap: 11 }}>
              <div className="field-group">
                <label className="field-label">Region Name *</label>
                <input
                  required
                  className="field-input"
                  value={editingRegion.name}
                  onChange={(e) => setEditingRegion({ ...editingRegion, name: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">States Covered</label>
                <input
                  className="field-input"
                  value={editingRegion.states}
                  onChange={(e) => setEditingRegion({ ...editingRegion, states: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Self-Pickup Hub Name *</label>
                <input
                  required
                  className="field-input"
                  value={editingRegion.hubName}
                  onChange={(e) => setEditingRegion({ ...editingRegion, hubName: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Hub Address</label>
                <input
                  className="field-input"
                  value={editingRegion.hubAddress}
                  onChange={(e) =>
                    setEditingRegion({ ...editingRegion, hubAddress: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Default Postcode</label>
                  <input
                    className="field-input mono"
                    value={editingRegion.postcodePrefix}
                    onChange={(e) =>
                      setEditingRegion({ ...editingRegion, postcodePrefix: e.target.value })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Pickup Hours</label>
                  <input
                    className="field-input"
                    value={editingRegion.pickupHours}
                    onChange={(e) =>
                      setEditingRegion({ ...editingRegion, pickupHours: e.target.value })
                    }
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Save Delivery Region
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DEALER / ACCOUNT MODAL ==================== */}
      {editingDealer && (
        <div className="backdrop" onClick={() => setEditingDealer(null)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingDealer.id ? `Edit Account: ${editingDealer.email}` : 'Create Account'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingDealer(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={saveDealer} style={{ display: 'grid', gap: 11 }}>
              {!editingDealer.id && (
                <div className="field-group">
                  <label className="field-label">Email *</label>
                  <input
                    required
                    type="email"
                    className="field-input"
                    value={editingDealer.email}
                    onChange={(e) => setEditingDealer({ ...editingDealer, email: e.target.value })}
                  />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Contact Name *</label>
                  <input
                    required
                    className="field-input"
                    value={editingDealer.name}
                    onChange={(e) => setEditingDealer({ ...editingDealer, name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Company Name</label>
                  <input
                    className="field-input"
                    value={editingDealer.companyName}
                    onChange={(e) =>
                      setEditingDealer({ ...editingDealer, companyName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Role</label>
                  <select
                    className="field-select"
                    value={editingDealer.role}
                    onChange={(e) => setEditingDealer({ ...editingDealer, role: e.target.value })}
                  >
                    <option value="dealer">Dealer</option>
                    <option value="sales">Sales Rep</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Discount Tier</label>
                  <select
                    className="field-select"
                    value={editingDealer.tier}
                    onChange={(e) => setEditingDealer({ ...editingDealer, tier: e.target.value })}
                  >
                    <option value="platinum">Platinum (15% OFF)</option>
                    <option value="gold">Gold (10% OFF)</option>
                    <option value="silver">Silver (5% OFF)</option>
                    <option value="standard">Standard (0% OFF)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Credit Limit (RM)</label>
                  <input
                    type="number"
                    className="field-input mono"
                    value={editingDealer.creditLimit}
                    onChange={(e) =>
                      setEditingDealer({ ...editingDealer, creditLimit: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Credit Used (RM)</label>
                  <input
                    type="number"
                    className="field-input mono"
                    value={editingDealer.creditUsed}
                    onChange={(e) =>
                      setEditingDealer({ ...editingDealer, creditUsed: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">
                  {editingDealer.id ? 'Reset Password (optional, min 6 chars)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingDealer.id}
                  className="field-input"
                  value={editingDealer.id ? editingDealer.newPassword || '' : editingDealer.password || ''}
                  onChange={(e) =>
                    setEditingDealer(
                      editingDealer.id
                        ? { ...editingDealer, newPassword: e.target.value }
                        : { ...editingDealer, password: e.target.value }
                    )
                  }
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={editingDealer.active}
                  onChange={(e) => setEditingDealer({ ...editingDealer, active: e.target.checked })}
                />
                Account Active
              </label>
              <button type="submit" className="btn btn-primary">
                Save Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CREATE / EDIT PURCHASE ORDER MODAL ==================== */}
      {editingPo && (
        <div className="backdrop" onClick={() => setEditingPo(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>
                {editingPo.id ? `Edit PO: ${editingPo.poNumber}` : 'Create New Purchase Order'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingPo(null)}
              >
                &times;
              </button>
            </div>
            <form className="panel-body" onSubmit={savePo} style={{ display: 'grid', gap: 12 }}>
              <div className="field-group">
                <label className="field-label">Product SKU *</label>
                <select
                  className="field-select"
                  disabled={editingPo.status === 'received'}
                  value={editingPo.productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setEditingPo({
                      ...editingPo,
                      productId: e.target.value,
                      ...(p
                        ? {
                            unitCost: p.costPrice,
                            qty: editingPo.id
                              ? editingPo.qty
                              : getSuggestedReorderQty(p.stock, p.minStock),
                          }
                        : {}),
                    });
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">
                    Quantity (Cartons){editingPo.status === 'received' ? ' (Locked)' : ''}
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={editingPo.status === 'received'}
                    className="field-input mono"
                    value={editingPo.qty}
                    onChange={(e) => setEditingPo({ ...editingPo, qty: Number(e.target.value) })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Unit Cost / Carton (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="field-input mono"
                    value={editingPo.unitCost}
                    onChange={(e) =>
                      setEditingPo({ ...editingPo, unitCost: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Supplier Name *</label>
                <input
                  required
                  className="field-input"
                  value={editingPo.supplier}
                  onChange={(e) => setEditingPo({ ...editingPo, supplier: e.target.value })}
                />
              </div>
              <div style={{ fontSize: '0.84rem' }}>
                Estimated PO Total:{' '}
                <strong className="mono">{formatRM(editingPo.qty * editingPo.unitCost)}</strong>
              </div>
              <button type="submit" className="btn btn-primary">
                {editingPo.id ? 'Save Purchase Order Changes' : 'Create Pending Purchase Order'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MANUAL STOCK ADJUSTMENT MODAL ==================== */}
      {adjustModal && (
        <div className="backdrop" onClick={() => setAdjustModal(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>Manual Stock Adjustment</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAdjustModal(null)}
              >
                &times;
              </button>
            </div>
            <form
              className="panel-body"
              onSubmit={saveStockAdjustment}
              style={{ display: 'grid', gap: 12 }}
            >
              <div className="field-group">
                <label className="field-label">Select Product SKU *</label>
                <select
                  className="field-select"
                  value={adjustModal.productId}
                  onChange={(e) => setAdjustModal({ ...adjustModal, productId: e.target.value })}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (Current: {p.stock} ctn)
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">Movement Type</label>
                  <select
                    className="field-select"
                    value={adjustModal.type}
                    onChange={(e) => setAdjustModal({ ...adjustModal, type: e.target.value })}
                  >
                    <option value="INBOUND">INBOUND (+ Add Stock)</option>
                    <option value="OUTBOUND">OUTBOUND (− Deduct Stock)</option>
                    <option value="ADJUSTMENT">ADJUSTMENT (+ / − Signed)</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Cartons Delta (e.g. 5 or -2)</label>
                  <input
                    type="number"
                    required
                    className="field-input mono"
                    value={adjustModal.delta}
                    onChange={(e) =>
                      setAdjustModal({ ...adjustModal, delta: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Reference Code</label>
                <input
                  className="field-input mono"
                  value={adjustModal.reference}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reference: e.target.value })}
                  placeholder="STOCKTAKE-NOV"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Reason / Audit Note</label>
                <input
                  className="field-input"
                  value={adjustModal.note}
                  onChange={(e) => setAdjustModal({ ...adjustModal, note: e.target.value })}
                  placeholder="e.g. Warehouse physical count correction"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Apply Stock Update &amp; Record Log
              </button>
            </form>
          </div>
        </div>
      )}

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
