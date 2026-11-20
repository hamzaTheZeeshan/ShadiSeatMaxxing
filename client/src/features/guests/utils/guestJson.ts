import {
  DEFAULT_GUEST_FIELDS,
  MAX_GUESTS,
  MAX_IMPORT_CHARS,
  guestInputSchema,
  isValidGuestId,
} from "../types/guestSchema";
import type { Guest, GuestParseResult, ImportedGuest, NewGuest } from "../types/guestSchema";

const SHAPE_ERROR = "Expected a list of guests or { version: 1, guests: [...] }";

function fail(message: string): GuestParseResult {
  return { guests: [], errors: [message] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGuestJson(text: string): GuestParseResult {
  if (text.length > MAX_IMPORT_CHARS) return fail("File too large (max 2 MB)");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return fail(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (isRecord(data) && "guests" in data) {
    if (data.version !== 1) {
      const found = data.version === undefined ? "none" : JSON.stringify(data.version);
      return fail(`Unsupported version: found ${found}, expected 1`);
    }
    if (!Array.isArray(data.guests)) return fail(SHAPE_ERROR);
    list = data.guests;
  } else {
    return fail(SHAPE_ERROR);
  }

  if (list.length > MAX_GUESTS) return fail(`Too many guests (max ${MAX_GUESTS})`);

  const guests: ImportedGuest[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  list.forEach((entry, index) => {
    const parsed = guestInputSchema.safeParse(entry);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.map(String).join(".");
        errors.push(`guests[${index}]${path === "" ? "" : `.${path}`}: ${issue.message}`);
      }
      return;
    }
    const { id, ...rest } = parsed.data;
    if (id !== undefined && isValidGuestId(id) && !seenIds.has(id)) {
      seenIds.add(id);
      guests.push({ ...rest, id });
    } else {
      guests.push(rest); // invalid or duplicate id dropped silently; the store assigns a new one
    }
  });

  return { guests, errors };
}

function pickGuest(g: Guest): Guest {
  return {
    id: g.id,
    name: g.name,
    household: g.household,
    side: g.side,
    gender: g.gender,
    age_band: g.age_band,
    role: g.role,
    vip: g.vip,
    mobility: g.mobility,
    dietary: g.dietary,
    notes: g.notes,
  };
}

export function serializeGuests(guests: Guest[]): string {
  return JSON.stringify({ version: 1, guests: guests.map(pickGuest) }, null, 2);
}

const TEMPLATE_GUESTS: NewGuest[] = [
  {
    name: "Example Guest 1",
    household: "Example Family A",
    side: "bride",
    gender: "female",
    age_band: "senior",
    role: "grandparent",
    vip: "chief_guest",
    mobility: "wheelchair",
    dietary: "none",
    notes: "Needs step-free access",
  },
  {
    name: "Example Guest 2",
    household: "Example Family A",
    side: "bride",
    gender: "male",
    age_band: "adult",
    role: "parent",
    vip: "vip",
    mobility: "none",
    dietary: "vegetarian",
    notes: "",
  },
  {
    name: "Example Guest 3",
    household: "",
    side: "groom",
    gender: "unspecified",
    age_band: "child",
    role: "friend",
    vip: "none",
    mobility: "assistance",
    dietary: "allergy",
    notes: "Example allergy note",
  },
];

export const GUEST_JSON_TEMPLATE: string = JSON.stringify({ version: 1, guests: TEMPLATE_GUESTS }, null, 2);

// ---------------------------------------------------------------------------
// Realistic sample list (~210 guests) for AI prompting.
// Fully deterministic: no randomness, so every download is identical.
// Ids are omitted on purpose; the store assigns them on import.
// ---------------------------------------------------------------------------

function guest(
  name: string,
  household: string,
  side: NewGuest["side"],
  gender: NewGuest["gender"],
  age_band: NewGuest["age_band"],
  role: NewGuest["role"],
  extra: Partial<NewGuest> = {},
): NewGuest {
  return { ...DEFAULT_GUEST_FIELDS, name, household, side, gender, age_band, role, ...extra };
}

const CURATED_GUESTS: NewGuest[] = [
  // Bride's family
  guest("Ayesha Malik", "Malik Family", "bride", "female", "adult", "couple", { vip: "chief_guest", notes: "Bride" }),
  guest("Tariq Malik", "Malik Family", "bride", "male", "adult", "parent", { vip: "vip", notes: "Father of the bride" }),
  guest("Nasreen Malik", "Malik Family", "bride", "female", "adult", "parent", { vip: "vip", notes: "Mother of the bride" }),
  guest("Chaudhry Abdul Majeed Malik", "Malik Family", "bride", "male", "senior", "grandparent", {
    vip: "chief_guest",
    mobility: "wheelchair",
    notes: "Bride's paternal grandfather. Needs step-free access and an aisle seat.",
  }),
  guest("Zubaida Majeed Malik", "Malik Family", "bride", "female", "senior", "grandparent", {
    vip: "vip",
    mobility: "walker",
    dietary: "vegetarian",
  }),
  guest("Bilal Malik", "Malik Family", "bride", "male", "adult", "sibling", { role: "wedding_party", notes: "Brother of the bride" }),
  guest("Hira Malik", "Malik Family", "bride", "female", "teen", "sibling", { notes: "Sister of the bride" }),

  // Groom's family
  guest("Hamza Qureshi", "Qureshi Family", "groom", "male", "adult", "couple", { vip: "chief_guest", notes: "Groom" }),
  guest("Naveed Qureshi", "Qureshi Family", "groom", "male", "adult", "parent", { vip: "vip", notes: "Father of the groom" }),
  guest("Shazia Qureshi", "Qureshi Family", "groom", "female", "adult", "parent", {
    vip: "vip",
    dietary: "allergy",
    notes: "Mother of the groom. Severe nut allergy.",
  }),
  guest("Haji Ghulam Mustafa Qureshi", "Qureshi Family", "groom", "male", "senior", "grandparent", {
    vip: "vip",
    mobility: "assistance",
    notes: "Groom's grandfather. Seat near the entrance.",
  }),
  guest("Saad Qureshi", "Saad Qureshi Household", "groom", "male", "adult", "sibling", { notes: "Brother of the groom" }),
  guest("Mehwish Saad", "Saad Qureshi Household", "groom", "female", "adult", "sibling", {}),
  guest("Ayaan Qureshi", "Saad Qureshi Household", "groom", "male", "infant", "relative", { notes: "Needs high chair or baby seat" }),

  // Bride's relatives
  guest("Dr. Imran Siddiqui", "Siddiqui Family", "bride", "male", "adult", "relative", {
    vip: "vip",
    notes: "Bride's maternal uncle",
  }),
  guest("Farah Siddiqui", "Siddiqui Family", "bride", "female", "adult", "relative", {}),
  guest("Maryam Siddiqui", "Siddiqui Family", "bride", "female", "child", "relative", {
    dietary: "allergy",
    notes: "Peanut allergy. Carries an EpiPen.",
  }),
  guest("Zayan Siddiqui", "Siddiqui Family", "bride", "male", "infant", "relative", { notes: "Needs high chair or baby seat" }),

  // Groom's relatives
  guest("Khalid Baloch", "Baloch Family", "groom", "male", "senior", "relative", { vip: "vip", mobility: "wheelchair", notes: "Needs step-free access" }),
  guest("Rukhsana Baloch", "Baloch Family", "groom", "female", "senior", "relative", {
    mobility: "assistance",
    dietary: "vegetarian",
  }),

  // Family friends (either side)
  guest("Justice (r) Anwar Mirza", "Mirza Family", "other", "male", "senior", "family_friend", {
    vip: "vip",
    mobility: "walker",
    notes: "Retired judge, long-time family friend",
  }),
  guest("Samina Mirza", "Mirza Family", "other", "female", "senior", "family_friend", { vip: "vip" }),

  // Bride's friends
  guest("Noor Fatima", "", "bride", "female", "adult", "friend", { role: "wedding_party", notes: "Bridesmaid" }),
  guest("Rabia Anwar", "", "bride", "female", "adult", "friend", { role: "wedding_party", notes: "Bridesmaid" }),
  guest("Sadia Usmani", "", "bride", "female", "adult", "friend", { dietary: "vegetarian" }),

  // Groom's friends
  guest("Junaid Raza", "", "groom", "male", "adult", "friend", { role: "wedding_party", notes: "Best man" }),
  guest("Danish Alvi", "", "groom", "male", "adult", "friend", { role: "wedding_party", notes: "Groomsman" }),

  // Colleagues
  guest("Faisal Mehmood", "", "groom", "male", "adult", "colleague", {}),
  guest("Sana Tariq", "", "groom", "female", "adult", "colleague", { dietary: "allergy", notes: "Shellfish allergy" }),
  guest("Omar Farooqui", "", "bride", "male", "adult", "colleague", { dietary: "vegetarian" }),
];

const SURNAMES = [
  "Khan", "Ahmed", "Sheikh", "Ansari", "Memon", "Chaudhry", "Butt", "Rizvi", "Zaidi", "Naqvi",
  "Abbasi", "Soomro", "Jatoi", "Lashari", "Talpur", "Pathan", "Yousafzai", "Afridi", "Bangash", "Niazi",
  "Gill", "Cheema", "Warraich", "Rajput", "Dar", "Lodhi", "Kakar", "Jamali", "Mughal", "Kazmi",
  "Bukhari", "Gilani", "Hussain", "Iqbal", "Saeed", "Aslam", "Zafar", "Nawaz", "Rehman", "Latif",
  "Qadir", "Shah", "Lakhani", "Dawood", "Hameed", "Javed", "Kamal", "Mansoor", "Nasir", "Parvez",
  "Rauf", "Sultan", "Wahid", "Yaqoob",
] as const;

const MALE_NAMES = [
  "Ahmed", "Bilal", "Faisal", "Imran", "Kamran", "Naveed", "Omar", "Rashid", "Salman", "Tariq",
  "Usman", "Waseem", "Zahid", "Adnan", "Asif", "Danish", "Farhan", "Hamza", "Irfan", "Junaid",
  "Khalid", "Mubashir", "Nadeem", "Owais", "Qasim", "Raheel", "Saad", "Talha", "Umair", "Yasir",
] as const;

const FEMALE_NAMES = [
  "Ayesha", "Bushra", "Farah", "Hina", "Iqra", "Kiran", "Lubna", "Maryam", "Nazia", "Rabia",
  "Sadia", "Saima", "Tahira", "Uzma", "Zainab", "Amna", "Fatima", "Huma", "Mehwish", "Noor",
  "Rubina", "Samina", "Sana", "Shazia", "Sumaira", "Tehmina", "Yasmeen", "Zara", "Anum", "Bisma",
] as const;

const BOY_NAMES = ["Ali", "Hassan", "Zayan", "Ayaan", "Rayyan", "Hadi", "Ibrahim", "Musa", "Daniyal", "Shayan"] as const;
const GIRL_NAMES = ["Inaya", "Minahil", "Alizeh", "Hoorain", "Eshal", "Laiba", "Mahnoor", "Zoya", "Areeba", "Anaya"] as const;
const SENIOR_MALE_NAMES = [
  "Haji Abdul Karim", "Ghulam Mustafa", "Muhammad Siddique", "Abdul Ghani", "Nazir Ahmed", "Mohammad Rafiq", "Allah Bux", "Fazal Elahi",
] as const;
const SENIOR_FEMALE_NAMES = ["Khursheed", "Zubaida", "Shamim", "Naseem", "Saeeda", "Hameeda", "Rukhsana", "Mumtaz"] as const;

const ALLERGY_NOTES = ["Peanut allergy", "Dairy allergy", "Shellfish allergy", "Gluten intolerance", "Egg allergy"] as const;
const SENIOR_MOBILITY = ["walker", "none", "assistance", "none", "wheelchair", "none"] as const;
const HOUSEHOLD_ROLES = ["relative", "friend", "family_friend", "relative", "colleague"] as const;

type Kind = "m" | "f" | "sm" | "sf" | "boy" | "girl" | "teen" | "inf";

const HOUSEHOLD_SHAPES: ReadonlyArray<ReadonlyArray<Kind>> = [
  ["m", "f", "boy", "girl", "teen"],
  ["sm", "sf", "m"],
  ["m", "f", "inf"],
  ["m", "f", "boy", "girl"],
  ["f", "m"],
  ["sm", "sf", "m", "f", "boy"],
];

const GENERATED_TARGET = 210;

function pick<T>(items: ReadonlyArray<T>, n: number): T {
  const value = items[n % items.length];
  if (value === undefined) throw new Error("Sample data pool is empty");
  return value;
}

function buildGeneratedGuests(startCount: number): NewGuest[] {
  const out: NewGuest[] = [];
  let n = 0; // global member counter drives name, dietary and mobility rotation
  let h = 0; // household counter

  while (startCount + out.length < GENERATED_TARGET) {
    const shape = pick(HOUSEHOLD_SHAPES, h);
    const side: NewGuest["side"] = h % 2 === 0 ? "bride" : "groom";
    const baseSurname = pick(SURNAMES, h * 7 + 3);
    const surname = h >= SURNAMES.length ? `${baseSurname}` : baseSurname;
    const household = `${surname} Family${h >= SURNAMES.length ? ` ${Math.floor(h / SURNAMES.length) + 1}` : ""}`;
    const role = pick(HOUSEHOLD_ROLES, h + Math.floor(h / 5));
    const householdIsVip = h % 9 === 4;

    shape.forEach((kind, memberIndex) => {
      n += 1;
      let first: string;
      let gender: NewGuest["gender"];
      let age_band: NewGuest["age_band"];
      switch (kind) {
        case "m": first = pick(MALE_NAMES, n * 3 + h); gender = "male"; age_band = "adult"; break;
        case "f": first = pick(FEMALE_NAMES, n * 3 + h); gender = "female"; age_band = "adult"; break;
        case "sm": first = pick(SENIOR_MALE_NAMES, n + h); gender = "male"; age_band = "senior"; break;
        case "sf": first = pick(SENIOR_FEMALE_NAMES, n + h); gender = "female"; age_band = "senior"; break;
        case "boy": first = pick(BOY_NAMES, n + h); gender = "male"; age_band = "child"; break;
        case "girl": first = pick(GIRL_NAMES, n + h); gender = "female"; age_band = "child"; break;
        case "teen": first = pick(n % 2 === 0 ? BOY_NAMES : GIRL_NAMES, n + 2 * h); gender = n % 2 === 0 ? "male" : "female"; age_band = "teen"; break;
        case "inf": first = pick(n % 2 === 0 ? BOY_NAMES : GIRL_NAMES, n + 5 * h); gender = n % 2 === 0 ? "male" : "female"; age_band = "infant"; break;
      }

      const extra: Partial<NewGuest> = {};
      const notes: string[] = [];

      if (age_band === "senior") {
        const mobility = pick(SENIOR_MOBILITY, n);
        extra.mobility = mobility;
        if (mobility === "wheelchair") notes.push("Needs step-free access");
        else if (mobility === "walker") notes.push("Prefers an aisle seat");
        else if (mobility === "assistance") notes.push("Seat near the entrance");
      }
      if (age_band === "infant") notes.push("Needs high chair or baby seat");
      if (memberIndex === 0 && householdIsVip) extra.vip = "vip";

      if (n % 23 === 7) {
        extra.dietary = "allergy";
        notes.push(pick(ALLERGY_NOTES, n));
      } else if (n % 9 === 4) {
        extra.dietary = "vegetarian";
      }

      extra.notes = notes.join(". ");
      out.push(guest(`${first} ${surname}`, household, side, gender, age_band, role, extra));
    });

    h += 1;
  }
  return out;
}

export const SAMPLE_GUESTS: ReadonlyArray<NewGuest> = [
  ...CURATED_GUESTS,
  ...buildGeneratedGuests(CURATED_GUESTS.length),
];

export const SAMPLE_200_GUESTS_JSON: string = JSON.stringify({ version: 1, guests: SAMPLE_GUESTS }, null, 2);