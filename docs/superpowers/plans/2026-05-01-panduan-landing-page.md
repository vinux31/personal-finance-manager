# Kantong Pintar — Halaman Pengenalan Interaktif Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat file `public/intro.html` — halaman landing animatif, scroll-driven, dan interaktif untuk memperkenalkan Kantong Pintar secara premium.

**Architecture:** Single HTML file dengan semua CSS di `<style>` dan JS di `<script>` di akhir body. Tidak ada dependency eksternal kecuali Google Fonts. File `public/panduan.html` sudah ada dengan konten berbeda — jangan diubah.

**Tech Stack:** HTML5 + CSS3 (custom properties, @keyframes, IntersectionObserver) + Vanilla JavaScript (Canvas API, requestAnimationFrame, DOM events)

---

### Task 1: HTML Skeleton + CSS Variables + Dark Theme

**Files:**
- Create: `public/intro.html`

- [ ] **Step 1: Buat file dengan HTML skeleton lengkap**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kantong Pintar — Kelola Keuanganmu dengan Cerdas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:#0a0a0f; --bg2:#0f0f1a; --card:#111827; --card2:#1a2234;
      --border:rgba(255,255,255,0.08); --border-hover:rgba(255,255,255,0.2);
      --text:#ffffff; --text-muted:#9ca3af; --text-dim:#6b7280;
      --accent1:#00d4ff; --accent2:#7c3aed; --accent3:#f472b6;
      --positive:#34d399; --negative:#f87171; --warning:#fbbf24;
      --grad:linear-gradient(135deg,var(--accent1),var(--accent2),var(--accent3));
      --grad-text:linear-gradient(135deg,#00d4ff,#a78bfa,#f472b6);
    }
    html { scroll-behavior:smooth; }
    body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); overflow-x:hidden; cursor:none; }
    ::selection { background:rgba(124,58,237,0.4); color:#fff; }
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background:var(--bg); }
    ::-webkit-scrollbar-thumb { background:var(--accent2); border-radius:2px; }
    section { position:relative; width:100%; overflow:hidden; }
    .container { max-width:1100px; margin:0 auto; padding:0 2rem; }
    body::before {
      content:''; position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:0.35;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
    }

    /* KEYFRAMES */
    @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    @keyframes floatY { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-20px) rotate(5deg)} 66%{transform:translateY(-10px) rotate(-3deg)} }
    @keyframes glitch {
      0%,89%,100%{clip-path:none;transform:none;color:var(--accent1)}
      90%{clip-path:polygon(0 10%,100% 10%,100% 30%,0 30%);transform:translateX(-4px);color:#0ff}
      91%{clip-path:polygon(0 50%,100% 50%,100% 70%,0 70%);transform:translateX(4px);color:var(--accent3)}
      92%{clip-path:polygon(0 80%,100% 80%,100% 95%,0 95%);transform:translateX(-2px);color:var(--accent2)}
      93%{clip-path:none;transform:none}
    }
    @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px rgba(124,58,237,.3),0 0 60px rgba(0,212,255,.1)} 50%{box-shadow:0 0 40px rgba(124,58,237,.6),0 0 80px rgba(0,212,255,.2)} }
    @keyframes neonGlow { 0%,100%{text-shadow:0 0 10px var(--accent1),0 0 20px var(--accent1)} 50%{text-shadow:0 0 20px var(--accent1),0 0 40px var(--accent1),0 0 80px var(--accent1)} }
    @keyframes skeleton { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes progressFill { from{width:0%} }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes ripple-anim { to{transform:scale(4);opacity:0} }

    /* REVEAL */
    .reveal { opacity:0; transform:translateY(40px); transition:opacity .7s ease,transform .7s ease; }
    .reveal.visible { opacity:1; transform:translateY(0); }

    /* HERO */
    #hero {
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:linear-gradient(-45deg,#0a0a0f,#0d0d1f,#0a1020,#0f0a1f,#0a0a0f);
      background-size:400% 400%; animation:gradientShift 12s ease infinite;
    }
    .logo-glitch { animation:glitch 5s infinite,neonGlow 3s ease-in-out infinite; color:var(--accent1); }

    /* FEATURE CARDS */
    .feature-card {
      background:var(--card); border:1px solid var(--border); border-radius:20px;
      padding:1.75rem; transition:border-color .3s,box-shadow .3s,transform .1s;
      cursor:default; position:relative; overflow:hidden;
    }
    .feature-card::before {
      content:''; position:absolute; inset:0; border-radius:20px; padding:1px;
      background:var(--grad);
      -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
      -webkit-mask-composite:xor; mask-composite:exclude; opacity:0; transition:opacity .3s;
    }
    .feature-card:hover::before { opacity:1; }
    .feature-card:hover { box-shadow:0 20px 40px rgba(0,0,0,.3),0 0 40px rgba(124,58,237,.1); }
    .feature-icon { width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem; }
    .feature-title { font-size:1rem;font-weight:700;margin-bottom:.35rem; }
    .feature-desc { font-size:.83rem;color:var(--text-muted);line-height:1.6;margin-bottom:1rem; }

    /* MOCKUP */
    .mockup { background:var(--card2);border-radius:10px;padding:.75rem;margin-top:.75rem;min-height:80px; }
    .skeleton-line {
      height:10px;border-radius:5px;margin-bottom:8px;
      background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.05) 75%);
      background-size:200% 100%; animation:skeleton 1.5s infinite;
    }
    .progress-bar-wrap { background:rgba(255,255,255,.07);border-radius:999px;height:6px;overflow:hidden;margin-bottom:6px; }
    .progress-bar-fill { height:100%;border-radius:999px;width:0%; }
    .progress-bar-fill.loaded { animation:progressFill 1.2s ease forwards; }

    /* MISC */
    .problem-card:hover { border-color:var(--accent3);box-shadow:0 0 30px rgba(244,114,182,.15);transform:translateY(-4px); }
    .adv-card:hover { border-color:var(--accent2);box-shadow:0 0 30px rgba(124,58,237,.15);transform:translateY(-4px); }
    .btn-hero:hover,.btn-cta:hover { transform:scale(1.05);box-shadow:0 0 40px rgba(124,58,237,.5); }
    .btn-cta { animation:pulseGlow 3s ease-in-out infinite; }
    .ripple { position:absolute;border-radius:50%;background:rgba(255,255,255,.35);width:10px;height:10px;animation:ripple-anim .6s linear forwards;pointer-events:none; }
    .float-icon { position:absolute;font-size:1.5rem;animation:floatY var(--dur,6s) ease-in-out infinite;animation-delay:var(--delay,0s);opacity:.15;user-select:none;pointer-events:none; }
    #dot-nav a.active { opacity:1!important;transform:scale(1.4); }
    .stat-item { padding:2rem;border-radius:16px;background:var(--card);border:1px solid var(--border); }
    @media(max-width:640px){#dot-nav{display:none}body{cursor:auto}#cursor,#cursor-trail{display:none}}
  </style>
</head>
<body>

  <div id="cursor" style="position:fixed;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#7c3aed);pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;opacity:.8;"></div>
  <div id="cursor-trail" style="position:fixed;width:8px;height:8px;border-radius:50%;background:rgba(0,212,255,.5);pointer-events:none;z-index:99998;transform:translate(-50%,-50%);transition:all .15s;"></div>

  <nav id="dot-nav" style="position:fixed;right:1.5rem;top:50%;transform:translateY(-50%);z-index:1000;display:flex;flex-direction:column;gap:.6rem;">
    <a class="dot" href="#hero"       style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.4;transition:all .3s;display:block;"></a>
    <a class="dot" href="#problem"    style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.2;transition:all .3s;display:block;"></a>
    <a class="dot" href="#features"   style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.2;transition:all .3s;display:block;"></a>
    <a class="dot" href="#advantages" style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.2;transition:all .3s;display:block;"></a>
    <a class="dot" href="#stats"      style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.2;transition:all .3s;display:block;"></a>
    <a class="dot" href="#cta"        style="width:10px;height:10px;border-radius:50%;background:var(--accent1);opacity:.2;transition:all .3s;display:block;"></a>
  </nav>

  <!-- HERO -->
  <section id="hero">
    <canvas id="particles-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
    <div id="floating-icons" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;"></div>
    <div class="container" style="position:relative;z-index:2;text-align:center;padding-top:4rem;padding-bottom:4rem;">
      <div class="logo-glitch" style="font-size:4rem;font-weight:900;margin-bottom:1rem;display:inline-block;">₱</div>
      <h1 style="font-size:clamp(2.5rem,6vw,5rem);font-weight:900;line-height:1.1;margin-bottom:1rem;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Kantong Pintar</h1>
      <p id="typewriter" style="font-size:clamp(1rem,2vw,1.3rem);color:var(--text-muted);min-height:2rem;margin-bottom:2rem;"></p>
      <a href="#problem" class="btn-hero" style="display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 2.5rem;background:var(--grad);border-radius:999px;color:#fff;font-weight:600;font-size:1rem;text-decoration:none;margin-bottom:3rem;position:relative;overflow:hidden;transition:transform .3s,box-shadow .3s;">
        Jelajahi Fitur <span>↓</span>
      </a>
    </div>
  </section>

  <!-- PROBLEM -->
  <section id="problem" style="padding:6rem 0;background:var(--bg2);">
    <div class="container">
      <div class="reveal" style="text-align:center;margin-bottom:3rem;">
        <span style="color:var(--accent3);font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;">Kenyataan</span>
        <h2 style="font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-top:.5rem;">Kenapa Keuanganmu Perlu Dikelola?</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
        <div class="reveal problem-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;transition:all .3s;">
          <div style="font-size:2.5rem;margin-bottom:1rem;">😰</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem;">Tidak Tahu Uang Habis ke Mana</h3>
          <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;">Gajian tanggal 1, tapi tanggal 15 sudah habis — tanpa tahu ke mana perginya.</p>
        </div>
        <div class="reveal problem-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;transition:all .3s;" data-delay="100">
          <div style="font-size:2.5rem;margin-bottom:1rem;">📉</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem;">Tidak Punya Rencana Pensiun</h3>
          <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;">Pensiun terasa masih jauh, padahal semakin awal mulai, semakin besar hasilnya.</p>
        </div>
        <div class="reveal problem-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;transition:all .3s;" data-delay="200">
          <div style="font-size:2.5rem;margin-bottom:1rem;">🎯</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem;">Impian Finansial Tak Tercapai</h3>
          <p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;">Ingin beli rumah, liburan, atau dana darurat — tapi tidak ada sistem untuk mencapainya.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section id="features" style="padding:6rem 0;">
    <div class="container">
      <div class="reveal" style="text-align:center;margin-bottom:3rem;">
        <span style="color:var(--accent1);font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;">Solusi</span>
        <h2 style="font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-top:.5rem;">8 Fitur Lengkap dalam 1 Aplikasi</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">

        <div class="feature-card reveal">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(0,212,255,.2),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);">📊</div>
          <div class="feature-title">Dashboard</div>
          <div class="feature-desc">Ringkasan keuangan bulanan — pemasukan, pengeluaran, net worth, dan tren semua dalam satu layar.</div>
          <div class="mockup">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:.7rem;color:var(--text-dim);">Net Worth</span>
              <span style="font-size:.7rem;color:var(--positive);font-weight:600;">+2.3%</span>
            </div>
            <div class="skeleton-line" style="width:60%;"></div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <div style="flex:1;background:rgba(52,211,153,.15);border-radius:6px;padding:6px;text-align:center;">
                <div style="font-size:.65rem;color:var(--positive);">Masuk</div>
                <div class="skeleton-line" style="width:70%;margin:4px auto 0;"></div>
              </div>
              <div style="flex:1;background:rgba(248,113,113,.15);border-radius:6px;padding:6px;text-align:center;">
                <div style="font-size:.65rem;color:var(--negative);">Keluar</div>
                <div class="skeleton-line" style="width:70%;margin:4px auto 0;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="80">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(52,211,153,.2),rgba(52,211,153,.05));border:1px solid rgba(52,211,153,.3);">💳</div>
          <div class="feature-title">Transaksi</div>
          <div class="feature-desc">Catat setiap transaksi dengan kategori, catatan, dan tag. Filter dan cari dengan mudah.</div>
          <div class="mockup">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);">
              <div style="display:flex;gap:6px;align-items:center;">
                <div style="width:24px;height:24px;border-radius:6px;background:rgba(52,211,153,.2);display:flex;align-items:center;justify-content:center;font-size:.7rem;">🍔</div>
                <div><div class="skeleton-line" style="width:80px;margin-bottom:3px;"></div><div class="skeleton-line" style="width:50px;height:7px;"></div></div>
              </div>
              <span style="font-size:.7rem;color:var(--negative);">-Rp 45rb</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-top:4px;">
              <div style="display:flex;gap:6px;align-items:center;">
                <div style="width:24px;height:24px;border-radius:6px;background:rgba(52,211,153,.2);display:flex;align-items:center;justify-content:center;font-size:.7rem;">💰</div>
                <div><div class="skeleton-line" style="width:70px;margin-bottom:3px;"></div><div class="skeleton-line" style="width:45px;height:7px;"></div></div>
              </div>
              <span style="font-size:.7rem;color:var(--positive);">+Rp 8jt</span>
            </div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="160">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.05));border:1px solid rgba(251,191,36,.3);">📈</div>
          <div class="feature-title">Investasi</div>
          <div class="feature-desc">Pantau portofolio saham, reksa dana, obligasi, dan emas. Lihat gain/loss secara real-time.</div>
          <div class="mockup">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:.7rem;color:var(--text-dim);">Total Portofolio</span>
              <span style="font-size:.7rem;color:var(--positive);">+12.4%</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="background:linear-gradient(90deg,#fbbf24,#f59e0b);" data-width="72%"></div></div>
            <div style="display:flex;gap:4px;margin-top:6px;">
              <span style="font-size:.65rem;padding:2px 6px;background:rgba(251,191,36,.15);border-radius:4px;color:var(--warning);">Saham</span>
              <span style="font-size:.65rem;padding:2px 6px;background:rgba(52,211,153,.15);border-radius:4px;color:var(--positive);">Reksa Dana</span>
              <span style="font-size:.65rem;padding:2px 6px;background:rgba(0,212,255,.15);border-radius:4px;color:var(--accent1);">SBN</span>
            </div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="240">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(244,114,182,.2),rgba(244,114,182,.05));border:1px solid rgba(244,114,182,.3);">🎯</div>
          <div class="feature-title">Tujuan Finansial</div>
          <div class="feature-desc">Tetapkan tujuan — dana darurat, DP rumah, liburan — dan pantau progres menuju targetnya.</div>
          <div class="mockup">
            <div style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:.7rem;color:var(--text-muted);">Dana Darurat</span>
                <span style="font-size:.7rem;color:var(--accent3);">68%</span>
              </div>
              <div class="progress-bar-wrap"><div class="progress-bar-fill" style="background:linear-gradient(90deg,#f472b6,#a78bfa);" data-width="68%"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:.7rem;color:var(--text-muted);">DP Rumah</span>
                <span style="font-size:.7rem;color:var(--accent1);">31%</span>
              </div>
              <div class="progress-bar-wrap"><div class="progress-bar-fill" style="background:linear-gradient(90deg,#00d4ff,#7c3aed);" data-width="31%"></div></div>
            </div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="320">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.3);">🏖️</div>
          <div class="feature-title">Simulasi Pensiun</div>
          <div class="feature-desc">Hitung kapan kamu bisa pensiun berdasarkan aset, pengeluaran bulanan, dan return investasi.</div>
          <div class="mockup">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-size:.7rem;color:var(--text-dim);">Usia Pensiun Target</span>
              <span style="font-size:.85rem;font-weight:700;color:var(--accent2);">55 thn</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:.7rem;color:var(--text-dim);">Dana Dibutuhkan</span>
              <span style="font-size:.7rem;color:var(--accent1);">Rp 8.4M</span>
            </div>
            <div class="progress-bar-wrap" style="margin-top:8px;"><div class="progress-bar-fill" style="background:linear-gradient(90deg,#7c3aed,#a78bfa);" data-width="44%"></div></div>
            <span style="font-size:.65rem;color:var(--text-dim);">44% tercapai</span>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="400">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(0,212,255,.2),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);">📋</div>
          <div class="feature-title">Laporan</div>
          <div class="feature-desc">Grafik pengeluaran per kategori, tren bulanan, dan perbandingan periode untuk insight lebih dalam.</div>
          <div class="mockup" style="display:flex;align-items:flex-end;gap:4px;height:70px;">
            <div style="flex:1;background:rgba(0,212,255,.3);border-radius:4px 4px 0 0;height:40%;"></div>
            <div style="flex:1;background:rgba(0,212,255,.5);border-radius:4px 4px 0 0;height:60%;"></div>
            <div style="flex:1;background:rgba(0,212,255,.4);border-radius:4px 4px 0 0;height:45%;"></div>
            <div style="flex:1;background:rgba(0,212,255,.7);border-radius:4px 4px 0 0;height:80%;"></div>
            <div style="flex:1;background:rgba(0,212,255,.5);border-radius:4px 4px 0 0;height:55%;"></div>
            <div style="flex:1;background:rgba(124,58,237,.8);border-radius:4px 4px 0 0;height:90%;"></div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="480">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(52,211,153,.2),rgba(52,211,153,.05));border:1px solid rgba(52,211,153,.3);">📝</div>
          <div class="feature-title">Catatan</div>
          <div class="feature-desc">Simpan insight, rencana, atau pengingat finansial. Catatan terorganisir bersama data keuanganmu.</div>
          <div class="mockup">
            <div style="font-size:.72rem;color:var(--text-muted);line-height:1.5;font-style:italic;">"Review portofolio bulan ini — pertimbangkan rebalancing ke obligasi sebelum akhir kuartal..."</div>
            <div style="display:flex;gap:4px;margin-top:8px;">
              <span style="font-size:.65rem;padding:2px 8px;background:rgba(52,211,153,.15);border-radius:4px;color:var(--positive);">Investasi</span>
              <span style="font-size:.65rem;color:var(--text-dim);">1 Mei 2026</span>
            </div>
          </div>
        </div>

        <div class="feature-card reveal" data-delay="560">
          <div class="feature-icon" style="background:linear-gradient(135deg,rgba(107,114,128,.3),rgba(107,114,128,.1));border:1px solid rgba(107,114,128,.3);">⚙️</div>
          <div class="feature-title">Pengaturan</div>
          <div class="feature-desc">Kelola profil, tema tampilan, mata uang, dan preferensi notifikasi sesuai kebutuhanmu.</div>
          <div class="mockup">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);">
              <span style="font-size:.72rem;color:var(--text-muted);">Dark Mode</span>
              <div style="width:32px;height:18px;background:var(--accent2);border-radius:9px;position:relative;"><div style="width:14px;height:14px;background:#fff;border-radius:50%;position:absolute;right:2px;top:2px;"></div></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;margin-top:4px;">
              <span style="font-size:.72rem;color:var(--text-muted);">Mata Uang</span>
              <span style="font-size:.72rem;color:var(--accent1);font-weight:600;">IDR (Rp)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- ADVANTAGES -->
  <section id="advantages" style="padding:6rem 0;background:var(--bg2);">
    <div class="container">
      <div class="reveal" style="text-align:center;margin-bottom:3rem;">
        <span style="color:var(--accent2);font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;">Kenapa Kantong Pintar?</span>
        <h2 style="font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-top:.5rem;">Lebih dari Sekadar Catatan Keuangan</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;">
        <div class="reveal adv-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;text-align:center;transition:all .3s;">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(0,212,255,.2),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 1rem;">🔒</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:.5rem;">100% Privat &amp; Aman</h3>
          <p style="color:var(--text-muted);font-size:.85rem;line-height:1.6;">Data keuangan disimpan dengan enkripsi Supabase. Hanya kamu yang bisa mengaksesnya.</p>
        </div>
        <div class="reveal adv-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;text-align:center;transition:all .3s;" data-delay="100">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(124,58,237,.2),rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 1rem;">🇮🇩</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:.5rem;">Dirancang untuk Indonesia</h3>
          <p style="color:var(--text-muted);font-size:.85rem;line-height:1.6;">Rupiah, reksa dana, obligasi SBN — dibuat dari nol untuk pengguna Indonesia.</p>
        </div>
        <div class="reveal adv-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;text-align:center;transition:all .3s;" data-delay="200">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(244,114,182,.2),rgba(244,114,182,.05));border:1px solid rgba(244,114,182,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 1rem;">⚡</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:.5rem;">Real-time &amp; Responsif</h3>
          <p style="color:var(--text-muted);font-size:.85rem;line-height:1.6;">Perubahan data langsung terlihat di semua tampilan. Tidak perlu refresh, tidak ada delay.</p>
        </div>
        <div class="reveal adv-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;text-align:center;transition:all .3s;" data-delay="300">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,rgba(52,211,153,.2),rgba(52,211,153,.05));border:1px solid rgba(52,211,153,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 1rem;">📊</div>
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:.5rem;">Visibilitas Penuh</h3>
          <p style="color:var(--text-muted);font-size:.85rem;line-height:1.6;">Dashboard komprehensif — net worth, investasi, tujuan, pengeluaran — semua dalam satu pandangan.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- STATS -->
  <section id="stats" style="padding:6rem 0;">
    <div class="container">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2rem;text-align:center;">
        <div class="reveal stat-item">
          <div class="count-up" data-target="8" style="font-size:4rem;font-weight:900;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">0</div>
          <p style="color:var(--text-muted);margin-top:.5rem;font-size:.9rem;">Fitur Lengkap</p>
        </div>
        <div class="reveal stat-item" data-delay="100">
          <div class="count-up" data-target="100" style="font-size:4rem;font-weight:900;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">0</div>
          <p style="color:var(--text-muted);margin-top:.5rem;font-size:.9rem;">% Privat &amp; Aman</p>
        </div>
        <div class="reveal stat-item" data-delay="200">
          <div class="count-up" data-target="1" style="font-size:4rem;font-weight:900;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">0</div>
          <p style="color:var(--text-muted);margin-top:.5rem;font-size:.9rem;">Platform Terintegrasi</p>
        </div>
        <div class="reveal stat-item" data-delay="300">
          <div class="count-up" data-target="24" style="font-size:4rem;font-weight:900;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">0</div>
          <p style="color:var(--text-muted);margin-top:.5rem;font-size:.9rem;">Jam Tersedia</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section id="cta" style="padding:8rem 0;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,212,255,.1),rgba(124,58,237,.15),rgba(244,114,182,.1));"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.15),transparent 70%);pointer-events:none;"></div>
    <div class="container" style="position:relative;z-index:2;text-align:center;">
      <div class="reveal">
        <h2 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:900;margin-bottom:1rem;line-height:1.2;">Siap Kendalikan<br><span style="background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Keuanganmu?</span></h2>
        <p style="color:var(--text-muted);font-size:1.1rem;margin-bottom:2.5rem;max-width:480px;margin-left:auto;margin-right:auto;">Mulai perjalanan finansialmu hari ini. Gratis, privat, dan dirancang khusus untuk kamu.</p>
        <a href="/" class="btn-cta" style="display:inline-flex;align-items:center;gap:.75rem;padding:1.1rem 3rem;background:linear-gradient(135deg,#00d4ff,#7c3aed);border-radius:999px;color:#fff;font-weight:700;font-size:1.1rem;text-decoration:none;position:relative;overflow:hidden;transition:transform .3s,box-shadow .3s;box-shadow:0 0 40px rgba(124,58,237,.4);">
          <span>Mulai Sekarang</span> <span style="font-size:1.2rem;">→</span>
        </a>
      </div>
    </div>
  </section>

  <footer style="text-align:center;padding:2rem;color:#374151;font-size:.8rem;">
    © 2026 Kantong Pintar — Personal Finance Manager
  </footer>

  <script>
    /* CUSTOM CURSOR */
    const cursor=document.getElementById('cursor'),trail=document.getElementById('cursor-trail');
    let mx=0,my=0,tx=0,ty=0;
    document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
    (function animCursor(){tx+=(mx-tx)*.18;ty+=(my-ty)*.18;cursor.style.left=mx+'px';cursor.style.top=my+'px';trail.style.left=tx+'px';trail.style.top=ty+'px';requestAnimationFrame(animCursor);})();
    document.addEventListener('mousedown',()=>{cursor.style.transform='translate(-50%,-50%) scale(0.7)';});
    document.addEventListener('mouseup',()=>{cursor.style.transform='translate(-50%,-50%) scale(1)';});

    /* PARTICLES */
    (function(){
      const canvas=document.getElementById('particles-canvas'),ctx=canvas.getContext('2d');
      let W,H,pts=[];
      function resize(){W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;}
      resize();window.addEventListener('resize',resize);
      for(let i=0;i<80;i++) pts.push({x:Math.random()*1200,y:Math.random()*800,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,r:Math.random()*2+.5,c:['#00d4ff','#7c3aed','#f472b6'][Math.floor(Math.random()*3)]});
      function draw(){
        ctx.clearRect(0,0,W,H);
        for(let i=0;i<pts.length;i++){
          const p=pts[i];p.x+=p.vx;p.y+=p.vy;
          if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
          ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.c;ctx.globalAlpha=.6;ctx.fill();
          for(let j=i+1;j<pts.length;j++){
            const q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
            if(d<120){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=p.c;ctx.globalAlpha=(1-d/120)*.15;ctx.lineWidth=.5;ctx.stroke();}
          }
        }
        ctx.globalAlpha=1;requestAnimationFrame(draw);
      }
      draw();
    })();

    /* TYPEWRITER */
    (function(){
      const el=document.getElementById('typewriter');
      const lines=['Kelola keuanganmu dengan lebih cerdas.','Pantau investasi, goals, dan pensiun.','Satu platform untuk semua kebutuhan finansial.'];
      let li=0,ci=0,del=false;
      function tick(){
        const line=lines[li];
        if(!del){el.textContent=line.slice(0,++ci);if(ci===line.length){del=true;setTimeout(tick,2000);return;}}
        else{el.textContent=line.slice(0,--ci);if(ci===0){del=false;li=(li+1)%lines.length;setTimeout(tick,400);return;}}
        setTimeout(tick,del?40:70);
      }
      tick();
    })();

    /* FLOATING ICONS */
    (function(){
      const c=document.getElementById('floating-icons');
      ['₱','📈','🎯','💰','🏖️','📊','💳','🔒','📋','⚡'].forEach((ic,i)=>{
        const el=document.createElement('span');el.className='float-icon';el.textContent=ic;
        el.style.left=(8+i*9)+'%';el.style.top=(10+Math.random()*70)+'%';
        el.style.setProperty('--dur',(5+i*.7)+'s');el.style.setProperty('--delay',(i*.4)+'s');
        c.appendChild(el);
      });
    })();

    /* SCROLL REVEAL */
    (function(){
      const obs=new IntersectionObserver(entries=>{
        entries.forEach(e=>{
          if(!e.isIntersecting)return;
          const delay=parseInt(e.target.dataset.delay||0);
          setTimeout(()=>e.target.classList.add('visible'),delay);
          e.target.querySelectorAll('.progress-bar-fill').forEach(bar=>{
            setTimeout(()=>{bar.style.width=bar.dataset.width;bar.classList.add('loaded');},delay+300);
          });
          e.target.querySelectorAll('.skeleton-line').forEach((sk,idx)=>{
            setTimeout(()=>{sk.style.background='rgba(255,255,255,.08)';sk.style.animation='none';},delay+800+idx*100);
          });
          obs.unobserve(e.target);
        });
      },{threshold:.15});
      document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
    })();

    /* COUNT-UP */
    (function(){
      const obs=new IntersectionObserver(entries=>{
        entries.forEach(e=>{
          if(!e.isIntersecting)return;
          const target=parseInt(e.target.dataset.target);let cur=0;
          const step=Math.ceil(target/40);
          const iv=setInterval(()=>{cur=Math.min(cur+step,target);e.target.textContent=cur;if(cur>=target)clearInterval(iv);},35);
          obs.unobserve(e.target);
        });
      },{threshold:.5});
      document.querySelectorAll('.count-up').forEach(el=>obs.observe(el));
    })();

    /* 3D TILT */
    document.querySelectorAll('.feature-card').forEach(card=>{
      card.addEventListener('mousemove',e=>{
        const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`perspective(600px) rotateY(${x*12}deg) rotateX(${-y*12}deg) translateZ(8px)`;
      });
      card.addEventListener('mouseleave',()=>{card.style.transform='';});
    });

    /* RIPPLE */
    document.querySelectorAll('.btn-hero,.btn-cta').forEach(btn=>{
      btn.addEventListener('click',e=>{
        const r=btn.getBoundingClientRect(),rip=document.createElement('span');
        rip.className='ripple';rip.style.left=(e.clientX-r.left-5)+'px';rip.style.top=(e.clientY-r.top-5)+'px';
        btn.appendChild(rip);setTimeout(()=>rip.remove(),700);
      });
    });

    /* DOT NAV */
    (function(){
      const secs=['hero','problem','features','advantages','stats','cta'];
      const dots=document.querySelectorAll('#dot-nav .dot');
      function update(){
        let cur=0;
        secs.forEach((id,i)=>{const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=window.innerHeight*.5)cur=i;});
        dots.forEach((d,i)=>d.classList.toggle('active',i===cur));
      }
      window.addEventListener('scroll',update,{passive:true});update();
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Buka `public/intro.html` di browser, verifikasi semua animasi**

Expected checklist:
- Particles canvas bergerak di hero ✓
- Typewriter mengetik + menghapus teks ✓
- Scroll reveal: cards muncul satu per satu ✓
- Progress bars terisi saat card terlihat ✓
- Stats count-up dari 0 ke target ✓
- 3D tilt saat hover feature card ✓
- Ripple saat klik tombol CTA ✓
- Dot nav update sesuai posisi scroll ✓
- Custom cursor mengikuti mouse ✓
- Glitch + neon glow pada logo ₱ ✓

- [ ] **Step 3: Commit**

```bash
git add public/intro.html
git commit -m "feat: add intro.html — animated Kantong Pintar landing page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Hero: particles, gradient shift, typewriter, floating icons, glitch logo, neon glow
- ✅ Problem: 3 pain points, scroll-reveal
- ✅ 8 fitur: mockup mini, skeleton loader, progress bars, 3D card tilt, gradient border hover
- ✅ Keunggulan: 4 cards
- ✅ Stats: count-up
- ✅ CTA: pulse glow, ripple click, radial gradient bg
- ✅ Custom cursor + trail
- ✅ Floating dot nav
- ✅ Single file, zero runtime deps

**Placeholder scan:** Tidak ada TBD/TODO.

**Type consistency:** CSS class names konsisten di seluruh file (`.reveal`, `.feature-card`, `.progress-bar-fill`, `.count-up`, `.btn-cta`).
