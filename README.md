# Iran Knowledge Atlas — Public Distribution

**A public research showcase on knowledge-system accumulation, disruption, resilience and recovery across Iranian and Persianate history.**

## Live website

- **Project showcase:** https://aryakia.github.io/iran-knowledge-Atlas/
- **Interactive atlas and public model results:** https://aryakia.github.io/iran-knowledge-Atlas/atlas/


This repository contains only the deliberately reduced public distribution of the **Iran Knowledge Atlas**. The canonical research model remains private.

## Project architecture

This public repository is the **showcase and public distribution layer** for the Iran Knowledge Atlas research project.

The underlying System Dynamics research model is maintained separately in a **private canonical repository**. That private research layer contains the full model implementation, Python and JavaScript engines, equations, parameterization, sensitivity-analysis code, research data, tests, and development history.

Only reviewed public-facing material and precomputed model outputs are exported into this repository.

```text
PRIVATE RESEARCH LAYER
Canonical System Dynamics model
Python + JavaScript engines
Equations and parameters
Sensitivity analysis
Research data and tests
        │
        │ controlled / audited export
        ▼
PUBLIC REPOSITORY
Iran Knowledge Atlas
        │
        ▼
GitHub Pages
        │
        ├── Project showcase
        └── Interactive public atlas
```

The public repository therefore does **not** expose the private model source or research implementation. It provides a safe way to present the project, its historical evidence layer, reconstructed outputs, and selected precomputed System Dynamics experiments.

The public site separates three layers:

1. **Evidence** — documented events, people, periods, places and public source links.
2. **Historical reconstruction** — normalized model outputs conditional on proxy coding and uncalibrated assumptions.
3. **System Dynamics experiments** — named, precomputed scenario outputs with a structural-sensitivity range.

The site also includes dynasty comparison, guided story tours, global search, provenance inspection, documentary-coverage metadata and shareable URL state.

It does **not** contain the private research implementation, model equations, coefficients, parameter files, raw driver profiles, event-effect magnitudes, Python implementation, sensitivity code, tests, internal research notes, or private Git history.

The published indices and trajectories are exploratory model outputs. They are not measured historical IQ, forecasts, identified causal effects, or population rankings.

Public releases expose a version number and private-source revision fingerprint so the showcase can be tied to a reproducible research release without exposing the research source.

Copyright © Arya Kia. All rights reserved unless a specific asset states otherwise.
