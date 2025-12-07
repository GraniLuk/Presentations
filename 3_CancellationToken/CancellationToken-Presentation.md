---
marp: true
theme: default
---

# CancellationToken

```mermaid
flowchart LR
    A[Start] --> B{Is cancellation requested?};
    B -->|Yes| C[Stop];
    B -->|No| D[Continue];
```
