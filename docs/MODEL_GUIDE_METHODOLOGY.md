# Model Prompting Guide Methodology

Checklist for investigating prompting techniques when adding a new model to pixery.

## Sources to Check

1. **Official documentation** - Hugging Face model card, CivitAI page, GitHub repo
2. **Training details** - What dataset, what captions, what resolution
3. **Community resources** - Discord, Reddit, prompt databases

## Information to Extract

### 1. Style Classification

Determine the prompting style:
- **prose** - Natural language descriptions (Gemini, DALL-E)
- **tags** - Booru-style comma-separated tags (Animagine)
- **hybrid** - Mix of tags and natural language (Pony, NoobAI)

### 2. Required Prefix/Suffix

Does the model require specific tags at the start or end?
- Score tags (Pony: `score_9, score_8_up...`)
- Quality tags (NoobAI: `masterpiece, best quality, newest...`)
- None required (Gemini, Animagine)

### 3. Tag Categories

Document all discrete tag sets with their options:

**Quality/Score Tags**
- What options exist? (masterpiece, best quality, high score, etc.)
- What do they mean? (percentile-based? aesthetic rating?)
- Which go in positive vs negative?

**Rating Tags**
- Content safety levels (safe, sensitive, nsfw, explicit)
- Format variations (rating_safe vs just safe)

**Temporal/Era Tags**
- Year tags (year 2005, year 2023)
- Period tags (old, early, mid, recent, newest)
- What eras/styles do they invoke?

**Source/Style Tags**
- Source tags (source_anime, source_cartoon)
- Style modifiers specific to the model

**Aesthetic Tags**
- Any special aesthetic controls (very awa, worst aesthetic)

### 4. Resolution/Aspect Ratio

- What resolution was the model trained on?
- Recommended aspect ratios with exact dimensions
- Maximum resolution before quality degrades

### 5. Recommended Settings

- CFG scale (range and recommended value)
- Steps (minimum, recommended, diminishing returns point)
- Sampler (which work, which are required, which fail)
- CLIP Skip (if applicable, often critical)
- Any other model-specific parameters

### 6. Negative Prompt Template

- Standard negative prompt for this model
- Model-specific issues to negate (signatures, anatomy, etc.)
- Tags that should always be in negative for certain styles

### 7. Limitations

Document known failure modes:
- Anatomy issues (hands, fingers, eyes)
- Text rendering capability
- Character accuracy (known vs new characters)
- Multi-character scenes
- Resolution limits
- Sampler incompatibilities
- Style consistency issues

### 8. Architecture Notes

Important if the model differs from standard:
- v-prediction vs epsilon-prediction (affects sampler choice)
- Base model (SD 1.5, SDXL, etc.)
- Special requirements (scheduler settings, etc.)

## Guide Format

Structure the guide for the `PromptingGuide` struct in `models.rs`:

```rust
PromptingGuide {
    model_pattern: "model-name",  // Prefix match for model IDs
    style: "tags/prose/hybrid",
    required_prefix: Some("...") or None,
    structure: "[field], [field], [field]...",
    tips: r#"
- Critical settings/warnings first
- Tag categories with all discrete options
- Resolution recommendations
- Limitations
"#,
    avoid: Some("things that break the model"),
    negative_template: Some("standard negative prompt"),
    settings: Some("CFG: X, Steps: Y, Sampler: Z"),
    example: "complete working example prompt",
}
```

## Quality Checklist

Before finalizing a guide, verify:

- [ ] All discrete tag options documented (not just "use quality tags")
- [ ] Resolution recommendations with exact dimensions
- [ ] Critical settings called out (CLIP Skip, sampler requirements)
- [ ] Limitations documented (what fails, workarounds)
- [ ] Working example that uses the documented structure
- [ ] Negative prompt template included
- [ ] Architecture quirks noted if non-standard
