
"""
Generate barang random via POST /api/barang.

Stdlib saja - tidak membutuhkan pip install.

Fitur:
  - variantId random dari GET /api/products
  - status random
  - tanggal random
  - keterangan random
  - batchId opsional/random jika tersedia
  - kodeBarang tidak dikirim agar backend auto-generate
  - bisa membuat banyak barang sekaligus

Contoh:

  python tambah_barang_random.py --jumlah 10

  python tambah_barang_random.py --jumlah 100 --delay 0.1

  python tambah_barang_random.py --jumlah 1000 --status REGISTER

  python tambah_barang_random.py --jumlah 100 --api-url http://192.168.100.250:8000/api

  python tambah_barang_random.py --list-variant

  python tambah_barang_random.py -i
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

from datetime import datetime, timedelta
from pathlib import Path


# ============================================================
# KONFIGURASI
# ============================================================

STATUS_VALID = [
    "REGISTER",
    "FINISHGOOD"
]

DEFAULT_URL = "http://localhost:8000/api"

KETERANGAN_RANDOM = [
    "Barang dibuat untuk testing",
    "Barang hasil input random",
    "Data testing barang",
    "Barang dibuat secara otomatis",
    "Barang dummy",
    "Testing sistem inventory",
    "Generate barang random",
    "Data simulasi",
]


# ============================================================
# LOAD API URL
# ============================================================

def load_base_url(cli_url=None):
    """
    Prioritas:
      1. --api-url
      2. API_URL
      3. VITE_API_URL
      4. frontend/.env
      5. .env
      6. DEFAULT_URL
    """

    if cli_url:
        return cli_url.rstrip("/")

    env_url = os.getenv("API_URL") or os.getenv("VITE_API_URL")

    if env_url:
        return env_url.rstrip("/")

    try:
        root = Path(__file__).resolve().parent

        for cand in [
            root / "frontend" / ".env",
            root / ".env",
        ]:
            if not cand.exists():
                continue

            for line in cand.read_text(
                encoding="utf-8",
                errors="ignore"
            ).splitlines():

                line = line.strip()

                if (
                    not line
                    or line.startswith("#")
                    or "=" not in line
                ):
                    continue

                k, v = line.split("=", 1)

                k = k.strip()
                v = v.strip().strip('"').strip("'")

                if k in ("VITE_API_URL", "API_URL") and v:
                    return v.rstrip("/")

    except Exception:
        pass

    return DEFAULT_URL


# ============================================================
# HTTP
# ============================================================

def http_json(
    method,
    url,
    data=None,
    timeout=15
):
    body = (
        json.dumps(data).encode("utf-8")
        if data is not None
        else None
    )

    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(
            req,
            timeout=timeout
        ) as res:

            raw = res.read().decode("utf-8")

            return (
                res.status,
                json.loads(raw or "{}")
            )

    except urllib.error.HTTPError as e:

        try:
            err_body = json.loads(
                e.read().decode("utf-8")
            )

            msg = (
                err_body.get("message")
                or err_body.get("error")
                or str(err_body)
            )

        except Exception:
            msg = e.reason or f"HTTP {e.code}"

        raise RuntimeError(
            f"Gagal ({e.code}): {msg}"
        )

    except urllib.error.URLError as e:

        raise RuntimeError(
            f"Koneksi gagal ke {url}: {e.reason}"
        )


# ============================================================
# GET PRODUCTS / VARIANTS
# ============================================================

def get_variants(base_url, timeout=15):
    """
    GET /products

    Mengambil semua variant yang tersedia.

    Return:
        [
            {
                "id": 1,
                "kodeVariant": "W001",
                "nama": "..."
            }
        ]
    """

    _, products = http_json(
        "GET",
        f"{base_url}/products",
        timeout=timeout,
    )

    if isinstance(products, dict):
        products = products.get("data", products)

    if not isinstance(products, list):
        raise RuntimeError(
            "Response /products bukan array."
        )

    variants = []

    for product in products:

        product_name = product.get(
            "nama",
            "Unknown Product"
        )

        product_variants = product.get(
            "variants",
            []
        )

        for variant in product_variants:

            variant_id = variant.get("id")

            if variant_id is None:
                continue

            style = variant.get("style") or {}
            color = variant.get("color") or {}
            size = variant.get("size") or {}

            nama = (
                f"{product_name} / "
                f"{style.get('nama', '-')} / "
                f"{color.get('nama', '-')} / "
                f"{size.get('nama', '-')}"
            )

            variants.append({
                "id": variant_id,
                "kodeVariant": variant.get(
                    "kodeVariant",
                    "-"
                ),
                "nama": nama,
            })

    if not variants:
        raise RuntimeError(
            "Tidak ada variant yang ditemukan dari /products."
        )

    return variants


# ============================================================
# LIST VARIANTS
# ============================================================

def list_variants(base_url, timeout=15):

    print(f"GET {base_url}/products")

    variants = get_variants(
        base_url,
        timeout
    )

    print()

    print(
        f"{'ID':<8}"
        f"{'KODE':<12}"
        f"NAMA"
    )

    print("-" * 80)

    for variant in variants:

        print(
            f"{str(variant['id']):<8}"
            f"{str(variant['kodeVariant']):<12}"
            f"{variant['nama']}"
        )

    print()
    print(f"Total variant: {len(variants)}")


# ============================================================
# RANDOM DATE
# ============================================================

def today_date():
    return datetime.now().isoformat()
 


# ============================================================
# RANDOM STATUS
# ============================================================

def random_status():
    return random.choice(
        STATUS_VALID
    )


# ============================================================
# RANDOM KETERANGAN
# ============================================================

def random_keterangan():
    return random.choice(
        KETERANGAN_RANDOM
    )


# ============================================================
# BUILD RANDOM PAYLOAD
# ============================================================

def build_random_payload(
    variants,
    fixed_status=None,
    batch_id=None,
    random_batch=False,
    days_back=30,
    days_forward=0,
):
    """
    Membuat payload random.

    variantId:
        random dari database

    status:
        random kecuali --status diberikan

    tanggal:
        random

    keterangan:
        random

    kodeBarang:
        sengaja tidak dikirim.
        Backend akan auto-generate.
    """

    variant = random.choice(variants)

    if fixed_status:
        status = fixed_status
    else:
        status = random_status()

    payload = {
        "variantId": int(
            variant["id"]
        ),
        "status": status,
        "tanggal": today_date(),
        "keterangan": random_keterangan(),
    }

    # --------------------------------------------------------
    # Batch
    # --------------------------------------------------------

    if batch_id is not None:
        payload["batchId"] = int(batch_id)

    elif random_batch:
        # Jika ingin random batch, isi di sini.
        #
        # Untuk keamanan default-nya tidak diaktifkan,
        # karena kita tidak tahu batchId yang valid.
        pass

    return payload


# ============================================================
# POST BARANG
# ============================================================

def post_barang(
    base_url,
    payload,
    timeout=15
):

    _, data = http_json(
        "POST",
        f"{base_url}/barang",
        payload,
        timeout
    )

    return data


# ============================================================
# INTERACTIVE
# ============================================================

def interactive_args(args):

    if args.jumlah is None:

        value = input(
            "Jumlah barang [10]: "
        ).strip()

        args.jumlah = (
            int(value)
            if value
            else 10
        )

    if args.status is None:

        value = input(
            "Status random? [Y/n]: "
        ).strip().lower()

        if value == "n":

            print()
            print(
                "Status valid:",
                ", ".join(STATUS_VALID)
            )

            status = input(
                "Pilih status: "
            ).strip().upper()

            if status not in STATUS_VALID:

                print(
                    "Status tidak valid."
                )

                sys.exit(1)

            args.status = status

    if args.batch_id is None:

        value = input(
            "batchId (kosong = tidak dikirim): "
        ).strip()

        if value:
            args.batch_id = int(value)

    return args


# ============================================================
# MAIN
# ============================================================

def main():

    ap = argparse.ArgumentParser(
        description=(
            "Generate barang random "
            "via POST /api/barang"
        )
    )

    ap.add_argument(
        "--api-url",
        default=None,
        help=(
            "Base API URL, contoh: "
            "http://192.168.100.250:8000/api"
        ),
    )

    ap.add_argument(
        "--jumlah",
        type=int,
        default=1,
        help=(
            "Jumlah barang yang dibuat "
            "(default: 1)"
        ),
    )

    ap.add_argument(
        "--status",
        choices=STATUS_VALID,
        default=None,
        help=(
            "Gunakan status tertentu. "
            "Jika tidak diisi, status random."
        ),
    )

    ap.add_argument(
        "--batch-id",
        type=int,
        default=None,
        help=(
            "Gunakan batchId tertentu "
            "untuk semua barang."
        ),
    )

    ap.add_argument(
        "--days-back",
        type=int,
        default=30,
        help=(
            "Tanggal random maksimal "
            "mundur berapa hari (default: 30)."
        ),
    )

    ap.add_argument(
        "--days-forward",
        type=int,
        default=0,
        help=(
            "Tanggal random maksimal "
            "maju berapa hari (default: 0)."
        ),
    )

    ap.add_argument(
        "--delay",
        type=float,
        default=0,
        help=(
            "Jeda antar POST dalam detik. "
            "Contoh: --delay 0.1"
        ),
    )

    ap.add_argument(
        "--timeout",
        type=int,
        default=15,
        help="HTTP timeout dalam detik.",
    )

    ap.add_argument(
        "--list-variant",
        action="store_true",
        help="Tampilkan semua variant.",
    )

    ap.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Mode tanya-jawab.",
    )

    args = ap.parse_args()

    # --------------------------------------------------------
    # API URL
    # --------------------------------------------------------

    base_url = load_base_url(
        args.api_url
    )

    # --------------------------------------------------------
    # LIST VARIANT
    # --------------------------------------------------------

    if args.list_variant:

        try:

            list_variants(
                base_url,
                args.timeout
            )

        except Exception as e:

            print(
                f"ERROR: {e}",
                file=sys.stderr
            )

            sys.exit(1)

        return

    # --------------------------------------------------------
    # INTERACTIVE
    # --------------------------------------------------------

    if args.interactive:

        args = interactive_args(args)

    # --------------------------------------------------------
    # VALIDASI JUMLAH
    # --------------------------------------------------------

    if args.jumlah < 1:

        print(
            "--jumlah minimal 1.",
            file=sys.stderr
        )

        sys.exit(1)

    # --------------------------------------------------------
    # LOAD VARIANT
    # --------------------------------------------------------

    print(
        f"API     : {base_url}"
    )

    print(
        "Mengambil daftar variant..."
    )

    try:

        variants = get_variants(
            base_url,
            args.timeout
        )

    except Exception as e:

        print(
            f"Gagal mengambil variant: {e}",
            file=sys.stderr
        )

        sys.exit(1)

    print(
        f"Variant : {len(variants)} tersedia"
    )

    # --------------------------------------------------------
    # INFO
    # --------------------------------------------------------

    if args.status:

        print(
            f"Status  : {args.status}"
        )

    else:

        print(
            "Status  : RANDOM"
        )

    print(
        f"Jumlah  : {args.jumlah}"
    )

    print(
        f"Tanggal : RANDOM "
        f"({args.days_back} hari ke belakang)"
    )

    print(
        "Kode    : AUTO-GENERATE BACKEND"
    )

    print()

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    success = 0
    failed = 0

    for i in range(args.jumlah):

        payload = build_random_payload(
            variants=variants,
            fixed_status=args.status,
            batch_id=args.batch_id,
            days_back=args.days_back,
            days_forward=args.days_forward,
        )

        try:

            created = post_barang(
                base_url,
                payload,
                args.timeout
            )

            success += 1

            kode_barang = created.get(
                "kodeBarang",
                "-"
            )

            barang_id = created.get(
                "id",
                "-"
            )

            print(
                f"[{i + 1}/{args.jumlah}] "
                f"OK | "
                f"id={barang_id} | "
                f"kode={kode_barang} | "
                f"variant={payload['variantId']} | "
                f"status={payload['status']}"
            )

        except Exception as e:

            failed += 1

            print(
                f"[{i + 1}/{args.jumlah}] "
                f"FAILED | {e}",
                file=sys.stderr
            )

        # ----------------------------------------------------
        # DELAY
        # ----------------------------------------------------

        if (
            args.delay > 0
            and i < args.jumlah - 1
        ):

            time.sleep(
                args.delay
            )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("SELESAI")
    print("=" * 60)

    print(
        f"Berhasil : {success}"
    )

    print(
        f"Gagal    : {failed}"
    )

    print(
        f"Total    : {args.jumlah}"
    )

    # Return error jika ada request gagal

    if failed:

        sys.exit(1)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()

