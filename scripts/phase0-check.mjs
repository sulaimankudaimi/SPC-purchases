#!/usr/bin/env node
// scripts/phase0-check.mjs — اختبارات القبول T0.1–T0.6 (Node بلا اعتماديات). لا يطبع المفاتيح ولا الروابط.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { execSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const rows = [];
const add = (id, ok, details) => rows.push({ id, ok, details });

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return env;
}

// إخفاء أي اسم مضيف أو مفتاح قد يظهر داخل رسائل الأخطاء
const scrub = (s, secrets) =>
  secrets
    .filter(Boolean)
    .reduce((t, v) => t.split(v).join('***'), String(s))
    .replace(/[a-z0-9-]+\.supabase\.co/gi, '***.supabase.co');

function request(url, { method = 'GET', headers = {}, body = null, timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const t0 = Date.now();
    const req = (u.protocol === 'https:' ? https : http).request(
      { hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method, headers, timeout },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, ms: Date.now() - t0, body: data }));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'انتهت المهلة' });
    });
    req.on('error', (e) => resolve({ error: e.code || 'خطأ شبكة' }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function pngSize(file) {
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const jsonOf = (r) => {
  try {
    return JSON.parse(r.body);
  } catch {
    return {};
  }
};

async function main() {
  const env = parseEnv(path.join(ROOT, '.env.local'));
  const secrets = Object.values(env);
  const targets = [
    ['dev', env.DEV_SUPABASE_URL, env.DEV_SUPABASE_ANON_KEY],
    ['prod', env.PROD_SUPABASE_URL, env.PROD_SUPABASE_ANON_KEY]
  ];
  const base = (u) => u.replace(/\/$/, '');

  // T0.1
  try {
    add('T0.1', true, `node ${sh('node -v')} | ${sh('git --version')} | npm ${sh('npm -v')}`);
  } catch (e) {
    add('T0.1', false, scrub(e.message, secrets));
  }

  // T0.2 (dev + prod)
  const health = [];
  for (const [name, url, key] of targets) {
    if (!url || !key) {
      health.push(`${name}: متغيرات ناقصة`);
      continue;
    }
    const r = await request(`${base(url)}/auth/v1/health`, { headers: { apikey: key } });
    health.push(r.error ? `${name}: ${r.error}` : `${name}: ${r.status} (${r.ms}ms)`);
    if (r.error || r.status !== 200 || r.ms >= 2000) health.push('!');
  }
  add(
    'T0.2',
    !health.includes('!') && !health.some((h) => /ناقصة/.test(h)),
    health.filter((h) => h !== '!').join(' | ')
  );

  // T0.3: دخول المستخدم (dev) + رفض التسجيل العام (dev وprod). لا يُعدّ الخطأ الشبكي أو أي 4xx غير مفسَّر «رفضاً».
  const out = [];
  let ok3 = true;
  const [, durl, dkey] = targets[0];
  if (!durl || !dkey || !env.SUPABASE_TEST_EMAIL || !env.SUPABASE_TEST_PASSWORD) {
    ok3 = false;
    out.push('بيانات الدخول ناقصة في .env.local');
  } else {
    const l = await request(`${base(durl)}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: dkey, 'Content-Type': 'application/json' },
      body: { email: env.SUPABASE_TEST_EMAIL, password: env.SUPABASE_TEST_PASSWORD }
    });
    const okLogin = l.status === 200 && !!jsonOf(l).access_token;
    ok3 = ok3 && okLogin;
    out.push(`دخول dev: ${okLogin ? 'نجح' : 'فشل ' + (l.status || l.error)}`);
  }
  for (const [name, url, key] of targets) {
    if (!url || !key) {
      ok3 = false;
      out.push(`signup ${name}: متغيرات ناقصة`);
      continue;
    }
    const s = await request(`${base(url)}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: { email: `signup-check-${Date.now()}@example.com`, password: 'Check-Only-123!x' }
    });
    const j = jsonOf(s);
    const blocked =
      s.status >= 400 && (j.error_code === 'signup_disabled' || /signups? not allowed/i.test(j.msg || j.message || ''));
    if (blocked) out.push(`signup ${name}: مرفوض (${s.status})`);
    else {
      ok3 = false;
      out.push(
        s.error
          ? `signup ${name}: خطأ شبكة`
          : s.status < 300
            ? `signup ${name}: خطر! التسجيل مفعّل (أُنشئ مستخدم؟ احذفه من لوحة Supabase)`
            : `signup ${name}: رفض غير حاسم (HTTP ${s.status} ${j.error_code || ''}) تحقق يدوياً من تعطيل Sign-ups`
      );
    }
  }
  add('T0.3', ok3, out.join(' | '));

  // T0.4
  const g = spawnSync('git', ['check-ignore', '.env.local', '.env.import'], { encoding: 'utf8', cwd: ROOT });
  const lines = (g.stdout || '').split(/\r?\n/).map((x) => x.trim());
  add(
    'T0.4',
    lines.includes('.env.local') && lines.includes('.env.import'),
    `المُتجاهَل: ${lines.filter(Boolean).join(', ') || 'لا شيء (هل المجلد مستودع git؟)'}`
  );

  // T0.5 — الأبعاد الصحيحة وفق الملف الفعلي: spc-logo=295×248 وheader-sy=224×116 (انظر D20)
  const miss = ['طلب_اساسي.xlsx', 'سجل_الشراء_المحلي.xlsx'].filter(
    (f) => !fs.existsSync(path.join(ROOT, 'docs', 'reference', f))
  );
  const a = pngSize(path.join(ROOT, 'assets', 'spc-logo.png')),
    b = pngSize(path.join(ROOT, 'assets', 'header-sy.png'));
  const okA = a && a.w === 295 && a.h === 248,
    okB = b && b.w === 224 && b.h === 116;
  add(
    'T0.5',
    !miss.length && okA && okB,
    `${miss.length ? 'مفقود: ' + miss.join(',') + ' | ' : ''}spc-logo ${a ? a.w + '×' + a.h : 'غير موجود'} (المتوقع 295×248) | header-sy ${b ? b.w + '×' + b.h : 'غير موجود'} (المتوقع 224×116)`
  );

  // T0.6 (shell:true لأن npm على ويندوز ملف .cmd)
  try {
    add('T0.6', /^\d+\.\d+\.\d+/.test(sh('npm view electron version')), `electron ${sh('npm view electron version')}`);
  } catch (e) {
    add('T0.6', false, scrub(e.message.split('\n')[0], secrets));
  }

  console.log('\n| الاختبار | الحالة | التفاصيل');
  for (const r of rows) console.log(`| ${r.id} | ${r.ok ? 'نجح' : 'فشل'} | ${scrub(r.details, secrets)}`);
  const pass = rows.filter((r) => r.ok).length;
  console.log(`\nالنتيجة: ${pass}/${rows.length}${pass === rows.length ? ' — جاهز لـ git tag phase-0-done' : ''}\n`);
  process.exit(pass === rows.length ? 0 : 1);
}
main();
