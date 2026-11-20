# Komite Takip

2026–2027 CTF preklinik programındaki Dönem 1 öğrencileri için hazırlanmış,
1002–1004 komitelerini güncel tarihe göre takip eden lokal web uygulaması.

## Çalıştırma

Gerekenler: Python 3 veya eşdeğer bir statik dosya sunucusu.

```bash
npm start
```

Ardından [http://localhost:4173](http://localhost:4173) adresini açın. Uygulama
çalışırken internet bağlantısına ihtiyaç duymaz.

Belirli bir günü kontrol etmek için geliştirme amaçlı tarih parametresi
kullanılabilir:

```text
http://localhost:4173/?date=2026-11-20
```

## Kontroller

```bash
npm test
npm run check
```

## Program verisini yenileme

Tarayıcı doğrudan `dist/data/schedule.js` içindeki sabit veriyi kullanır. Kaynak
PDF değiştiğinde geliştirme ortamında `pdfplumber` ve `PyMuPDF` kurularak veri
yeniden üretilebilir:

```bash
python3 -m pip install pdfplumber PyMuPDF
python3 scripts/extract_schedule.py \
  "guide/CTF 26-27 Preklinik Ders Programı.pdf" \
  dist/data/schedule.js
```

Betada herhangi bir sunucu tarafı, veritabanı, kullanıcı hesabı veya yayınlama
yapılandırması bulunmaz.
