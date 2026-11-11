# Skryptorium — Kreator Ksiąg Postaci

Pierwsza wersja osobnego kreatora średniowiecznych kronik dla społeczności **Kingdom Come: Deliverance II RP**. Inspiracją stylistyczną jest osobna księga Vojtiecha Havela, ale projekt nie zmienia jej plików.

## Działanie

- Wpisz imię postaci, podtytuł, rok, kronikarza, wprowadzenie i pełną historię.
- Wybierz jeden z **5 stylów pergaminu**: klasyczny, królewski, bitewny, zakonny lub nocny.
- Wybierz jedną z **4 opraw**: burgundową, zieloną, granatową lub brązową.
- Dodaj **herb** (widoczny na okładce i karcie tytułowej).
- Dodaj do **12 ilustracji** z indywidualnymi podpisami. Obrazy są kompresowane lokalnie.
- Otwórz księgę, przewracaj strony i oglądaj podgląd na bieżąco. Na telefonie widoczna jest pojedyncza karta.
- Projekt jest zapisywany lokalnie w przeglądarce, gdy jest wystarczająco dużo pamięci.
- **Pobierz projekt JSON** lub wczytaj wcześniej zapisany plik.

## Publikacja

Pliki znajdują się bezpośrednio w katalogu głównym repozytorium.

1. Wejdź w **Settings → Pages**.
2. W **Build and deployment** wybierz **Deploy from a branch**, **main** i **/(root)**.
3. Zapisz ustawienia i sprawdź wdrożenie w **Actions**.

Adres po poprawnym wdrożeniu GitHub Pages:

https://hogcraft2-cpu.github.io/ksiegi-graczy/

Można również wykorzystać Cloudflare Pages: framework **None**, bez build command, output directory **.**.

## Co zostaje na drugi etap

**Nie ma jeszcze biblioteki online ani publikowania książek do wspólnego katalogu.**

Docelowo na stronie biblioteki książki będą stały na półkach grzbietami skierowanymi do czytelników, z imieniem postaci na grzbiecie. Kliknięcie otworzy wybraną księgę.

Kreator na razie eksportuje wersjonowane dane księgi w formacie JSON, nie pojedynczą stronę HTML. Dzięki temu później zbudujemy oddzielny system dodawania książek do biblioteki, z kontrolą publikacji i wspólnym czytnikiem.

## Format danych JSON

```json
{
  "format": "ksiegi-graczy/book",
  "version": 1,
  "savedAt": "ISO 8601",
  "book": {
    "character": "Imię postaci",
    "subtitle": "Podtytuł",
    "year": "1403",
    "author": "Kronikarz",
    "summary": "Przedmowa",
    "story": "Rozdział I...",
    "paper": "classic",
    "cover": "burgundy",
    "crest": null,
    "photos": []
  }
}
```

Obrazy są osadzane jako zoptymalizowane adresy data URL. Tekst i zdjęcia nie są wysyłane na serwer podczas tworzenia.

**Prywatność i ograniczenia:** pliki są przetwarzane lokalnie; projekt może nie zmieścić się w pamięci przeglądarki. Zapisuj JSON, aby nie utracić długiej kroniki. Nie jest to jeszcze współdzielona baza danych i nie ma kont użytkowników ani panelu administracyjnego. Przy przyszłej bibliotece dodamy kontrolę przesyłania oraz moderowanie publikacji.

## Struktura

- `index.html` — interfejs kreatora.
- `styles.css` — oprawa pergaminowa, skórzane okładki, animacje i wygląd mobilny.
- `app.js` — tekst, ilustracje, układanie kartek, podgląd, eksport/import i kopia lokalna.
- `.nojekyll` — konfiguracja statycznego hostingu.

Projekt niezależny, bez oficjalnych grafik i znaków producenta gry.
