---
marp: true
theme: default
paginate: true
backgroundColor: #1a1a2e
color: #eaeaea
style: |
  section {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  h1 {
    color: #f77f00;
  }
  h2 {
    color: #fcbf49;
  }
  h3 {
    color: #eae2b7;
  }
  code {
    background-color: #2d2d44;
    color: #00d9ff;
  }
  a {
    color: #00d9ff;
  }
  .mermaid {
    background-color: transparent;
  }
  .mermaid svg {
    max-height: 350px;
    width: auto;
  }
  /* Rendered mermaid images from pipeline */
  section img[alt="mermaid diagram"] {
    max-height: 350px;
    width: auto;
    display: block;
    margin: 0 auto;
  }
  strong {
    color: #f77f00;
  }
  blockquote {
    border-left: 4px solid #f77f00;
    background-color: #2d2d44;
    padding: 1em;
  }
  table {
    font-size: 0.8em;
  }
  th {
    background-color: #f77f00;
    color: #1a1a2e;
  }
  /* Ensure table text is readable when table background is white */
  table, table th, table td {
    color: #000000 !important;
  }
---

# 🔥 Awaria Cloudflare 2025
## Jak jeden plik "położył" 16% internetu

**Geeks Club1**

📅 10 grudnia 2025 r.

---

# 📋 Agenda

1. 🌐 **Dlaczego Cloudflare jest ważny?**
2. 💥 **Co się stało?** - Timeline awarii
3. 🔧 **Analiza techniczna** - ClickHouse, Rust, unwrap()
4. 🎭 **Czynniki mylące** - Dlaczego myśleli, że to atak DDoS
5. 📝 **Wnioski i działania naprawcze**
6. 💭 **Komentarz** - Co my z tego wyciągamy?

---

# 🌐 Co to jest Cloudflare?

**Middleware między klientem a Twoją aplikacją**

```mermaid
flowchart LR
    A[👤 Użytkownik] --> B[🛡️ Cloudflare]
    B --> C[🏢 Twoja Aplikacja]
    
    B --> D[🚫 DDoS Protection]
    B --> E[💾 Caching]
    B --> F[🤖 Bot Management]
    B --> G[🌍 CDN]
    B --> H[🔥 WAF]
```

<!-- 
- DDoS Protection: Blokuje ataki typu Distributed Denial of Service
- Caching: Przechowuje kopie treści dla szybszego dostarczania
- Bot Management: Wykrywa i zarządza ruchem botów (automatycznym)
- CDN: Content Delivery Network - rozprowadza treści globalnie
- WAF: Web Application Firewall - chroni przed atakami webowymi
-->

---

# 📊 Skala Cloudflare

## **~16% całego ruchu internetowego** 🌍

> Każdy co szósty request w internecie przechodzi przez Cloudflare

### Znani użytkownicy:
| Kategoria | Firmy |
|-----------|-------|
| 🏢 Technologia | Mozilla, Microsoft Azure, Office 365, IBM |
| 🛒 E-commerce | Nike, H&M, Shopify |
| 💬 Social | Reddit, Digital Ocean |

---

# ⏰ Timeline awarii

```mermaid
timeline
    title 18 listopada 2025 Awaria Cloudflare (UTC)
    11_05 : Wdrożono zmianę uprawnień w ClickHouse
    11_20 : 🔴 Początek problemów - błędy 5xx
    11_28 : Wdrożenie dociera do produkcji
    11_32 : Analiza - początkowo podejrzenie DDoS
    13_05 : Obejście dla Workers KV i Access
    14_24 : Identyfikacja przyczyny - plik bot managementu
    14_30 : 🟢 Wdrożenie poprawnego pliku
    17_06 : 🟢 Pełna normalizacja
```

---

# 🤖 Bot Management - Źródło problemu

## Jak działa ocena botów?

```mermaid
flowchart TB
    A[📨 Request HTTP] --> B{🤖 Bot Scoring}
    B --> C[Wynik 0-99]
    C --> D{Czy to bot?}
    D -->|Niski score| E[✅ Przepuść]
    D -->|Wysoki score| F[❌ Zablokuj]
    
    G[📄 Plik cech] -->|60 features| B
    H[🧠 Model ML] --> B
```

**Bot Score**: 0-99 (im wyżej = większe prawdopodobieństwo bota)

---

# 🗃️ Architektura ClickHouse

## Bazy danych i shardy

```mermaid
flowchart TB
    subgraph Przed awarią
        A1[Zapytanie SQL] --> B1[Baza 'default']
        B1 --> C1[~60 cech]
    end
    
    subgraph Po zmianie uprawnień
        A2[Zapytanie SQL] --> B2[Baza 'default']
        B2 --> C2[Cechy zagregowane]
        A2 --> D2[Baza 'R0']
        D2 --> E2[Cechy z shardów]
        C2 & E2 --> F2[❌ >200 cech!]
    end
```

---

# 🔍 Zapytanie bez dyskryminatora bazy

```sql
SELECT
  name,
  type
FROM system.columns
WHERE
  table = 'http_requests_features'
ORDER BY name;
```

## ⚠️ Problem:
- Brak `WHERE database = 'default'`
- Po zmianie uprawnień → widoczne obie bazy
- **60 cech × 2 = 120+** cech

---

# 🦀 Rust i fatalne `unwrap()`

```rust
// Uproszczony kod który spowodował panikę
fn load_features(config: &Config) -> Features {
    let features = append_with_names(&config)
        .unwrap();  // 💥 BOOM!
    
    features
}
```

## Problem z prealokacją pamięci:
- **Limit:** 200 cech (bufor bezpieczeństwa)
- **Oczekiwane:** ~60 cech  
- **Otrzymane:** >200 cech (duplikaty)
- **Rezultat:** `Result::unwrap()` on `Err` → **PANIKA** 💀

---

# 💥 Mechanizm awarii

```mermaid
sequenceDiagram
    participant CH as ClickHouse
    participant Gen as Generator pliku
    participant FL2 as Proxy FL2
    participant User as 👤 Użytkownik
    
    CH->>Gen: Zmienione uprawnienia
    Gen->>Gen: Generuj plik cech
    Note over Gen: ">200 cech (duplikaty)"
    Gen->>FL2: Propaguj plik
    FL2->>FL2: append_with_names()
    Note over FL2: "💥 unwrap() PANIC!"
    FL2->>User: ❌ HTTP 500
```

---

# 🎭 Czynniki mylące

## Dlaczego myśleli o ataku DDoS?

```mermaid
flowchart LR
    A[📈 Skok błędów] --> B[📉 Spadek]
    B --> C[📈 Ponowny skok]
    C --> D{🤔 Co się dzieje?}
    
    E[⛔ Status page offline] --> D
    F[🎯 Niedawne ataki Aisuru] --> D
    
    D --> G[❌ Błędna diagnoza: DDoS]
```

### Nietypowe zachowanie:
- Fluktuacje: stare nody miały poprawny cache
- Status page (niezależna infra) też offline → **zbieg okoliczności!**

---

# 📊 Wpływ na usługi

| Usługa | Wpływ |
|--------|-------|
| 🌐 **CDN / Bezpieczeństwo** | HTTP 5xx dla wszystkich klientów |
| 🔐 **Turnstile** | Całkowity brak działania |
| 📦 **Workers KV** | Podwyższony poziom błędów |
| 📊 **Dashboard** | Brak możliwości logowania |
| 🔑 **Access** | Błędy uwierzytelniania |
| 📧 **Email Security** | Obniżone wykrywanie spamu |

---

# 🔧 FL vs FL2 - Różny wpływ

```mermaid
flowchart TB
    subgraph FL2 [Nowy Proxy FL2]
        A1[Request] --> B1{Bot Module}
        B1 -->|PANIC!| C1[❌ HTTP 500]
    end
    
    subgraph FL [Stary Proxy FL]
        A2[Request] --> B2{Bot Module}
        B2 -->|Błąd| C2[Bot Score = 0]
        C2 --> D2[⚠️ Fałszywe alarmy]
    end
```

**FL2**: Twarde błędy 500  
**FL**: Wszystko = "nie-bot" → problemy z regułami blokowania

---

# 📝 Działania naprawcze Cloudflare

## Oficjalna lista:

1. 🔒 **Hardening** konfiguracji wewnętrznej (jak dane od użytkowników)
2. 🔘 **Kill-switches** - globalne wyłączniki funkcji
3. 💾 **Core dumps** - nie mogą przeciążać systemu
4. 🔍 **Przegląd trybów awarii** wszystkich modułów proxy

> *"Dzisiejsza awaria była najpoważniejszym incydentem od 2019 roku"*
> — Matthew Prince, CEO

---

# 💡 Nasze wnioski techniczne

## Co można było zrobić lepiej?

```rust
let features = append_with_names(&config).unwrap_or_default();
if features.len() > 200 {
    log::warn!("Pobrano {} cech, przekroczono limit 200. Biorę pierwsze 200.", features.len());
    features.truncate(200);
}
// ✅ Kontynuuj działanie z features
```

---

### Zamiast:
```rust
.unwrap()  // ❌ PANIC!
```

### Powinno być:
```rust
.unwrap_or_else(|e| { log::error!("{}", e); defaults() })
```

---

# 🏢 Problem organizacyjny

```mermaid
flowchart LR
    subgraph Team_A [Zespół A - ClickHouse]
        A1[Modernizacja uprawnień]
    end
    
    subgraph Team_B [Zespół B - Bot Management]
        B1[Kod od lat działa]
        B2[Założenie: tylko baza 'default']
    end
    
    A1 -.->|Brak komunikacji| B1
    B1 --> C[💥 Awaria]
    
    style C fill:#8b0000
```

## 🎯 Kluczowy problem:
**Zmiana w jednym miejscu → eksplozja w innym**

---

# 🧪 A co ze środowiskiem testowym?

## Możliwe wyjaśnienie:

```mermaid
flowchart TB
    subgraph PreProd [🧪 Pre-produkcja]
        A1[10 cech] --> B1[× 2 = 20]
        B1 --> C1[✅ < 200 - OK!]
    end
    
    subgraph Prod [🏭 Produkcja]
        A2[60 cech] --> B2[× 2+ = >200]
        B2 --> C2[❌ Przekroczony limit!]
    end
```

**Skala produkcji ≠ Skala testów**

---

<!-- style: h2 { font-size: 0.8em; } blockquote { font-size: 0.7em; } -->

# 🔥 Kluczowe lekcje

## 1️⃣ Defensywne programowanie

> Nigdy nie ufaj, że dane wejściowe będą poprawne

## 2️⃣ Graceful degradation

> System powinien działać ograniczenie, nie crashować

## 3️⃣ Komunikacja między zespołami

> Zmiany w jednym systemie mogą wpłynąć na inne

## 4️⃣ Testy na skali produkcyjnej

> Pre-prod musi odzwierciedlać rzeczywistość

---

# 📈 Wizualizacja awarii

```mermaid
xychart-beta
  title "Błędy HTTP 5xx podczas incydentu"
  x-axis ["11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","17:00"]
  y-axis "Wolumen błędów" 0 --> 100
  line [5, 85, 70, 90, 60, 50, 45, 20, 15, 10, 8, 5]
```

**Fluktuacje** = różne nody z różnymi wersjami pliku cech

---

# 🤔 Do dyskusji

## Pytania dla zespołu:

1. 🔍 **Czy mamy podobne "ukryte zależności"** w naszych systemach?

2. 🦀 **Jak obsługujemy błędy** w krytycznych ścieżkach kodu?

3. 📊 **Czy nasze środowiska testowe** odzwierciedlają skalę produkcji?

4. 🔔 **Jak szybko wykryjemy** awarię przed użytkownikami?

5. 📝 **Czy robimy post-mortemy** i czy są publiczne?

---

# 🎯 Podsumowanie

```mermaid
mindmap
  root((Awaria Cloudflare))
    Przyczyna
      "Zmiana uprawnień ClickHouse"
      "Brak dyskryminatora bazy"
      "Duplikaty cech >200"
    Błąd
      "Prealokacja pamięci"
      "unwrap w Rust"
      "Brak graceful degradation"
    Skutek
      "16% internetu offline"
      "~6h do pełnego recovery"
    Lekcje
      "Defensywne programowanie"
      "Komunikacja zespołów"
      "Testy na skali prod"
```

---

# 📚 Źródła

## Oficjalne Post-Mortem:
🔗 [blog.cloudflare.com/pl-pl/18-november-2025-outage](https://blog.cloudflare.com/pl-pl/18-november-2025-outage/)

## Video:
🎬 [IT News #25 - DevMentors](https://www.youtube.com/watch?v=ztxhKSBdtnM)

---

# 🙏 Dziękuję!

## Pytania?

```
   _____ _                 _ __ _                 
  / ____| |               | |/ _| |                
 | |    | | ___  _   _  __| | |_| | __ _ _ __ ___ 
 | |    | |/ _ \| | | |/ _` |  _| |/ _` | '__/ _ \
 | |____| | (_) | |_| | (_| | | | | (_| | | |  __/
  \_____|_|\___/ \__,_|\__,_|_| |_|\__,_|_|  \___|
                                                   
       🛡️ Post-Mortem 18.11.2025 🛡️
```

**Kontakt:** granica.lukasz@gmail.com
  
 
 