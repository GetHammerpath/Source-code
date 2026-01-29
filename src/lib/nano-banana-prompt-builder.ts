// Nano Banana Prompt Builder
// Auto-fills missing fields with sensible defaults for photorealistic avatar generation

export interface PromptFields {
  age: number;
  gender: string;
  ethnicity?: string;
  build: string;
  hair: string;
  expression: string;
  framing: string;
  clothing: string;
  accessories: string;
  action: string;
  location: string;
  background: string;
  lighting: string;
  lens: string;
}

export interface RolePreset {
  role: string;
  clothing: string;
  accessories: string;
  location: string;
  action: string;
}

const ROLE_PRESETS: Record<string, RolePreset> = {
  cowboy: {
    role: "cowboy",
    clothing: "black felt cowboy hat, dark denim jacket, western shirt, leather belt with simple buckle, dark jeans, and worn leather cowboy boots",
    accessories: "coiled lasso",
    location: "sunlit ranch",
    action: "holding a coiled lasso at his side",
  },
  painter: {
    role: "painter",
    clothing: "paint-splattered overalls, a white t-shirt, work gloves, and practical sneakers",
    accessories: "roller tray and brush",
    location: "bright indoor room",
    action: "holding a roller tray and brush while standing beside a freshly painted interior wall with painter's tape",
  },
  chef: {
    role: "chef",
    clothing: "white chef's jacket, checkered pants, and non-slip kitchen shoes",
    accessories: "chef's hat and kitchen towel",
    location: "professional kitchen",
    action: "standing at a prep station with fresh ingredients",
  },
  nurse: {
    role: "nurse",
    clothing: "light blue scrubs, comfortable sneakers",
    accessories: "stethoscope and clipboard",
    location: "hospital corridor",
    action: "walking confidently with clipboard in hand",
  },
  firefighter: {
    role: "firefighter",
    clothing: "fire-resistant uniform, heavy-duty boots",
    accessories: "helmet and gloves",
    location: "fire station",
    action: "standing beside fire truck in ready position",
  },
  "construction worker": {
    role: "construction worker",
    clothing: "high-visibility vest, work pants, steel-toed boots",
    accessories: "hard hat and tool belt",
    location: "construction site",
    action: "holding a tool, surveying the work area",
  },
  realtor: {
    role: "realtor",
    clothing: "professional blazer, dress shirt, dress pants, polished dress shoes",
    accessories: "key ring and tablet",
    location: "modern home interior",
    action: "holding a tablet, showing property features",
  },
  barber: {
    role: "barber",
    clothing: "barber's smock, casual shirt, dark pants",
    accessories: "clippers and comb",
    location: "barbershop",
    action: "holding clippers, ready to work",
  },
  "yoga instructor": {
    role: "yoga instructor",
    clothing: "athletic wear, yoga pants, tank top",
    accessories: "yoga mat",
    location: "bright yoga studio",
    action: "standing in a calm pose, mat nearby",
  },
  mechanic: {
    role: "mechanic",
    clothing: "work coveralls, steel-toed boots",
    accessories: "wrench and rag",
    location: "auto shop",
    action: "holding a wrench, standing by a vehicle",
  },
};

function detectRole(userText: string): string | null {
  const lower = userText.toLowerCase();
  for (const role of Object.keys(ROLE_PRESETS)) {
    if (lower.includes(role)) return role;
  }
  return null;
}

function detectGender(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes("female") || lower.includes("woman") || lower.includes("girl")) return "female";
  if (lower.includes("male") || lower.includes("man") || lower.includes("guy")) return "male";
  return "male"; // default
}

function detectAge(userText: string): number {
  const lower = userText.toLowerCase();
  const ageMatch = lower.match(/\b(\d{2,3})\s*(?:years?|yrs?|old)\b/);
  if (ageMatch) return parseInt(ageMatch[1], 10);
  if (lower.includes("young") || lower.includes("teen")) return 25;
  if (lower.includes("older") || lower.includes("senior") || lower.includes("elderly")) return 55;
  if (lower.includes("40s") || lower.includes("forties")) return 42;
  if (lower.includes("50s") || lower.includes("fifties")) return 52;
  return 32; // default
}

function detectEthnicity(userText: string): string | undefined {
  const lower = userText.toLowerCase();
  const ethnicityTerms: Record<string, string> = {
    black: "Black",
    african: "Black",
    white: "white",
    caucasian: "white",
    asian: "Asian",
    hispanic: "Hispanic",
    latino: "Hispanic",
    latina: "Hispanic",
    middle: "Middle Eastern",
    arab: "Middle Eastern",
    indian: "South Asian",
    native: "Native American",
  };
  for (const [term, label] of Object.entries(ethnicityTerms)) {
    if (lower.includes(term)) return label;
  }
  return undefined;
}

export function inferDefaults(userText: string, overrides: Partial<PromptFields> = {}): PromptFields {
  const role = detectRole(userText);
  const preset = role ? ROLE_PRESETS[role] : null;
  const gender = detectGender(userText);
  const age = detectAge(userText);
  const ethnicity = detectEthnicity(userText);

  return {
    age: overrides.age ?? age,
    gender: overrides.gender ?? gender,
    ethnicity: overrides.ethnicity ?? ethnicity,
    build: overrides.build ?? "athletic/average",
    hair: overrides.hair ?? "short, well-groomed hair",
    expression: overrides.expression ?? "calm confident expression",
    framing: overrides.framing ?? "headshot, face only, tight crop from shoulders up, face fills frame",
    clothing: overrides.clothing ?? (preset?.clothing ?? "professional attire, realistic materials, minimal logos"),
    accessories: overrides.accessories ?? (preset?.accessories ?? "1-2 relevant items"),
    action: overrides.action ?? (preset?.action ?? "standing naturally"),
    location: overrides.location ?? (preset?.location ?? "simple, uncluttered setting"),
    background: overrides.background ?? "simple, uncluttered, context-appropriate",
    lighting: overrides.lighting ?? (preset?.location?.includes("indoor") ? "soft natural window light" : "golden hour natural light"),
    lens: overrides.lens ?? "85mm",
  };
}

export function generatePositivePrompt(fields: PromptFields): string {
  const ethnicityPart = fields.ethnicity ? ` ${fields.ethnicity}` : "";
  const genderLabel = fields.gender === "female" ? "woman" : "man";
  // Lead with headshot framing so the model prioritizes face crop over body
  return `Headshot. ${fields.framing}. Tight crop from shoulders up, face centered, no body below shoulders. Photorealistic portrait of a ${fields.age}-year-old ${fields.gender}${ethnicityPart} ${genderLabel}, ${fields.build}, ${fields.hair}, ${fields.expression}. ${fields.clothing}. Background: ${fields.background}. Lighting: ${fields.lighting}. ${fields.lens} lens, shallow depth of field, sharp focus on eyes and face, natural skin texture, high detail, natural colors, no stylization.`;
}

export function generateNegativePrompt(): string {
  return "Avoid cartoon, anime, illustration, CGI, painting, stylized skin, over-smoothed/waxy skin, low-res, blurry, noisy, bad anatomy, extra fingers, deformed hands, crossed eyes, duplicate people, text, watermark, logo. No full body, no body shot, no torso, no full length, no mid shot, no waist up, no legs, no arms below shoulders.";
}

export function buildPrompts(userText: string, overrides: Partial<PromptFields> = {}): {
  positive: string;
  negative: string;
} {
  const fields = inferDefaults(userText, overrides);
  return {
    positive: generatePositivePrompt(fields),
    negative: generateNegativePrompt(),
  };
}
