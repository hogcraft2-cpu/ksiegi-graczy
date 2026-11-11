# Skryptorium — Kreator Ksiąg i Biblioteka Postaci

Dwa niezależne widoki w jednym publicznym repozytorium, stworzone dla społeczności Kingdom Come: Deliverance II RP.

## Adresy po opublikowaniu GitHub Pages

- **Biblioteka postaci:** https://hogcraft2-cpu.github.io/ksiegi-graczy/biblioteka.html
- **Kreator ksiąg:** https://hogcraft2-cpu.github.io/ksiegi-graczy/

Obie podstrony są połączone linkami. Podczas wybierania i czytania księgi **adres biblioteki się nie zmienia**. Czytnik uruchamia się na tej samej stronie, bez nowej karty.

## Publiczna biblioteka (biblioteka.html)

- Średniowieczny drewniany regał z osobnymi półkami.
- Księgi widoczne **grzbietami**: na każdej okładce imię postaci i podtytuł, kolor oprawy i rok.
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
  "cover": "forest"
}
```

4. Zapisz zmiany na gałęzi `main`. Workflow GitHub Pages opublikuje nową księgę.

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
