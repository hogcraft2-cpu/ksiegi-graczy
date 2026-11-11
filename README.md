# Skryptorium — Kreator i Biblioteka Ksiąg Graczy

Publiczna średniowieczna biblioteka postaci oraz kreator ksiąg w stylu Kingdom Come: Deliverance II RP.

- [Kreator ksiąg](https://hogcraft2-cpu.github.io/ksiegi-graczy/)
- [Publiczna biblioteka](https://hogcraft2-cpu.github.io/ksiegi-graczy/biblioteka.html)
- [Zarządzanie księgą i panel administratora](https://hogcraft2-cpu.github.io/ksiegi-graczy/zarzadzanie.html)

## Najważniejsze: publiczne historie, prywatne hasła

**Publiczne dane znajdują się w tym repozytorium GitHub.**

- `books/catalog.json` — spis książek widocznych na półkach.
- `books/<id>.json` — pełna publiczna historia, herb, ilustracje, styl kartek, grzbietu i okładki.
- Publiczna biblioteka działa na GitHub Pages nawet wtedy, gdy API Cloudflare chwilowo nie odpowiada.
- Księga po kliknięciu wysuwa się z półki i otwiera w czytniku bez zmiany URL.

**Prywatne dane nigdy nie są publikowane w repozytorium.**

- Cloudflare D1: identyfikatory ksiąg, metadane do administracji, losowe sole i hashe haseł (PBKDF2-SHA256), limity prób logowania.
- Cloudflare Workers Secrets: `ADMIN_SECRET` (hasło administratora), `GITHUB_TOKEN` (uprawnienie zapisu na GitHubie), `RATE_SALT` (sól limitowania prób).
- Hasła właścicieli **nie są przechowywane w postaci jawnej**; użytkownik podaje je podczas autoryzacji przez HTTPS. Po zapomnieniu hasła nie da się go odzyskać z bazy.
- Publiczny JavaScript nigdy nie otrzymuje tokenu zapisu GitHub. Zapisu dokonuje tylko Worker po weryfikacji hasła.

> Uwaga: to repozytorium jest **publiczne** i Git przechowuje historię commitów. Usunięcie książki z aktualnej wersji nie wymazuje dawnych commitów. Nie publikuj prywatnych danych osobowych, sekretów ani materiałów, które mają zostać trwale usunięte. Ukrycie w bibliotece **nie oznacza prywatności**: plik nadal pozostaje publicznie dostępny po bezpośrednim adresie i w historii Git.

## Funkcje

**Kreator:** rozdziały, historia postaci, własny herb, do 12 ilustracji, 5 pergaminów, 4 kolory oprawy, 4 grzbiety z podglądem, eksport/import pliku `*.ksiega.json`.

**Biblioteka:** półki z grzbietami i podtytułami, wyszukiwarka, animacja wyciągania książki, czytnik z przewracaniem stron. Pierwsza przykładowa księga Vojtiecha Havela jest w publicznych plikach repozytorium.

**Panel właściciela:** publikacja książki z indywidualnym hasłem, zapamiętanie jej UUID, późniejsza edycja, zmiana hasła i usuwanie po weryfikacji.

**Panel administratora:** lista książek zarządzanych przez API, ukrywanie/przywracanie, usuwanie bez znajomości haseł właścicieli. Wcześniejsze statyczne księgi, np. Vojtiecha, wymagają osobnego zarządzania przez GitHub, dopóki nie zostaną zaimportowane do prywatnej D1 jako rekordy właścicielskie.

**Ilustracje AI:** generowanie inspirowane Czechami około 1400 roku, opcjonalny Workers AI, 3 próby dziennie na jedną księgę. Wyniki mogą zawierać nieścisłości historyczne.

### Limity obecnej wersji

- Rozmiar jednej książki publikowanej z poziomu kreatora: **850 000 bajtów**; dotyczy treści oraz zakodowanych obrazów.
- Pojedynczy obraz przesyłany do API: do **250 000 znaków** danych obrazu. Kreator i panel kompresują obrazy przed wysłaniem.
- Maksymalnie 12 ilustracji. Jeżeli całość przekroczy limit, trzeba zmniejszyć ich liczbę lub rozmiar.
- 3 nowe książki dziennie z jednego adresu IP; 6 nieudanych prób hasła w ciągu 15 minut na dany zakres.
- GitHub API służy do publikacji i aktualizacji plików. Każda aktualizacja tworzy commit i może wywołać ponowne wdrożenie GitHub Pages.

## Uruchomienie API bez R2

Cloudflare Pages podłączone do GitHuba **nie wystarcza** do ochrony haseł. Trzeba dodatkowo uruchomić Cloudflare Worker + darmową bazę D1.

### 1. Utwórz D1

W Cloudflare Dashboard utwórz bazę `ksiegi-graczy-db`. W konsoli wykonaj zawartość `backend/schema.sql`. Jeśli baza już istniała, nie twórz drugi raz tabel; pozostaw obecną strukturę z `content_json` dla zgodności.

### 2. Wdróż Worker

Otwórz `backend/worker.js` w repozytorium i wklej go do kodu nowego Cloudflare Workera lub wdroż przez Wrangler. Konfiguracja CLI znajduje się w `backend/wrangler.toml.example`.

Za pomocą **Settings → Bindings** dodaj binding:

| Typ | Nazwa | Zasób |
| --- | --- | --- |
| D1 | `DB` | `ksiegi-graczy-db` |
| Workers AI (opcjonalnie) | `AI` | Workers AI |

**Nie twórz R2**, bindingu `BOOKS` ani powiązanej usługi Storage.

### 3. Utwórz token GitHub (ściśle ograniczony)

W ustawieniach GitHub, w **Developer settings → Personal access tokens → Fine-grained tokens**, utwórz token tylko do repozytorium `hogcraft2-cpu/ksiegi-graczy` z uprawnieniem:

- **Repository permissions → Contents: Read and write**.

Ustaw możliwie krótką datę ważności i odnawiaj token przed wygaśnięciem. Nie nadawaj uprawnień do innych repozytoriów, nie publikuj tokenu w żadnym pliku ani w rozmowie.

### 4. Ustaw sekrety po stronie Cloudflare

W ustawieniach Workera w **Variables and Secrets** dodaj trzy pozycje typu **Secret**:

| Nazwa | Wartość |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained token z kroku 3 |
| `ADMIN_SECRET` | Unikalne silne hasło administratora, min. 16 znaków |
| `RATE_SALT` | Oddzielny losowy sekret, zalecane min. 32 znaki |

Nie wpisuj ich do repozytorium GitHub, nawet prywatnego, ani do `api-config.js`.

Następnie ustaw zmienną tekstową `ALLOWED_ORIGINS`, np. `https://hogcraft2-cpu.github.io`. Możesz podać też adres Cloudflare Pages, oddzielając domeny przecinkami. Nie dodawaj ścieżek ani końcowych ukośników.

### 5. Połącz publiczny interfejs

Otwórz publiczny adres Workera z `/api/health`. Dla skonfigurowanego systemu oczekiwane pola:

```json
{
  "ok": true,
  "storage": true,
  "githubConfigured": true,
  "imageAI": true,
  "adminConfigured": true
}
```

`imageAI: false` jest dopuszczalne, jeśli nie używasz generatora obrazów. Wynik `githubConfigured: true` potwierdza tylko obecność sekretu, a nie prawidłowość jego uprawnień — te weryfikuje faktyczny zapis próbnej księgi.

W pliku `api-config.js` ustaw **wyłącznie publiczny adres Workera**, np.:

```js
window.KSIEGI_API_BASE = "https://ksiegi-graczy-api.twoje-konto.workers.dev";
```

Zapisz zmianę na GitHubie. Po wdrożeniu przetestuj publikowanie małej księgi, sprawdź plik `books/<id>.json`, katalog, odczyt na półce, edycję i usuwanie.

### 6. Zarządzanie i usuwanie

W panelu `zarzadzanie.html` właściciel podaje UUID i hasło, aby edytować swoją książkę. Administrator ma oddzielne hasło i może zarządzać książkami obsługiwanymi przez API.

Usuwanie kasuje plik z aktualnej gałęzi i usuwa wpis katalogu oraz dane logowania z D1, **ale nie czyści historii Git**. Jeśli konieczne będzie trwałe kasowanie treści i historii, docelowo należy przechowywać treści poza publicznym GitHubem.

## Struktura

```
index.html                  kreator
app.js, styles.css          logika i wygląd kreatora
spine.css                   wspólne wzory grzbietów
biblioteka.html             publiczna biblioteka
biblioteka.js/.css          regały, katalog i czytnik
zarzadzanie.html            panel właściciela i admina
panel.js/.css               logika i wygląd panelu
api-config.js               tylko publiczny adres serwera
books/catalog.json          publiczny katalog
books/*.json                publiczne kroniki
backend/worker.js           chronione API (Cloudflare Worker)
backend/schema.sql          prywatna baza D1: hashe i metadane
backend/wrangler.toml.example przykładowy plik konfiguracji
```

**Status wdrożenia:** kod jest przygotowany w repozytorium. Aby uruchomić rzeczywiste zapisy, wymagane jest skonfigurowanie i opublikowanie Workera w Twoim koncie Cloudflare oraz ustawienie adresu API. Samo połączenie Cloudflare Pages z GitHubem tego nie zastępuje.
