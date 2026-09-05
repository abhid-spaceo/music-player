'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api/client';
import styles from './QuotaWidget.module.css';

type Quota = { used: number; limit: number };

/**
 * The "YOUTUBE QUOTA n / limit" card from the Admin mock. Self-fetches today's
 * real usage from GET /api/admin/quota (Pacific-date bucketed). Falls back to a
 * full allowance if the request fails, so the rail never shows a broken card.
 */
export function QuotaWidget() {
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Quota>('/api/admin/quota')
      .then((res) => {
        if (!cancelled) setQuota(res.data);
      })
      .catch(() => {
        // Leave the fallback in place — a metering read must not break the rail.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const limit = quota?.limit ?? 10_000;
  const used = quota?.used ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const remaining = Math.max(0, limit - used).toLocaleString();

  return (
    <div className={styles.card}>
      <span className={styles.label}>YOUTUBE QUOTA</span>
      <p className={styles.value}>
        <strong>{remaining}</strong>
        <span className={styles.of}> / {limit.toLocaleString()}</span>
      </p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.resets}>Resets 00:00 PT</span>
    </div>
  );
}
