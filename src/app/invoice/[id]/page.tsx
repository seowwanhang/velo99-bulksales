import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatRM } from '@/lib/rules';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function InvoicePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: { OR: [{ orderNumber: id }, { id }] },
      include: { items: true },
    }),
    prisma.siteSettings.findUnique({ where: { id: 'main' } }),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div style={{ maxWidth: 860, margin: '28px auto', padding: '0 20px' }}>
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
          Formal Wholesale Order Invoice
        </span>
        <PrintButton />
      </div>

      <article className="card" style={{ padding: '32px 34px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            paddingBottom: 20,
            borderBottom: '2px solid var(--ink)',
          }}
        >
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>
              {settings?.brandName || 'Velo99 Bulksales'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: 4 }}>
              {settings?.companyRegNo}
              <br />
              {settings?.supportPhone} &bull; {settings?.supportEmail}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)' }}>
              WHOLESALE TAX INVOICE
            </div>
            <div className="mono" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              {order.orderNumber}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              Date: {new Date(order.createdAt).toLocaleString('en-MY')}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 2 }}>
              Status: {order.status}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            padding: '18px 0',
            fontSize: '0.84rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              Bill To / Buyer
            </div>
            <strong>{order.customerName}</strong>
            <div>Phone: {order.customerPhone}</div>
            {order.customerEmail && <div>Email: {order.customerEmail}</div>}
            <div>Dealer Tier: {order.dealerTier.toUpperCase()}</div>
            {order.requestEInvoice && (
              <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 700 }}>
                LHDN e-Invoice: {order.eInvoiceCompany} (TIN: {order.eInvoiceTin})
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              Fulfillment &amp; Logistics
            </div>
            <strong>
              {order.fulfillment === 'pickup' ? 'Hub Self-Pickup' : 'Peninsular Lorry Delivery'}
            </strong>
            <div>Region: {order.regionName}</div>
            <div>Hub: {order.hubName}</div>
            {order.deliveryAddress && (
              <div>
                Address: {order.deliveryAddress} ({order.postcode})
              </div>
            )}
            <div>
              Payment:{' '}
              {order.paymentMethod === 'bank_transfer'
                ? 'Bank Transfer / DuitNow QR'
                : order.paymentMethod === 'credit_terms'
                ? 'Approved Dealer Credit Terms (Net 30)'
                : order.paymentMethod === 'pay_at_hub'
                ? 'Pay Upon Hub Self-Pickup'
                : order.paymentMethod === 'instalment_3m'
                ? '0% 3-Month SME Instalment'
                : order.paymentMethod.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th>Cartons</th>
                <th>Volume</th>
                <th>Unit Carton Price</th>
                <th style={{ textAlign: 'right' }}>Line Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.sku}</td>
                  <td>{item.productName}</td>
                  <td className="mono">{item.qty}</td>
                  <td className="mono">{(item.cbm * item.qty).toFixed(2)} m&sup3;</td>
                  <td className="mono">{formatRM(item.unitPrice)}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatRM(item.unitPrice * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 20,
            marginTop: 20,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>
              Manual Payment / Bank Transfer Details
            </div>
            <div>Bank: <strong>{settings?.bankName || 'Maybank Islamic'}</strong></div>
            <div>Account Name: <strong>{settings?.bankAccountName || settings?.brandName}</strong></div>
            <div>
              Account No: <strong className="mono">{settings?.bankAccountNumber || '—'}</strong>
            </div>
            <div style={{ marginTop: 4, color: 'var(--ink-muted)' }}>
              Reference: <strong className="mono">{order.orderNumber}</strong>
            </div>
            {settings?.duitNowQrUrl && (
              <img
                src={settings.duitNowQrUrl}
                alt="DuitNow QR Payment Code"
                style={{ width: 120, height: 120, objectFit: 'contain', marginTop: 10, borderRadius: 8, background: '#fff', padding: 4 }}
              />
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 7,
              fontSize: '0.86rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Cartons / Bikes / CBM</span>
              <span className="mono">
                {order.totalCartons} ctn / {order.totalBikes} bikes / {order.totalCbm.toFixed(2)} m&sup3;
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Wholesale Subtotal</span>
              <span className="mono">{formatRM(order.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)' }}>
              <span>Discount ({Math.round(order.discountRate * 100)}%)</span>
              <span className="mono">&minus; {formatRM(order.discountAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Net Goods Revenue</span>
              <span className="mono">{formatRM(order.goodsRevenue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Shipping / Logistics</span>
              <span className="mono">
                {order.shippingFee === 0 ? 'FREE' : formatRM(order.shippingFee)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.08rem',
                fontWeight: 800,
                paddingTop: 10,
                borderTop: '2px solid var(--ink)',
              }}
            >
              <span>TOTAL PAYABLE</span>
              <span className="mono">{formatRM(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
            fontSize: '0.76rem',
            color: 'var(--ink-muted)',
          }}
        >
          Present Order ID <strong className="mono">{order.orderNumber}</strong> upon delivery or hub
          self-pickup. This is a computer-generated wholesale invoice; no signature is required.
        </div>
      </article>
    </div>
  );
}
