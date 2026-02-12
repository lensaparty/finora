# Finora Dashboard

Finora adalah dashboard keuangan berbasis React + Firebase untuk bisnis project-based.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Auth: Firebase Authentication (Email/Password + Google)
- Database: Cloud Firestore
- Hosting (recommended): Vercel

## Local Setup

1. Install dependency:

```bash
npm install
```

2. Copy env:

```bash
cp .env.example .env
```

3. Isi semua variable Firebase di `.env`.

4. Jalankan app:

```bash
npm run dev
```

## Firebase Rules (Required)

Publish rules berikut di Firestore:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == resource.data.user_id;
    }

    match /projects/{docId} {
      allow read, update, delete: if isOwner();
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    match /transactions/{docId} {
      allow read, update, delete: if isOwner();
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    match /debts/{docId} {
      allow read, update, delete: if isOwner();
      allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
    }

    match /profiles/{userId} {
      allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Deploy to GitHub

1. Init repo (jika belum):

```bash
git init
git add .
git commit -m "feat: finora mvp ready for deploy"
```

2. Push ke GitHub:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git branch -M main
git push -u origin main
```

## Deploy to Vercel

1. Import repo di Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Isi Environment Variables (sesuai `.env.example`).
6. Deploy.

`vercel.json` sudah ditambahkan untuk SPA rewrite.

## Post-Deploy Checklist

1. Login email/password berhasil.
2. Login Google berhasil.
3. CRUD Project/Transaksi/Hutang berhasil.
4. Simpan profile berhasil.
5. Export laporan PDF/CSV berjalan.
6. Refresh halaman deep route tetap aman (`/` rewrite via `vercel.json`).

## Notes

- Folder `server/` tidak diperlukan untuk hosting frontend di Vercel.
- Data production sepenuhnya disimpan di Firebase (Auth + Firestore).
