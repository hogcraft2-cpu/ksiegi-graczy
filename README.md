## Aktualizacja: wariant bez R2 (Cloudflare D1 Free)

Od 11 listopada 2026 r. **R2 nie jest już wymagane**. Używamy Cloudflare D1 także do przechowywania treści, herbów i ilustracji w polu `content_json`.

- Rozmiar jednej opublikowanej księgi po kompresji obrazów: maksymalnie **1 500 000 bajtów** (około 1,5 MB).
- Maksymalny rozmiar pojedynczego obrazu przesyłanego do serwera: 400 000 znaków kodowania data URL.
- Darmowy plan D1 ma ograniczenia, w tym 500 MB na bazę i 2 MB na rekord; większą kolekcję obrazów trzeba później przechowywać inaczej.
- **Nie twórz zasobu R2 ani bindingu `BOOKS`**.
- W Workerze dodaj tylko binding `DB` typu D1. Binding `AI` jest opcjonalny — bez niego generator obrazów wyświetli informację o braku konfiguracji.
- Pozostaw własne tajne wartości `ADMIN_SECRET` i `RATE_SALT` jako Cloudflare Secrets.
- Pełna instrukcja w [backend/INSTRUKCJA-BEZ-R2.md](backend/INSTRUKCJA-BEZ-R2.md).
- Jeśli zainicjowałeś tabelę przed zmianą, uruchom jednorazowo `backend/migrate-d1-only.sql` (nie uruchamiaj migracji na nowo utworzonej bazie).

Uwaga: księgi i obrazy przechowywane w bazie są publicznie dostępne przez endpoint czytelniczy tylko dla opublikowanych książek. Nie wpisuj prywatnych danych do historii.

---

# Bezpieczne zarządzanie księgami i generator iluminacji

**Status:** kod API, kreatora i panelu zarządzania jest w repozytorium. Funkcje serwerowe zaczną działać dopiero po uruchomieniu Cloudflare Worker i skonfigurowaniu D1 oraz opcjonalnie Workers AI. Publiczny GitHub Pages **nie przechowuje i nie weryfikuje haseł**.

### Strony

- **Kreator:** https://hogcraft2-cpu.github.io/ksiegi-graczy/
- **Biblioteka:** https://hogcraft2-cpu.github.io/ksiegi-graczy/biblioteka.html
- **Panel właściciela i administratora:** https://hogcraft2-cpu.github.io/ksiegi-graczy/zarzadzanie.html

### Funkcje

- Każdy gracz może opublikować nową kronikę z **indywidualnym hasłem** o długości 12–128 znaków. Hasło nigdy nie trafia do katalogu, pliku książki ani publicznego skryptu; baza D1 zapisuje jedynie losową sól i hash PBKDF2-SHA256.
- Po publikacji serwer zwraca **identyfikator UUID**. Do późniejszej edycji/usuwania należy zachować zarówno UUID, jak i hasło.
- Pod adresem `zarzadzanie.html` gracz wczytuje własną książkę, może modyfikować historię i zdjęcia, wybór pergaminu i grzbietu, zmienić hasło lub nieodwracalnie usunąć książkę.
- **Administrator** wpisuje osobne hasło zapisane jako sekret Workera i może wyświetlić listę, ukryć, przywrócić albo usunąć **dowolną książkę zarządzaną przez API** bez znajomości hasła właściciela.
- **Ilustrator AI** na podstawie opisu sceny tworzy ilustrację nawiązującą do Czech około 1400 roku (iluminowany rękopis, strój i architektura epoki). Właściciel może dodać obraz do książki, a następnie zapisać zmiany online. Limit 3 próby/dzień/księgę; wymaga Workers AI.
- Publiczna biblioteka pobiera **opublikowane** książki z API oraz dotychczasowe statyczne przykłady. Wszystko otwiera się w miejscu bez zmiany URL.
- Serwer ogranicza próby odgadywania haseł i nowe publikacje do 3/dobę/adres. Nie jest to zamiennik dodatkowych zabezpieczeń antyspamowych przy większym ruchu.

**Ważne:** dotychczasowa statyczna księga Vojtiecha jest przykładem w `books/catalog.json`, a nie rekordem D1. Administrator może ją usunąć poprzez repozytorium GitHub; panel administracyjny zarządza dopiero nowymi książkami opublikowanymi przez Cloudflare API. Aby także Vojtiech był zarządzany hasłem, trzeba go osobno przenieść do bazy.

### Jak uruchomić zaplecze w Cloudflare

Zarówno GitHub Pages, jak i Cloudflare Pages są tylko frontendem. Konieczne jest jednorazowe wdrożenie API w **Workers** oraz podpięcie usług. Poniżej przykładowe komendy z terminala mającego Node.js i zalogowane `npx wrangler login`.

1. Pobierz repozytorium, otwórz katalog `backend`. Skopiuj plik `wrangler.toml.example` do `wrangler.toml`.
2. Utwórz bazę: `npx wrangler d1 create ksiegi-graczy-db`. Wklej zwrócone `database_id` do `backend/wrangler.toml`.
3. Utwórz magazyn: `npx wrangler r2 bucket create ksiegi-graczy-books`. R2 może wymagać aktywacji usługi i metody płatności w panelu Cloudflare, mimo dostępnych limitów bezpłatnych.
4. Zainicjuj tabele: `npx wrangler d1 execute ksiegi-graczy-db --remote --file=./schema.sql`.
5. Ustaw dwa **sekrety Workera**, nie w repozytorium: `npx wrangler secret put ADMIN_SECRET` (unikatowe silne hasło administratora, co najmniej 16 znaków) oraz `npx wrangler secret put RATE_SALT` (losowy długi ciąg znaków). Nie wklejaj tych sekretów w rozmowę ani do kodu GitHub.
6. W `wrangler.toml` ustaw `ALLOWED_ORIGINS`: adres frontendu, np. `https://hogcraft2-cpu.github.io`. Gdy używasz także innej domeny, oddzielaj adresy przecinkami.
7. Wdróż API: `npx wrangler deploy`. Skopiuj otrzymany adres `https://ksiegi-graczy-api.TWOJE-KONTO.workers.dev`.
8. W pliku repozytorium `api-config.js` wpisz **tylko publiczny adres Workera** w `window.KSIEGI_API_BASE`. Nie wstawiaj tam haseł ani tokenów.
9. Odśwież kreator i otwórz panel `zarzadzanie.html`. Status powinien pokazywać aktywne połączenie z D1. Wygenerowanie obrazu wymaga prawidłowej konfiguracji bindingu `AI` w Workerze.

**Uwaga o kolejności sekretów:** przy pierwszym wdrożeniu (zanim Worker istnieje), jeśli `wrangler secret put` nie znajduje jeszcze projektu, wykonaj najpierw `npx wrangler deploy`, następnie ustaw sekrety i wdróż ponownie.

Przykładowe ustawienia bindings znajdują się w `backend/wrangler.toml.example`. Po utworzeniu kopii możesz edytować tylko `database_id`; nazwy `DB`, `BOOKS`, `AI` muszą pozostać zgodne z kodem.

### Koszty i bezpieczeństwo

- Cloudflare D1 jest dostępne na darmowym planie (w granicach limitów).
- **R2 nie jest wykorzystywane i nie trzeba go uruchamiać.** Pełne księgi, herby i ilustracje są przechowywane w D1. Limit jednej opublikowanej książki to 1,5 MB.
- Workers AI ma ograniczoną darmową pulę. Generowanie ilustracji może zużywać tę pulę lub być płatne po przekroczeniu limitu. Nie obiecujemy nieograniczonego darmowego generowania.
- Hasła i zasoby są wrażliwe: włącz 2FA w Cloudflare, ustaw limity, monitoruj zużycie i regularnie wykonuj kopie D1.
- Obrazy AI nie gwarantują poprawności historycznej.
- Jeżeli zapomnisz hasła księgi, użytkownik nie odzyska go automatycznie. Administrator może w razie potrzeby usunąć księgę.

### Struktura nowych plików

- `zarzadzanie.html`, `panel.css`, `panel.js` — panel właściciela i administratora.
- `api-config.js` — tylko publiczny adres API, domyślnie pusty.
- `backend/worker.js` — API autoryzacji, zapisu i ilustratora.
- `backend/schema.sql` — schemat bazy D1.
- `backend/wrangler.toml.example` — wzorzec konfiguracji Cloudflare, bez sekretów.

---

# Skryptorium — Kreator Ksiąg i Biblioteka Postaci

Dwa niezależne widoki w jednym publicznym repozytorium, stworzone dla społeczności Kingdom Come: Deliverance II RP.

## Adresy po opublikowaniu GitHub Pages

- **Biblioteka postaci:** https://hogcraft2-cpu.github.io/ksiegi-graczy/biblioteka.html
- **Kreator ksiąg:** https://hogcraft2-cpu.github.io/ksiegi-graczy/

Obie podstrony są połączone linkami. Podczas wybierania i czytania księgi **adres biblioteki się nie zmienia**. Czytnik uruchamia się na tej samej stronie, bez nowej karty.

## Publiczna biblioteka (biblioteka.html)

- Średniowieczny drewniany regał z osobnymi półkami.
- Księgi widoczne **grzbietami**: na każdej okładce imię postaci i podtytuł, kolor oprawy i rok.
- Wygląd grzbietu **nie jest losowany**: biblioteka respektuje wariant `spine` zapisany przez autora w kreatorze i katalogu.
- Wyszukiwanie po imieniu, podtytule i roku.
- Animacja wysunięcia wybranej księgi z regału.
- Duży czytnik z **dwiema pergaminowymi stronami** (jedna karta na telefonie).
- Przewracanie stron przyciskami i klawiszami **← / →**.
- Zamknięcie przyciskiem, Esc lub kliknięciem poza księgę.
- Zachowanie wybranego stylu pergaminu, oprawy, herbu i zdjęć z kreatora.
- Pierwsza pozycja biblioteki: **Vojtiech Havel** — jego historia z istniejącego kodeksu Vojtiecha do roku 1403 i oryginalny herb.

Strona jest publiczna i **wyłącznie do odczytu**. Nie ma rejestracji, bazy danych ani kont graczy.

## Kreator (index.html)

- Historia, imię postaci, podtytuł, rok, autor i przedmowa.
- Pięć rodzajów pergaminu: klasyczny, królewski, bitewny, zakonny, nocny.
- Cztery kolory skórzanej oprawy: bordowy, zielony, granatowy, brązowy.
- **Cztery wybieralne grzbiety** w zakładce **02 Wygląd**: iluminowany, żelazny, zakonny i kupiecki — każdy z podglądem z imieniem postaci i podtytułem.
- Własny herb na przedniej okładce i karcie tytułowej.
- Do 12 ilustracji wraz z podpisami.
- Podgląd księgi i lokalny zapis roboczy.
- Eksport/import wersjonowanego pliku `*.ksiega.json`.

## Jak opublikować na GitHub Pages

Repozytorium zawiera gotowy workflow `.github/workflows/deploy-pages.yml`.

1. Otwórz repozytorium → **Settings** → **Pages**.
2. W sekcji **Build and deployment** ustaw **Source: GitHub Actions**.
3. Otwórz zakładkę **Actions**, wybierz „Publikuj Skryptorium i Bibliotekę”.
4. Jeżeli workflow jeszcze się nie uruchomił, użyj **Run workflow** (gałąź `main`).
5. Po zakończeniu sprawdź adres biblioteki powyżej.

> Samo dodanie plików do repozytorium nie włącza hostingu. Konto właściciela repozytorium musi wybrać źródło publikacji w ustawieniach Pages.

## Dodawanie ksiąg do publicznej biblioteki

Na razie publikację zatwierdza opiekun repozytorium — gracze nie mogą publikować dowolnych plików na stronie. Nie jest potrzebny serwer ani płatny hosting.

1. W kreatorze zapisz księgę przyciskiem **Pobierz księgę .json**.
2. W repozytorium umieść plik w folderze `books/`, np. `books/jan-novak.json` (małe łacińskie litery, cyfry i myślniki).
3. Otwórz plik `books/catalog.json` i do tablicy `books` dodaj wpis:

```json
{
  "id": "jan-novak",
  "file": "books/jan-novak.json",
  "title": "Jan Novák",
  "subtitle": "Kronika strażnika Kuttenbergu",
  "year": "1403",
  "paper": "classic",
  "cover": "forest",
  "spine": "ironbound"
}
```

4. Zapisz zmiany na gałęzi `main`. Workflow GitHub Pages opublikuje nową księgę.

**Ważne:** podczas ręcznego dodawania księgi do katalogu przepisz pole `spine` z pobranego JSON; dozwolone wartości to `illuminated`, `ironbound`, `monastic` i `merchant`. Starsze księgi bez tego pola używają `illuminated`.

Księgi na półkach są generowane automatycznie z `books/catalog.json`. Pełną treść danej księgi pobieramy **dopiero po jej kliknięciu**. Katalog nie może wskazywać adresów zewnętrznych ani dowolnych skryptów.

## Format ksiąg

Plik danych:

```json
{
  "format": "ksiegi-graczy/book",
  "version": 1,
  "savedAt": "2026-11-11T00:00:00.000Z",
  "book": {
    "character": "Jan Novák",
    "subtitle": "Kronika strażnika Kuttenbergu",
    "year": "1403",
    "author": "Anonimowy skryba",
    "summary": "Wstęp do opowieści",
    "story": "Rozdział I. Początki\n\nW pewnej wsi...",
    "paper": "classic",
    "cover": "forest",
    "spine": "ironbound",
    "crest": null,
    "photos": []
  }
}
```

Zdjęcia i herby z kreatora przechowywane są w JSON jako `data:image/...;base64,...`, dlatego księga może być duża.

**Uwaga:** publikacja książki w publicznej bibliotece upublicznia treść i obrazy. Przed przyjęciem sprawdź zgodę autora i zawartość. W kolejnych etapach możemy zbudować panel zgłoszeń i zatwierdzania książek.

## Pliki

- `index.html`, `styles.css`, `app.js` — kreator.
- `biblioteka.html`, `biblioteka.css`, `biblioteka.js` — biblioteka i czytnik.
- `books/catalog.json` — spis publicznych książek.
- `books/*.json` — pełne treści ksiąg.
- `.github/workflows/deploy-pages.yml` — automatyczna publikacja.
- `.nojekyll` — wyłączenie obróbki Jekyll.

Projekt jest niezależną twórczością społeczności, bez oficjalnego powiązania z wydawcą gry.
