# Design Document: Website Bisnis Profesional

## 1. Overview
Dokumen ini mendefinisikan desain visual, struktur, dan pengalaman pengguna untuk website bisnis profesional. Website ini bertujuan untuk membangun kredibilitas, menarik klien potensial, dan mengonversi pengunjung menjadi leads.

**Tujuan utama:**
- Menampilkan brand identity yang profesional dan modern
- Menyediakan informasi layanan, portfolio, dan kontak dengan jelas
- Mobile-first dan fully responsive
- Loading cepat dan SEO-friendly

**Target audiens:**
- Calon klien B2B / B2C
- Partner bisnis
- Investor atau stakeholder

---

## 2. Brand Identity

### 2.1 Logo
- Versi primary: Logo full color (horizontal)
- Versi secondary: Logo monochrome (putih & hitam)
- Favicon: Versi simplified dari logo
- Ukuran minimum: 120px lebar untuk header

### 2.2 Color Palette

| Nama          | Hex       | Penggunaan                          |
|---------------|-----------|-------------------------------------|
| Primary       | `#1E3A5F` | Header, tombol utama, heading       |
| Primary Dark  | `#0F1C2E` | Hover state, footer                 |
| Accent        | `#00A8E8` | CTA button, link, highlight         |
| Accent Hover  | `#0088C0` | Hover pada accent                   |
| Neutral 100   | `#FFFFFF` | Background utama                    |
| Neutral 200   | `#F5F7FA` | Section background, card            |
| Neutral 500   | `#6B7280` | Body text secondary                 |
| Neutral 800   | `#1F2937` | Body text primary                   |
| Success       | `#10B981` | Success message                     |
| Error         | `#EF4444` | Error message                       |

### 2.3 Typography

**Font Family:**
- Heading: `Inter` atau `Poppins` (sans-serif modern)
- Body: `Inter` atau `System UI`

**Type Scale:**

| Element       | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------------|----------------|---------------|--------|-------------|
| H1            | 48px           | 32px          | 700    | 1.2         |
| H2            | 36px           | 28px          | 600    | 1.3         |
| H3            | 24px           | 20px          | 600    | 1.4         |
| H4            | 20px           | 18px          | 500    | 1.4         |
| Body Large    | 18px           | 16px          | 400    | 1.6         |
| Body          | 16px           | 15px          | 400    | 1.6         |
| Small / Caption | 14px         | 13px          | 400    | 1.5         |
| Button        | 16px           | 15px          | 500    | 1            |

---

## 3. Layout & Grid System

### 3.1 Container
- Max-width: `1280px`
- Padding horizontal: `24px` (mobile) → `48px` (desktop)
- Grid: 12-column responsive

### 3.2 Spacing Scale
Gunakan sistem spacing 4px / 8px:
- 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128px

### 3.3 Section Spacing
- Antar section: `80px` (desktop) / `48px` (mobile)
- Padding section vertical: `64px–96px`

---

## 4. Struktur Halaman

### 4.1 Halaman Utama (Home)
1. **Header / Navigation**
2. **Hero Section**
3. **Services / Layanan**
4. **About / Tentang Kami** (ringkas)
5. **Portfolio / Case Studies**
6. **Testimonials**
7. **CTA Section**
8. **Footer**

### 4.2 Halaman Lainnya
- **About Us** (detail)
- **Services** (detail setiap layanan)
- **Portfolio / Projects**
- **Blog / Insights** (opsional)
- **Contact**
- **Privacy Policy & Terms**

---

## 5. Komponen UI

### 5.1 Header
- Sticky / fixed
- Logo kiri
- Menu navigasi tengah/kanan
- CTA button "Hubungi Kami" di kanan
- Mobile: Hamburger menu + drawer

**Height:** 72px (desktop) / 64px (mobile)

### 5.2 Hero Section
- Background: Gradient subtle atau image profesional + overlay gelap
- Headline besar + subheadline
- Primary CTA + Secondary CTA (outline)
- Optional: trust badges / client logos di bawah

### 5.3 Button Styles

| Variant       | Background     | Text     | Border          | Hover                  |
|---------------|----------------|----------|-----------------|------------------------|
| Primary       | `#00A8E8`      | White    | none            | `#0088C0`              |
| Secondary     | Transparent    | Primary  | 2px Primary     | Background Primary light |
| Ghost         | Transparent    | Neutral  | none            | Background Neutral 200 |

- Border radius: `8px`
- Padding: `12px 24px`
- Font weight: 500

### 5.4 Card
- Background: White
- Border radius: `12px`
- Shadow: `0 4px 20px rgba(0,0,0,0.06)`
- Padding: `24px`
- Hover: slight lift + stronger shadow

### 5.5 Form Elements
- Input height: `48px`
- Border radius: `8px`
- Border: `1px solid #D1D5DB`
- Focus: border Accent + ring subtle
- Label: di atas input, font 14px medium

### 5.6 Footer
- Background: Primary Dark (`#0F1C2E`)
- Text: putih / abu-abu muda
- 4 kolom (desktop): Logo + deskripsi, Navigasi, Kontak, Sosial media
- Copyright di bawah

---

## 6. Responsive Breakpoints

| Breakpoint | Width     | Target          |
|------------|-----------|-----------------|
| Mobile     | < 640px   | Smartphone      |
| Tablet     | 640–1023px| Tablet          |
| Desktop    | ≥ 1024px  | Laptop & Desktop|

---

## 7. Interaction & Motion

- Transition default: `200ms ease`
- Hover pada card & button: scale ringan atau shadow change
- Scroll animation: fade-in + slight translateY (opsional, gunakan Intersection Observer)
- Page transition: soft fade (jika SPA)

---

## 8. Accessibility (a11y)

- Kontras warna minimal WCAG AA
- Semua interaktif element bisa diakses keyboard
- Alt text untuk semua gambar
- Focus visible yang jelas
- Semantic HTML (header, nav, main, section, footer)

---

## 9. Performance Guidelines

- Optimasi gambar (WebP + lazy loading)
- Font loading: `font-display: swap`
- Critical CSS inline
- Target Lighthouse score: Performance ≥ 90, Accessibility ≥ 95

---

## 10. Asset & File Structure (Rekomendasi)

```
/public
  /images
    logo.svg
    hero.webp
    ...
  /icons
/src
  /components
    Header.tsx
    Footer.tsx
    Button.tsx
    Card.tsx
    ...
  /sections
    Hero.tsx
    Services.tsx
    ...
  /styles
    globals.css
    variables.css
```

---

## 11. Next Steps
1. Buat high-fidelity mockup di Figma berdasarkan dokumen ini
2. Siapkan design system / component library
3. Implementasi di framework (Next.js / React / Vue)
4. Testing usability & accessibility

---

**Versi dokumen:** 1.0  
**Tanggal:** 9 September 2026  
**Status:** Draft untuk review
