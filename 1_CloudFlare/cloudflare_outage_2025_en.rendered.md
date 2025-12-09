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
    color: #1a1a2e;
  }
  th {
    background-color: #f77f00;
    color: #1a1a2e;
  }
  /* Force table header and cells to use black text regardless of section color.
     Include selectors that match Marp's generated SVG/foreignObject structure so
     the rule applies inside the slide SVG (where section gets an inline color). */
  svg foreignObject section table th,
  svg foreignObject section table td,
  section table th,
  section table td {
    color: #000000 !important;
  }
---

<style>
  table, table th, table td { color: #000000 !important; }
</style>

# 🔥 Cloudflare Outage 2025
## How One File Took Down 16% of the Internet

**Geeks Club**

📅 December 10, 2025

<!---
So like everyone else, I got hit by the CloudFlare outage at November 18th. After reading their post morten (which was honestly really detailed and transparent - mad respect for the team working hard to keep us all safe), I wanted to share some thoughts what can we learn from this mistake.
-->
---

# 📋 Agenda

1. 🌐 **Why is Cloudflare important?**
2. 💥 **What happened?** - Outage Timeline
3. 🔧 **Technical Analysis** - ClickHouse, Rust, unwrap()
4. 🎭 **Confusing Factors** - Why they thought it was a DDoS attack
5. 📝 **Conclusions and Remedial Actions**
6. 💭 **Comment** - What do we learn from this?

---

# 🌐 What is Cloudflare?

**Middleware between the client and your application**

![w:auto h:300](assets/mermaid/mermaid-1.svg)

<!-- 
- DDoS Protection: Blocks Distributed Denial of Service attacks
- Caching: Stores copies of content for faster delivery
- Bot Management: Detects and manages bot traffic (automated)
- CDN: Content Delivery Network - distributes content globally
- WAF: Web Application Firewall - protects against web attacks
-->

---

# 📊 Cloudflare Scale

## **~16% of all internet traffic** 🌍

> Every sixth request on the internet goes through Cloudflare

### Known users:
| Category | Companies |
|----------|-----------|
| 🏢 Technology | Mozilla, Microsoft Azure, Office 365, IBM |
| 🛒 E-commerce | Nike, H&M, Shopify |
| 💬 Social | Reddit, Twitter |

<!--
Ask how people experienced the outage
-->
---

# 🤖 Bot Management - Source of the Problem

## How does bot scoring work?

![w:auto h:300](assets/mermaid/mermaid-2.svg)

**Bot Score**: 0-99 (higher = greater bot probability)

<!--
Problem at the Source: Bot Detection Function
The problem concerns a feature related to detecting various bots that enter the infrastructure through Cloudflare. The system analyzes traffic and decides whether to allow or block it.

Bot Scoring: In a big simplification, it's a score from 0 to 99 that determines the probability of whether the request comes from a human or a bot. The higher the score, the greater the probability that it's a bot.
Technology: This service is based on machine learning and analyzes a set of features (features) of a given request.
Architecture and Configuration
The list of features is not fixed. It is continuously updated based on all traffic that Cloudflare sees, and propagated to all instances deciding on traffic passage.

Number of features: At the time of the outage, there were about 60.
Assumed limit: The infrastructure was prepared for a maximum of 200 features for analysis.
Process: The set of features is packed into a file, which is generated every 5 minutes. This file is propagated to the Bot Management module, which makes ML assertions based on it.
-->

---

# 🗃️ ClickHouse Architecture

## Databases and shards

![w:auto h:300](assets/mermaid/mermaid-3.svg)

<!--
Database Infrastructure: ClickHouse
The entire infrastructure where these features were stored was connected via ClickHouse, a distributed database.

Structure: There was a database that had a list of shards. Underneath they had shards in specific databases.
Default database: The main node that contained a list of all shards.
R0 database: Contained specific shards.
Operation: For the user it is transparent. Queries one database, and underneath all the magic happens with searching, combining results and returning them as a projection (view).
-->

---

# 🔍 Query without database discriminator

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
- No `WHERE database = 'default'`
- After permission change → both databases visible
- **60 features × 2 = 120+** features

<!--
Critical Change: Permissions in ClickHouse
As part of Cloudflare, modernization work was carried out regarding permission changes. This caused the SQL query that retrieved features to behave differently.

Query problem: The query did not contain an explicit database selector (discriminator). It always operated on the default database by assumption.
Effect of permission change: New permissions caused the query to start pulling data not only from the default database, but also from the R0 database.
Result: Instead of 60 features, the query started returning over 200, because it received both aggregated features from the view in default, and duplicated, raw features from individual shards in R0.
-->
---

# 🦀 Rust and fatal `unwrap()`

```rust
// Simplified code that caused panic
fn load_features(config: &Config) -> Features {
    let features = append_with_names(&config)
        .unwrap();  // 💥 BOOM!
    
    features
}
```

## Memory preallocation problem:
- **Limit:** 200 features (safety buffer)
- **Expected:** ~60 features  
- **Received:** >200 features (duplicates)
- **Result:** `Result::unwrap()` on `Err` → **PANIC** 💀

<!--
Code in Rust Language and unwrap() Method
In simple terms, one might think: "what's the problem if the query returned 200 records instead of 60?". The problem is that the Bot Management area is written in Rust.

Memory management: Cloudflare programmers, wanting to maximize performance, try to precisely allocate memory. Memory for features was preallocated for 200 positions. They admitted that 200 is still much more than the standard 60, so they had a buffer (three times as much). It turned out that it wasn't enough.
unwrap() method: In the code that went viral, there was a snippet loading the configuration, which at the end used the unwrap() method.
What is unwrap()? In Rust there is no null. Instead, the Result<T, Error> type is often used, which can contain either a correct result (T), or an error (Error). The unwrap() method works on the principle "give me the result or panic" (get or panic). If Result contains an error, unwrap() causes a panic, which in simplification can be translated as a hard exception that crashes the entire application.
For Dotnet people: It's a bit like calling await on Task<T> returns T, but unwrap() additionally causes a failure if the operation failed.
Outage course in code:
The append_with_names function, trying to add over 200 features to the preallocated buffer, returned an error object (Error).
The unwrap() method was called on this error object.
A panic occurred, as seen in the logs: FL2 (Frontline 2) worker panicked at 'called Result::unwrap()on anErr value'.
-->

---

# 💥 Outage Mechanism

![w:auto h:300](assets/mermaid/mermaid-4.svg)

---

# 🎭 Confusing Factors

## Why did they think it was a DDoS attack?

![w:auto h:300](assets/mermaid/mermaid-5.svg)

### Unusual behavior:
- Fluctuations: old nodes had correct cache
- Status page (independent infra) also offline → **coincidence!**

---

# ⏰ Outage Timeline

![w:auto h:300](assets/mermaid/mermaid-6.svg)

---

# 📝 Cloudflare Remedial Actions

## Official list:

1. 🔒 **Hardening** of internal configuration (like user data)
2. 🔘 **Kill-switches** - global function switches
3. 💾 **Core dumps** - cannot overload the system
4. 🔍 **Review failure modes** of all proxy modules

> *"Today's outage was the most serious incident since 2019"*
> — Matthew Prince, CEO

---

# 💡 Our Technical Conclusions

## What could have been done better?

```rust
let features = append_with_names(&config).unwrap_or_default();
if features.len() > 200 {
    log::warn!("Retrieved {} features, exceeded limit 200. Taking first 200.", features.len());
    features.truncate(200);
}
// ✅ Continue with features
```

<!-- 
Just take first 200 and let's continue 
-->

---

### Instead of:
```rust
.unwrap()  // ❌ PANIC!
```

### Should be:
```rust
.unwrap_or_else(|e| { log::error!("{}", e); defaults() })
```

<!--
The part that's interesting to me is there was no fallback. No "hey something's weird here, let me use the old config." Just straight up unwrap() and panic. In production. On critical infrastructure?
-->

---

## Preventing Deployment Spread: Circuit Breakers and Rollout Strategies

### Why did the update keep spreading?

![w:auto h:300](assets/mermaid/mermaid-7.svg)

**Automated rollouts without real-time monitoring** → Errors propagate unchecked

---

### Circuit Breaker Pattern for Deployments

![w:auto h:300](assets/mermaid/mermaid-8.svg)

**Stop propagation if errors exceed safe limits**

---

### Different Strategies for Different Changes

| Change Type | Strategy | Speed vs Safety |
|-------------|----------|-----------------|
| 🔒 **Security Patches** | Fast rollout | ⚡ Speed (counter attacks) |
| 🏗️ **Infrastructure Changes** | Canary / Blue-Green | 🛡️ Safety (rollback ready) |

**Balance speed for security with caution for infra**

---

---

# 🏢 Organizational Problem

![w:auto h:300](assets/mermaid/mermaid-9.svg)

## 🎯 Key problem:
**Change in one place → explosion in another**

---

# 🧪 What about the test environment?

## Possible explanation:

![w:auto h:300](assets/mermaid/mermaid-10.svg)

**Production scale ≠ Test scale**

---

<!-- style: h2 { font-size: 0.8em; } blockquote { font-size: 0.7em; } -->

# 🔥 Key Lessons

## 1️⃣ Defensive Programming

> Never trust that inputs will be correct

## 2️⃣ Graceful Degradation

> System should work limited, not crash

## 3️⃣ Inter-team Communication

> Changes in one system can affect others

## 4️⃣ Production-scale Testing

> Pre-prod must reflect reality

---

# 📈 Outage Visualization

![w:auto h:300](assets/mermaid/mermaid-11.svg)

**Fluctuations** = different nodes with different feature file versions

---

# 🤔 For Discussion

## Questions for the team:

1. 🔍 **Do we have similar "hidden dependencies"** in our systems?

2. 🦀 **How do we handle errors** in critical code paths?

3. 📊 **Do our test environments** reflect production scale?

4. 🔔 **How quickly will we detect** an outage before users?

5. 📝 **Do we do post-mortems** and are they public?

---

# 🎯 Summary

![w:auto h:300](assets/mermaid/mermaid-12.svg)

---

# 📚 Sources

## Official Post-Mortem:
🔗 [blog.cloudflare.com/18-november-2025-outage](https://blog.cloudflare.com/18-november-2025-outage/)

## Video:
🎬 [IT News #25 - DevMentors](https://www.youtube.com/watch?v=ztxhKSBdtnM)

---

# 🙏 Thank You!

## Questions?

```
   _____ _                 _ __ _                 
  / ____| |               | |/ _| |                
 | |    | | ___  _   _  __| | |_| | __ _ _ __ ___ 
 | |    | |/ _ \| | | |/ _` |  _| |/ _` | '__/ _ \
 | |____| | | (_) | |_| | (_| | | | | (_| | | |  __/
  \_____|_|\___/ \__,_|\__,_|_| |_|\__,_|_|  \___|
                                                   
       🛡️ Post-Mortem 18.11.2025 🛡️
```

**Contact:** granica.lukasz@gmail.com