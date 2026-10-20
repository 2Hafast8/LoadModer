# LoadModer Official Website (GitHub Pages Branch)

Branch ini (`gh-pages`) didedikasikan secara khusus untuk menampung berkas website promosi dan landing page resmi **LoadModer** yang dipublikasikan secara otomatis melalui **GitHub Pages**.

---

## 🌐 Cara Menghubungkan Custom Domain (CNAME)

Jika Anda ingin menggunakan domain kustom (misal `loadmoder.com`, `loadmoder.app`, atau `getloadmoder.xyz`):

1. **Buat file `CNAME`** di root branch ini dengan nama domain Anda (contoh isi: `loadmoder.com`).
2. **Arahkan DNS di Registrar Domain Anda**:
   - Untuk **Apex Domain** (`loadmoder.com`), buat 4 DNS Record tipe `A`:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Untuk **Subdomain** (`www.loadmoder.com`), buat DNS Record tipe `CNAME`:
     - Target: `2hafast8.github.io`
3. **Aktifkan HTTPS**: Di menu *Settings > Pages* di repository GitHub, centang *"Enforce HTTPS"*.

Jika tanpa custom domain, website dapat langsung diakses di:  
👉 **`https://2hafast8.github.io/LoadModer/`**

---

## 📦 Isolasi Branch

Branch ini beroperasi sebagai **orphan branch** yang terpisah dari branch aplikasi utama (`dev` dan `main`), sehingga berkas website tidak akan pernah mencemari atau memperberat kode sumber aplikasi LoadModer.
