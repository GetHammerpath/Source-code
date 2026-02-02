# Video Quality Improvement Phases

Structured plan to improve video output quality across prompts, stitching, models, and UX. Each phase has a ready-to-use prompt for implementation.

---

## Phase 1: Quick Wins (Low Effort, High Impact)

**Goal:** Ship fast improvements that noticeably improve transition smoothness and prompt quality.

**Scope:**
- Default stitch to trim mode (1s) for multi-scene videos
- Add lighting and camera style to scene prompts
- Add explicit "avatar consistency checklist" to scene prompts
- Slightly relax word limits (20→22 for Scene 1, 17→19 for scenes 2+)

### Prompt for Phase 1

```
Implement Phase 1 of the Video Quality Improvement plan:

1. DEFAULT TRIM MODE
   - When kie-callback and sora2-callback trigger cloudinary-stitch-videos for multi-scene generations, ensure trim: true and trim_seconds: 1 are passed (already done in callbacks - verify).
   - In the frontend (VideoGenerationsList, VideoGenerationCard), default the "stitch with trim" option to checked/on when stitching multi-scene videos.

2. PROMPT ENHANCEMENTS (analyze-image-kie, runway-extend-analyze, analyze-image-sora)
   - Add to scene prompt instructions: "Include explicit lighting (e.g., soft morning light, diffused office lighting, golden hour) and camera style (e.g., static wide shot, subtle handheld feel) in every scene prompt."
   - Add to the MANDATORY PROMPT ELEMENTS: "Avatar Consistency Checklist - each scene must mention: same clothing, same hair style, same pose/position continuity from previous scene end."

3. WORD LIMITS
   - In analyze-image-kie: change Scene 1 script max from 20 to 22 words, scenes 2+ from 17 to 19 words.
   - Update validate-script-length limits or any constants that enforce these word counts so pacing feels less rushed.
```

---

## Phase 2: Prompt & Scene Quality

**Goal:** Improve visual coherence, transition continuity, and avatar consistency through stronger prompt engineering.

**Scope:**
- More specific visual direction (lighting, camera, composition)
- Stronger transition language (exact pose matching between scenes)
- Avatar consistency checklist enforced per scene

### Prompt for Phase 2

```
Implement Phase 2 of the Video Quality Improvement plan - Prompt & Scene Quality:

1. TRANSITION PROTOCOL
   - In analyze-image-kie system prompt, add a "TRANSITION PROTOCOL" section:
     - Scene 1 ending: "Describe the EXACT final pose: e.g., 'Scene 1 ends with [avatar] standing neutral, weight on right foot, arms at sides, facing 3/4 toward camera, hands visible.'"
     - Scenes 2+ opening: "Start with: 'Continuing from previous frame - [avatar] in the SAME pose (weight on right foot, arms at sides), now [action]...' Match the previous scene's ending pose exactly before any new action."

2. VISUAL DIRECTION BLOCK
   - Add to each scene's prompt template: "LIGHTING: [consistent style - e.g., soft key light from left, fill from right]. CAMERA: [static medium shot / slight handheld / locked wide]. COMPOSITION: [avatar position in frame - center, rule of thirds]."

3. AVATAR CONSISTENCY
   - In kie-extend-next and sora2-extend-next voice/continuity blocks, add: "VISUAL CHECK: Same clothing (describe: [from scene 1]), same hairstyle, same accessories. No wardrobe or appearance changes between scenes."
   - Pass a short avatar_appearance_summary from scene 1 analysis into extend prompts (e.g., "navy polo, tan pants, short dark hair").

4. SCENE-SPECIFIC PROMPT TEMPLATE
   - Update the JSON output format in analyze-image-kie to include optional fields: lighting, camera_style, ending_pose (for scenes 1 to N-1). Use these when building the final prompts for kie-generate-video and extend calls.
```

---

## Phase 3: Stitching & Transitions

**Goal:** Smoother transitions between segments and configurable trim behavior.

**Scope:**
- Model-aware trim seconds (Veo vs Sora)
- Configurable trim in UI
- Explore crossfade if Cloudinary supports it

### Prompt for Phase 3

```
Implement Phase 3 of the Video Quality Improvement plan - Stitching & Transitions:

1. MODEL-AWARE TRIM
   - In kie-callback and sora2-callback, when calling cloudinary-stitch-videos, pass trim_seconds based on model:
     - Veo (kie): trim_seconds: 1.5 (Veo uses ~1s settling; slightly longer trim can smooth hard cuts)
     - Sora 2: trim_seconds: 1
     - Default: 1
   - Store model in generation record if not already available for the stitch call.

2. UI TRIM CONTROLS
   - In VideoGenerationsList and VideoGenerationCard, allow users to adjust trim_seconds (e.g., 0.5, 1, 1.5, 2) via a slider or dropdown before stitching.
   - Show helper text: "Trim removes the overlap between scenes for smoother transitions. 1s is recommended for most videos."

3. CLOUDINARY CROSSFADE (OPTIONAL)
   - Research Cloudinary video concatenation API for crossfade/dissolve between segments. If supported, add an option: trim + crossfade (e.g., 0.3s crossfade). Implement only if Cloudinary has native support; otherwise skip.
```

---

## Phase 4: Model & Resolution Strategy

**Goal:** Use the right model for each use case and explore Sora 2 Storyboard for multi-scene.

**Scope:**
- Veo 3.1 Quality for hero content
- Sora 2 Pro 1080p vs 720p guidance
- Evaluate sora-2-pro-storyboard for multi-scene

### Prompt for Phase 4

```
Implement Phase 4 of the Video Quality Improvement plan - Model & Resolution Strategy:

1. MODEL RECOMMENDATIONS IN UI
   - In Studio (VideoGeneratorForm) and Bulk (Step2_Config), add tooltips or helper text next to model selector:
     - Veo 3.1 Quality: "Best for hero content, demos, client-facing videos. Higher fidelity."
     - Veo 3.1 Fast: "Best for drafts and internal use. Faster, lower cost."
     - Sora 2 Pro 1080p: "Best for social/marketing. High resolution."
     - Sora 2 Pro 720p: "Good balance of quality and speed."
     - Kling 2.6: "Single-scene only. Strong for image-to-video."

2. SORA 2 STORYBOARD EVALUATION
   - Research Kie.ai sora-2-pro-storyboard API: input format (shots array), output format (single video vs segments), pricing.
   - If feasible: add an option in sora2-generate-video or a new path to use sora-2-pro-storyboard when number_of_scenes > 1, passing all scenes as shots in one API call. This may improve voice and visual consistency.
   - Document findings and implementation plan. If API differs significantly, create a spike/task for follow-up.
```

---

## Phase 5: Reference Image & Input Quality

**Goal:** Improve output by improving input quality guidance.

**Scope:**
- Image tips for uploads
- Validation or warnings for low-quality reference images

### Prompt for Phase 5

```
Implement Phase 5 of the Video Quality Improvement plan - Reference Image & Input Quality:

1. IMAGE TIPS IN UI
   - In Studio (VideoGeneratorForm), Bulk (Step1/Step2), and CreateAvatar, add an expandable "Image tips for best results" section or tooltip near the image upload:
     - Clear face, good lighting, neutral background
     - Person centered, medium shot (waist up or full body)
     - Avoid: heavy shadows, sunglasses, busy backgrounds, multiple people
     - Recommended: high resolution (min 512px), well-lit, professional attire if applicable

2. OPTIONAL: IMAGE VALIDATION (LOW PRIORITY)
   - Consider a lightweight check (e.g., dimensions, aspect ratio) before submit. Warn if image is very small or unusual aspect. Do not block submission.
```

---

## Phase 6: Audio & Voice Polish

**Goal:** Further improve voice consistency and script pacing.

**Scope:**
- Verify seed usage across Veo extends
- Script pacing refinements
- Audio level normalization (if feasible)

### Prompt for Phase 6

```
Implement Phase 6 of the Video Quality Improvement plan - Audio & Voice Polish:

1. SEED VERIFICATION
   - Confirm kie-extend-next always passes the same deterministic seed (from generation_id or stored seeds) for every extend call. Add logging when seed is used. Ensure kie-generate-video persists the seed and kie-extend-next reads it.

2. SCRIPT PACING
   - Review validate-script-length: ensure word limits align with Phase 1 changes (22/19). Add optional "relaxed" mode: 24/21 words for slightly slower delivery.
   - In analyze-image-kie, add guidance: "Pacing: Allow natural pauses. Avoid cramming too many words. Slight emphasis on key phrases."

3. AUDIO NORMALIZATION (EXPLORATORY)
   - Research whether Cloudinary or another service can normalize audio levels across concatenated video segments. If yes, add as optional post-processing step. If no, document as future enhancement.
```

---

## Phase 7: Post-Processing & Polish (Advanced) — IMPLEMENTED

*Implemented: Cloudinary e_saturation, e_contrast, e_volume:auto for optional color presets and audio normalization.*

**Goal:** Add optional color grading and advanced post-processing.

**Scope:**
- Color grading via Cloudinary (e_saturation, e_contrast)
- Audio normalization (e_volume:auto)

### Implementation (Completed)

1. **cloudinary-stitch-videos** accepts `color_preset` (neutral | warm | cool | high_contrast) and `audio_normalize` (boolean). Applies Cloudinary transformations to the final stitched video.

2. **Stitch UI** (VideoGenerationCard, VideoGenerationsList): Color Look dropdown and "Normalize audio" checkbox. Defaults: neutral, no audio normalization.

---

## Phase 8: User Controls & Transparency

**Goal:** Give users more control and visibility into how videos are built.

**Scope:**
- Edit prompts/scripts before generation
- A/B trim on/off
- Generation settings summary

### Prompt for Phase 8

```
Implement Phase 8 of the Video Quality Improvement plan - User Controls & Transparency:

1. EDIT BEFORE GENERATION
   - In Wizard Step3_Workbench (and equivalent in Studio/Bulk), ensure users can edit AI-generated prompts and scripts per scene before launching. Add a clear "Edit" affordance and show what will be sent to the video API.

2. TRIM OPTIONS
   - When stitching, offer: "Trim for smoother transitions" (on by default) and "No trim (full length)". Explain: "Trim removes overlap between scenes. Use no trim if you want full segment length."

3. GENERATION SUMMARY
   - Before launch, show a summary: model, scene count, estimated credits, trim setting (if applicable), and a one-line description of each scene. Allow last-minute edits or back navigation.
```

---

## Summary Table

| Phase | Focus | Effort | Dependencies |
|-------|-------|--------|--------------|
| 1 | Quick Wins | Low | None |
| 2 | Prompt & Scene Quality | Medium | Phase 1 |
| 3 | Stitching & Transitions | Medium | Phase 1 |
| 4 | Model Strategy | Low–Medium | None |
| 5 | Reference Image Quality | Low | None |
| 6 | Audio & Voice Polish | Low–Medium | Phase 1 |
| 7 | Post-Processing | Medium | Phase 3 |
| 8 | User Controls | Medium | Phase 1, 3 |

---

## Usage

Use the prompt for each phase as instructions for implementation. Phases can be done in order or in parallel where dependencies allow. Phase 1 is recommended first.
