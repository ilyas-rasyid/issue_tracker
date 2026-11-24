# Mini Issue Tracker

Aplikasi pelacak isu, tiket bug, dan tugas pengembangan perangkat lunak (_issue & bug tracker_) ramah _developer_. Berfungsi untuk mengelola alur kerja multi-proyek, mencatat tiket masalah beserta tingkatan prioritas dan status progres, merekam riwayat aktivitas/perubahan (_audit activity_), serta menyimpan lampiran berkas secara aman menggunakan object storage.

---

## Prasyarat

- [Bun](https://bun.sh/) (v1.2+)
- [Docker & Docker Compose](https://docs.docker.com/compose/)

---

## Cara Menjalankan

### 1. Install Dependensi

```bash
bun install
```

### 2. Setup Environment Variables

Salin konfigurasi environment untuk backend:

```bash
cp be/.env.example be/.env
```

### 3. Nyalakan Services Pendukung (Docker Compose)

Nyalakan PostgreSQL, Silo (S3 Object Storage), dan Mailpit:

```bash
docker compose up -d
```

### 4. Setup Database & Seeding Data

Generate Prisma client, jalankan migrasi database, lalu buat akun demo awal:

```bash
bun run db:generate
bun run db:migrate

# Jalankan seeder akun demo
SEED_DEMO_PASSWORD='DemoPassword123!' bun run db:seed
```

### 5. Jalankan Aplikasi

Jalankan backend API dan frontend web secara bersamaan:

```bash
bun run dev
```

_(Atau dapat dijalankan di dua terminal terpisah: `bun run dev:api` dan `bun run dev:web`)._

- **Frontend Web**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Mailpit Web UI (Dev Inbox)**: [http://localhost:8025](http://localhost:8025)
- **S3 Storage Console**: [http://localhost:9001](http://localhost:9001)

---

## Akun Demo Login

Akun bawaan hasil _seed_:

- **Email**: `demo@localhost.test`
- **Username**: `demo_developer`
- **Password**: Sesuai yang dimasukkan pada variabel `SEED_DEMO_PASSWORD` saat _seeding_ (contoh: `DemoPassword123!`).

_(Catatan: Anda juga dapat membuat akun baru secara langsung melalui menu pendaftaran / register di halaman web)._
