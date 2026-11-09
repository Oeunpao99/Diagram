/** Every word on the landing page, in English and Khmer.
 *
 * The Khmer was written without a native-speaker review: have one read it
 * before launch. Example prompts and the demo diagrams stay in English on
 * purpose, since Khmer input to the AI hasn't been verified. */

export type Lang = "en" | "km";

interface Point {
  title: string;
  body: string;
}

export interface LandingCopy {
  nav: {
    how: string;
    examples: string;
    pricing: string;
    faq: string;
    login: string;
    signUp: string;
    startFree: string;
  };
  lang: { label: string };
  theme: { toLight: string; toDark: string };
  hero: { line1: string; line2: string; sub: string; seeExamples: string; small: string };
  demo: {
    tag: string;
    share: string;
    exportLabel: string;
    drew: (shapes: number, links: number) => string;
    drawing: (i: number, n: number) => string;
    tabsLabel: string;
    tabPrompt: string;
    tabSketch: string;
    askFirst: string;
    drawingYours: string;
    dropHint: string;
    reading: (found: number) => string;
    readDone: (boxes: number, arrows: number) => string;
    rebuilding: string;
    uploading: string;
    readingBoard: string;
    generating: string;
    saved: string;
    importLabel: string;
    autoLayout: string;
    direction: string;
    fit: string;
    panelSub: string;
    doneReply: string;
    changesTitle: (n: number) => string;
    changeShapes: (n: number) => string;
    changeLinks: (n: number) => string;
    changeLayout: string;
    chips: string[];
    inputPlaceholder: string;
    nodes: (n: number) => string;
    connections: (n: number) => string;
    autosave: string;
    zoom: string;
  };
  forYourTeam: string;
  impact: { hero: Point[]; examples: Point[]; editor: Point[]; pricing: Point[] };
  how: {
    title: string;
    intro: string;
    inputs: (Point & { read: string })[];
    outputs: Point[];
    steps: string[];
    status: string[];
    pause: string;
    play: string;
  };
  examples: {
    title: string;
    intro: string;
    tabs: Record<"flow" | "arch" | "data", { label: string; blurb: string }>;
    dragExplore: string;
    dragMove: string;
    all: string;
    use: string;
    loading: string;
    categories: Record<string, string>;
  };
  editor: {
    title: string;
    intro: string;
    ask: Point;
    missing: Point;
    types: { title: (n: number) => string; body: string };
    share: Point & { rows: [string, string, string] };
  };
  pricing: {
    title: string;
    intro: string;
    recommended: string;
    plans: { name: string; unit: string; blurb: string; cta: string; features: string[] }[];
    enterprise: Point & { contact: string };
  };
  faq: { title: string; items: { q: string; a: string }[] };
  closing: { title: string; body: string };
}

const en: LandingCopy = {
  nav: {
    how: "How it works",
    examples: "Examples",
    pricing: "Pricing",
    faq: "FAQ",
    login: "Log in",
    signUp: "Create a free account",
    startFree: "Start free",
  },
  lang: { label: "Language" },
  theme: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  hero: {
    line1: "Describe a process.",
    line2: "Get a diagram you can edit.",
    sub: "Kumnous turns a sentence into a flowchart, architecture or data-flow diagram, lays it out cleanly, and changes it when you ask.",
    seeExamples: "See example diagrams",
    small: "Free to start. Exports to PNG, SVG and PDF.",
  },
  demo: {
    tag: "Process",
    share: "Share",
    exportLabel: "Export",
    drew: (s, l) => `Drew ${s} shapes and ${l} connectors.`,
    drawing: (i, n) => `Drawing shape ${i} of ${n}…`,
    tabsLabel: "Ways to start",
    tabPrompt: "Type a prompt",
    tabSketch: "Upload a sketch",
    askFirst: "A couple of quick questions so the diagram comes out right:",
    drawingYours: "Drawing your diagram…",
    dropHint: "Drop a photo or sketch",
    reading: (found) => `Reading the sketch, ${found} ${found === 1 ? "box" : "boxes"} found…`,
    readDone: (b, a) => `Found ${b} boxes and ${a} arrows.`,
    rebuilding: "Rebuilding it as an editable diagram…",
    uploading: "Uploading sketch",
    readingBoard: "Reading the sketch",
    generating: "Generating diagram",
    saved: "Saved",
    importLabel: "Import",
    autoLayout: "Auto Layout",
    direction: "Direction",
    fit: "Fit Canvas",
    panelSub: "Describe, generate, and improve your diagram.",
    doneReply: "Here's your diagram. Ask for any change.",
    changesTitle: (n) => `${n} changes`,
    changeShapes: (n) => `Added ${n} shapes`,
    changeLinks: (n) => `Connected ${n} links`,
    changeLayout: "Laid it out left to right",
    chips: ["Add a rejection path", "Make it top-down", "Explain this"],
    inputPlaceholder: "Change something, ask a question, or get ideas…",
    nodes: (n) => `${n} nodes`,
    connections: (n) => `${n} connections`,
    autosave: "Auto-save enabled",
    zoom: "Zoom 100%",
  },
  forYourTeam: "For your team",
  impact: {
    hero: [
      {
        title: "Documentation that keeps up",
        body: "A first draft of a process takes about a minute, so it gets written while the details are still fresh.",
      },
      {
        title: "No bottleneck on one person",
        body: "Anyone who can describe the work can produce the diagram, not just the colleague who knows the drawing software.",
      },
      {
        title: "Faster agreement",
        body: "A clear picture in the meeting settles questions that otherwise take a thread of emails.",
      },
    ],
    examples: [
      {
        title: "One tool for every team",
        body: "Operations maps processes, IT documents systems and data teams show pipelines, all with the same look.",
      },
      {
        title: "Fewer licences to manage",
        body: "Process, architecture and data diagrams share one subscription instead of a tool for each.",
      },
      {
        title: "Easier onboarding",
        body: "New staff learn how work flows from a diagram they can read in minutes.",
      },
    ],
    editor: [
      {
        title: "Gaps caught before sign-off",
        body: "Dead ends and missing rejection paths are flagged while the process is still a draft.",
      },
      {
        title: "Diagrams that stay current",
        body: "A change takes one sentence, so updating the diagram when the process changes doesn't get skipped.",
      },
      {
        title: "Ready for audits and handovers",
        body: "Consistent PNG, SVG and PDF exports drop straight into SOPs, proposals and compliance documents.",
      },
    ],
    pricing: [
      {
        title: "Pay as you go",
        body: "Buy credits once and use them whenever you need. No subscription to cancel.",
      },
      { title: "Start small", body: "Try it free with real work, then top up only when you need more." },
      {
        title: "Your data stays yours",
        body: "On-premise keeps sensitive process and system information inside your own network.",
      },
    ],
  },
  how: {
    title: "How it works",
    intro: "Start from a sentence, a photo of a sketch or a template. Kumnous reads it, picks the right kind of diagram, draws it, then lays it out and checks it before you see it. Pick an input or a step to follow one run.",
    inputs: [
      { title: "A sentence", body: "Typed into the copilot", read: "Reading your request" },
      { title: "A photo or sketch", body: "Whiteboard, napkin or screenshot", read: "Reading the sketch" },
      { title: "A template", body: "From the template library", read: "Opening the template" },
    ],
    outputs: [
      { title: "Editable diagram", body: "7 shapes and 6 connectors on your canvas" },
      { title: "Checked for gaps", body: "Dead ends, missing branches, overlaps" },
      { title: "Export or share", body: "PNG, SVG, PDF or a link" },
    ],
    steps: ["Read", "Choose type", "Draw", "Lay out and check", "Ready"],
    status: [
      "",
      "Choosing the diagram type",
      "Drawing shapes and connectors",
      "Laying out and checking",
      "Ready to edit",
    ],
    pause: "Pause",
    play: "Play",
  },
  examples: {
    title: "What it draws",
    intro: "Every built-in template, laid out by the same engine the editor uses. Pick one to open it on the canvas, then drag to look around it.",
    tabs: {
      flow: {
        label: "Process flow",
        blurb: "Decisions, branches and hand-offs, laid out so the happy path reads left to right.",
      },
      arch: {
        label: "Architecture",
        blurb: "Services, databases and queues, with connectors that route around shapes instead of through them.",
      },
      data: {
        label: "Data flow",
        blurb: "Follow a record from source to dashboard and see every transformation in between.",
      },
    },
    dragExplore: "Drag to explore",
    dragMove: "Drag to move around",
    all: "All",
    use: "Use this template",
    loading: "Loading templates…",
    categories: {
      business: "Business",
      it: "IT & Software",
      data: "Data",
      project: "Project Management",
      logistics: "Logistics",
    },
  },
  editor: {
    title: "Working in the editor",
    intro: "The AI does the first draft. You stay in control of every shape after that.",
    ask: {
      title: "Edit by asking",
      body: "Ask for a change in plain words. The copilot edits the diagram you already have instead of starting over.",
    },
    missing: {
      title: "Catches what's missing",
      body: "Overlapping connectors, dead ends and missing branches are flagged, with a fix you can apply in one click.",
    },
    types: {
      title: (n) => `${n} diagram types`,
      body: "Each type has its own shapes and layout rules, so a sequence diagram doesn't come out looking like a flowchart.",
    },
    share: {
      title: "Share or export",
      body: "Hand a diagram off as an image, a document or a link.",
      rows: ["PNG or SVG image", "PDF handout", "Share link"],
    },
  },
  pricing: {
    title: "Pricing",
    intro: "Every account gets the full editor. You only pay for AI: buy credits once with KHQR, and use them whenever you like. No subscription.",
    recommended: "Best value",
    plans: [
      {
        name: "Dot",
        unit: "",
        blurb: "Try it with real work. No card needed.",
        cta: "Create a free account",
        features: [
          "20 free credits when you sign up",
          "Full editor and all 11 diagram types",
          "PNG, SVG and PDF export",
          "Share links",
        ],
      },
      {
        name: "Line",
        unit: "one-time",
        blurb: "For the occasional diagram and quick revisions.",
        cta: "Get Line",
        features: [
          "100 credits",
          "3¢ per credit",
          "Credits never expire",
          "Pay by KHQR: ABA, ACLEDA, Wing and more",
        ],
      },
      {
        name: "Shape",
        unit: "one-time",
        blurb: "For people who diagram every week.",
        cta: "Get Shape",
        features: [
          "400 credits",
          "2.25¢ per credit, the best rate",
          "Credits never expire",
          "Pay by KHQR: ABA, ACLEDA, Wing and more",
        ],
      },
    ],
    enterprise: {
      title: "Masterpiece: larger needs and on-premise",
      body: "Run Kumnous on your own server with your own AI key, so process data never leaves your network. Includes custom templates, setup, training and support.",
      contact: "Contact us",
    },
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "Do I have to draw anything myself?",
        a: "No. Describe the process or system in a sentence and Kumnous places the shapes and connectors. You can still drag, restyle and rewire anything afterwards.",
      },
      {
        q: "Can I change a diagram after it's drawn?",
        a: "Yes, two ways. Edit directly on the canvas, or ask the copilot, for example “add a manager approval before the card is charged”, and it edits the diagram in place.",
      },
      {
        q: "What diagram types are supported?",
        a: "Process flows, swimlanes, architecture, network, sequence, entity-relationship, data flow, org charts, mind maps, trees and circle diagrams. There are ready-made templates for the common ones.",
      },
      {
        q: "How do I get a diagram out of Kumnous?",
        a: "Export it as PNG, SVG or PDF, or send a share link so someone else can open it.",
      },
      {
        q: "What does a credit buy?",
        a: "Generating a diagram, or one change from the copilot, costs 1 credit. Reading a sketch or photo, or writing documentation, costs 2. Moving shapes, restyling, exporting, and the automatic layout and checks are free.",
      },
      {
        q: "What happens if I run out of credits?",
        a: "Nothing is locked. You can keep editing and exporting by hand, and top up any time by scanning a KHQR code with ABA, ACLEDA, Wing or any Bakong app. Credits never expire.",
      },
    ],
  },
  closing: {
    title: "Describe the process you're working on now.",
    body: "Every new account gets 20 free credits and the full editor.",
  },
};

const km: LandingCopy = {
  nav: {
    how: "របៀបដំណើរការ",
    examples: "ឧទាហរណ៍",
    pricing: "តម្លៃ",
    faq: "សំណួរញឹកញាប់",
    login: "ចូលគណនី",
    signUp: "បង្កើតគណនីឥតគិតថ្លៃ",
    startFree: "ចាប់ផ្តើមឥតគិតថ្លៃ",
  },
  lang: { label: "ភាសា" },
  theme: { toLight: "ប្តូរទៅពន្លឺភ្លឺ", toDark: "ប្តូរទៅពន្លឺងងឹត" },
  hero: {
    line1: "រៀបរាប់ដំណើរការ។",
    line2: "ទទួលបានដ្យាក្រាមដែលអ្នកអាចកែបាន។",
    sub: "Kumnous បំប្លែងប្រយោគមួយទៅជាគំនូសតាងលំហូរ ស្ថាបត្យកម្ម ឬលំហូរទិន្នន័យ រៀបចំវាឱ្យស្អាត ហើយកែប្រែវាពេលអ្នកស្នើ។",
    seeExamples: "មើលដ្យាក្រាមឧទាហរណ៍",
    small: "ចាប់ផ្តើមដោយឥតគិតថ្លៃ។ នាំចេញជា PNG, SVG និង PDF។",
  },
  demo: {
    tag: "ដំណើរការ",
    share: "ចែករំលែក",
    exportLabel: "នាំចេញ",
    drew: (s, l) => `បានគូរ ${s} រាង និង ${l} ខ្សែភ្ជាប់។`,
    drawing: (i, n) => `កំពុងគូររាងទី ${i} នៃ ${n}…`,
    tabsLabel: "វិធីចាប់ផ្តើម",
    tabPrompt: "វាយសំណើ",
    tabSketch: "បង្ហោះគំនូរព្រាង",
    askFirst: "សំណួរខ្លីៗពីរបី ដើម្បីឱ្យដ្យាក្រាមចេញមកត្រឹមត្រូវ៖",
    drawingYours: "កំពុងគូរដ្យាក្រាមរបស់អ្នក…",
    dropHint: "ទម្លាក់រូបថត ឬគំនូរព្រាងនៅទីនេះ",
    reading: (found) => `កំពុងអានគំនូរព្រាង រកឃើញ ${found} ប្រអប់…`,
    readDone: (b, a) => `រកឃើញ ${b} ប្រអប់ និង ${a} ព្រួញ។`,
    rebuilding: "កំពុងបង្កើតវាឡើងវិញជាដ្យាក្រាមដែលកែបាន…",
    uploading: "កំពុងបង្ហោះគំនូរព្រាង",
    readingBoard: "កំពុងអានគំនូរព្រាង",
    generating: "កំពុងបង្កើតដ្យាក្រាម",
    saved: "បានរក្សាទុក",
    importLabel: "នាំចូល",
    autoLayout: "រៀបប្លង់ស្វ័យប្រវត្តិ",
    direction: "ទិសដៅ",
    fit: "ពង្រីកឱ្យពេញ",
    panelSub: "រៀបរាប់ បង្កើត និងកែលម្អដ្យាក្រាមរបស់អ្នក។",
    doneReply: "នេះជាដ្យាក្រាមរបស់អ្នក។ ស្នើការផ្លាស់ប្តូរណាមួយក៏បាន។",
    changesTitle: (n) => `ការផ្លាស់ប្តូរ ${n}`,
    changeShapes: (n) => `បានបន្ថែម ${n} រាង`,
    changeLinks: (n) => `បានភ្ជាប់ ${n} ខ្សែ`,
    changeLayout: "បានរៀបប្លង់ពីឆ្វេងទៅស្តាំ",
    chips: ["បន្ថែមផ្លូវបដិសេធ", "ប្តូរទៅពីលើចុះក្រោម", "ពន្យល់ដ្យាក្រាមនេះ"],
    inputPlaceholder: "កែអ្វីមួយ សួរសំណួរ ឬរកគំនិត…",
    nodes: (n) => `${n} រាង`,
    connections: (n) => `${n} ខ្សែភ្ជាប់`,
    autosave: "រក្សាទុកស្វ័យប្រវត្តិ",
    zoom: "ពង្រីក 100%",
  },
  forYourTeam: "សម្រាប់ក្រុមរបស់អ្នក",
  impact: {
    hero: [
      {
        title: "ឯកសារដែលទាន់ពេល",
        body: "សេចក្តីព្រាងដំបូងនៃដំណើរការចំណាយពេលប្រហែលមួយនាទី ដូច្នេះវាត្រូវបានសរសេរខណៈព័ត៌មានលម្អិតនៅថ្មីៗ។",
      },
      {
        title: "មិនពឹងលើមនុស្សតែម្នាក់",
        body: "អ្នកណាក៏ដោយដែលអាចរៀបរាប់ការងារ អាចបង្កើតដ្យាក្រាមបាន មិនមែនតែអ្នកដែលចេះប្រើកម្មវិធីគូរប៉ុណ្ណោះទេ។",
      },
      {
        title: "ឯកភាពគ្នាលឿនជាងមុន",
        body: "រូបភាពច្បាស់លាស់ក្នុងកិច្ចប្រជុំ ដោះស្រាយសំណួរដែលបើមិនដូច្នោះទេ ត្រូវការអ៊ីមែលឆ្លើយឆ្លងជាច្រើន។",
      },
    ],
    examples: [
      {
        title: "ឧបករណ៍តែមួយសម្រាប់គ្រប់ក្រុម",
        body: "ផ្នែកប្រតិបត្តិការគូសផែនទីដំណើរការ ផ្នែក IT ចងក្រងប្រព័ន្ធ ហើយក្រុមទិន្នន័យបង្ហាញលំហូរទិន្នន័យ ទាំងអស់មានរូបរាងដូចគ្នា។",
      },
      {
        title: "អាជ្ញាប័ណ្ណតិចជាងមុន",
        body: "ដ្យាក្រាមដំណើរការ ស្ថាបត្យកម្ម និងទិន្នន័យ ប្រើការជាវតែមួយ ជំនួសឱ្យឧបករណ៍ដាច់ៗសម្រាប់នីមួយៗ។",
      },
      {
        title: "ណែនាំបុគ្គលិកថ្មីបានងាយ",
        body: "បុគ្គលិកថ្មីយល់ពីរបៀបដែលការងារដំណើរការ តាមរយៈដ្យាក្រាមដែលពួកគេអានបានក្នុងរយៈពេលប៉ុន្មាននាទី។",
      },
    ],
    editor: [
      {
        title: "រកឃើញចំណុចខ្វះខាតមុនពេលអនុម័ត",
        body: "ផ្លូវដែលគ្មានទិសដៅបន្ត និងផ្លូវបដិសេធដែលបាត់ ត្រូវបានសម្គាល់ ខណៈដំណើរការនៅជាសេចក្តីព្រាងនៅឡើយ។",
      },
      {
        title: "ដ្យាក្រាមដែលទាន់សម័យជានិច្ច",
        body: "ការផ្លាស់ប្តូរមួយត្រូវការតែប្រយោគមួយ ដូច្នេះការធ្វើបច្ចុប្បន្នភាពដ្យាក្រាមពេលដំណើរការផ្លាស់ប្តូរ មិនត្រូវបានរំលងទេ។",
      },
      {
        title: "រួចរាល់សម្រាប់សវនកម្ម និងការប្រគល់ការងារ",
        body: "ការនាំចេញ PNG, SVG និង PDF ដែលមានរូបរាងស្របគ្នា អាចដាក់ចូលក្នុង SOP សំណើ និងឯកសារអនុលោមភាពបានភ្លាមៗ។",
      },
    ],
    pricing: [
      {
        title: "បង់តាមការប្រើប្រាស់",
        body: "ទិញក្រេឌីតម្តង ហើយប្រើនៅពេលអ្នកត្រូវការ។ គ្មានការជាវប្រចាំខែដែលត្រូវលុបចោលទេ។",
      },
      {
        title: "ចាប់ផ្តើមពីតូច",
        body: "សាកល្បងដោយឥតគិតថ្លៃជាមួយការងារពិត បន្ទាប់មកបញ្ចូលក្រេឌីតតែនៅពេលអ្នកត្រូវការបន្ថែម។",
      },
      {
        title: "ទិន្នន័យរបស់អ្នកនៅជារបស់អ្នក",
        body: "ការដំឡើងលើម៉ាស៊ីនមេផ្ទាល់ រក្សាព័ត៌មានដំណើរការ និងប្រព័ន្ធដែលរសើប នៅក្នុងបណ្តាញរបស់អ្នក។",
      },
    ],
  },
  how: {
    title: "របៀបដំណើរការ",
    intro: "ចាប់ផ្តើមពីប្រយោគមួយ រូបថតគំនូរព្រាង ឬគំរូមួយ។ Kumnous អានវា ជ្រើសរើសប្រភេទដ្យាក្រាមដែលត្រឹមត្រូវ គូរវា រួចរៀបប្លង់ និងពិនិត្យវា មុនពេលអ្នកឃើញ។ ជ្រើសរើសធាតុចូល ឬជំហានណាមួយ ដើម្បីតាមដានមួយជុំ។",
    inputs: [
      { title: "ប្រយោគមួយ", body: "វាយបញ្ចូលក្នុងជំនួយការ AI", read: "កំពុងអានសំណើរបស់អ្នក" },
      { title: "រូបថត ឬគំនូរព្រាង", body: "ក្តារខៀន ក្រដាស ឬរូបថតអេក្រង់", read: "កំពុងអានគំនូរព្រាង" },
      { title: "គំរូមួយ", body: "ពីបណ្ណាល័យគំរូ", read: "កំពុងបើកគំរូ" },
    ],
    outputs: [
      { title: "ដ្យាក្រាមដែលកែបាន", body: "7 រាង និង 6 ខ្សែភ្ជាប់ លើផ្ទាំងគំនូររបស់អ្នក" },
      { title: "បានពិនិត្យចំណុចខ្វះខាត", body: "ផ្លូវគ្មានទិសដៅ សាខាដែលបាត់ និងការត្រួតគ្នា" },
      { title: "នាំចេញ ឬចែករំលែក", body: "PNG, SVG, PDF ឬតំណភ្ជាប់" },
    ],
    steps: ["អាន", "ជ្រើសប្រភេទ", "គូរ", "រៀបប្លង់ និងពិនិត្យ", "រួចរាល់"],
    status: [
      "",
      "កំពុងជ្រើសរើសប្រភេទដ្យាក្រាម",
      "កំពុងគូររាង និងខ្សែភ្ជាប់",
      "កំពុងរៀបប្លង់ និងពិនិត្យ",
      "រួចរាល់សម្រាប់កែសម្រួល",
    ],
    pause: "ផ្អាក",
    play: "ចាក់",
  },
  examples: {
    title: "អ្វីដែលវាគូរបាន",
    intro: "គំរូស្រាប់ទាំងអស់ រៀបប្លង់ដោយម៉ាស៊ីនដូចគ្នានឹងកម្មវិធីកែសម្រួល។ ជ្រើសរើសមួយដើម្បីបើកវាលើផ្ទាំងគំនូរ រួចអូសដើម្បីមើលជុំវិញ។",
    tabs: {
      flow: {
        label: "ដំណើរការ",
        blurb: "ការសម្រេចចិត្ត សាខា និងការប្រគល់ការងារ រៀបចំឱ្យផ្លូវសំខាន់អានពីឆ្វេងទៅស្តាំ។",
      },
      arch: {
        label: "ស្ថាបត្យកម្ម",
        blurb: "សេវាកម្ម មូលដ្ឋានទិន្នន័យ និងជួររង់ចាំ ជាមួយខ្សែភ្ជាប់ដែលឆ្លងកាត់ជុំវិញរាង ជំនួសឱ្យកាត់ចំកណ្តាល។",
      },
      data: {
        label: "លំហូរទិន្នន័យ",
        blurb: "តាមដានកំណត់ត្រាមួយពីប្រភពរហូតដល់ផ្ទាំងព័ត៌មាន ហើយមើលឃើញរាល់ការបំប្លែងនៅចន្លោះ។",
      },
    },
    dragExplore: "អូសដើម្បីរុករក",
    dragMove: "អូសដើម្បីផ្លាស់ទី",
    all: "ទាំងអស់",
    use: "ប្រើគំរូនេះ",
    loading: "កំពុងផ្ទុកគំរូ…",
    categories: {
      business: "អាជីវកម្ម",
      it: "IT និងសូហ្វវែរ",
      data: "ទិន្នន័យ",
      project: "ការគ្រប់គ្រងគម្រោង",
      logistics: "ភស្តុភារ",
    },
  },
  editor: {
    title: "ធ្វើការក្នុងកម្មវិធីកែសម្រួល",
    intro: "AI ធ្វើសេចក្តីព្រាងដំបូង។ អ្នកនៅតែគ្រប់គ្រងរាល់រាងបន្ទាប់ពីនោះ។",
    ask: {
      title: "កែដោយការស្នើ",
      body: "ស្នើការផ្លាស់ប្តូរជាពាក្យសាមញ្ញ។ ជំនួយការ AI កែដ្យាក្រាមដែលអ្នកមានស្រាប់ ជំនួសឱ្យការចាប់ផ្តើមឡើងវិញ។",
    },
    missing: {
      title: "រកឃើញអ្វីដែលខ្វះ",
      body: "ខ្សែភ្ជាប់ដែលត្រួតគ្នា ផ្លូវគ្មានទិសដៅ និងសាខាដែលបាត់ ត្រូវបានសម្គាល់ ជាមួយការជួសជុលដែលអនុវត្តបានដោយចុចតែម្តង។",
    },
    types: {
      title: (n) => `ប្រភេទដ្យាក្រាម ${n}`,
      body: "ប្រភេទនីមួយៗមានរាង និងច្បាប់រៀបប្លង់ផ្ទាល់ខ្លួន ដូច្នេះដ្យាក្រាមលំដាប់មិនចេញមកមើលទៅដូចគំនូសតាងលំហូរទេ។",
    },
    share: {
      title: "ចែករំលែក ឬនាំចេញ",
      body: "ប្រគល់ដ្យាក្រាមជារូបភាព ឯកសារ ឬតំណភ្ជាប់។",
      rows: ["រូបភាព PNG ឬ SVG", "ឯកសារ PDF", "តំណចែករំលែក"],
    },
  },
  pricing: {
    title: "តម្លៃ",
    intro: "គណនីនីមួយៗទទួលបានកម្មវិធីកែសម្រួលពេញលេញ។ អ្នកបង់ប្រាក់សម្រាប់តែ AI ប៉ុណ្ណោះ៖ ទិញក្រេឌីតម្តងតាម KHQR ហើយប្រើវានៅពេលណាក៏បាន។ គ្មានការជាវប្រចាំខែទេ។",
    recommended: "តម្លៃល្អបំផុត",
    plans: [
      {
        name: "Dot",
        unit: "",
        blurb: "សាកល្បងជាមួយការងារពិត។ មិនត្រូវការកាតទេ។",
        cta: "បង្កើតគណនីឥតគិតថ្លៃ",
        features: [
          "ក្រេឌីតឥតគិតថ្លៃ 20 នៅពេលចុះឈ្មោះ",
          "កម្មវិធីកែសម្រួលពេញលេញ និងដ្យាក្រាមទាំង 11 ប្រភេទ",
          "នាំចេញ PNG, SVG និង PDF",
          "តំណចែករំលែក",
        ],
      },
      {
        name: "Line",
        unit: "បង់ម្តង",
        blurb: "សម្រាប់ដ្យាក្រាមម្តងម្កាល និងការកែសម្រួលរហ័ស។",
        cta: "ទិញ Line",
        features: [
          "ក្រេឌីត 100",
          "3¢ ក្នុងមួយក្រេឌីត",
          "ក្រេឌីតមិនផុតកំណត់",
          "បង់តាម KHQR៖ ABA, ACLEDA, Wing និងច្រើនទៀត",
        ],
      },
      {
        name: "Shape",
        unit: "បង់ម្តង",
        blurb: "សម្រាប់អ្នកដែលគូរដ្យាក្រាមរៀងរាល់សប្តាហ៍។",
        cta: "ទិញ Shape",
        features: [
          "ក្រេឌីត 400",
          "2.25¢ ក្នុងមួយក្រេឌីត ជាតម្លៃល្អបំផុត",
          "ក្រេឌីតមិនផុតកំណត់",
          "បង់តាម KHQR៖ ABA, ACLEDA, Wing និងច្រើនទៀត",
        ],
      },
    ],
    enterprise: {
      title: "Masterpiece៖ តម្រូវការធំ និងការដំឡើងផ្ទាល់",
      body: "ដំណើរការ Kumnous លើម៉ាស៊ីនមេរបស់អ្នកផ្ទាល់ ជាមួយកូនសោ AI ផ្ទាល់ខ្លួន ដូច្នេះទិន្នន័យដំណើរការមិនចាកចេញពីបណ្តាញរបស់អ្នកឡើយ។ រួមមានគំរូតាមតម្រូវការ ការដំឡើង ការបណ្តុះបណ្តាល និងការគាំទ្រ។",
      contact: "ទាក់ទងមកយើង",
    },
  },
  faq: {
    title: "សំណួរ",
    items: [
      {
        q: "តើខ្ញុំត្រូវគូរអ្វីដោយខ្លួនឯងទេ?",
        a: "ទេ។ រៀបរាប់ដំណើរការ ឬប្រព័ន្ធក្នុងប្រយោគមួយ ហើយ Kumnous នឹងដាក់រាង និងខ្សែភ្ជាប់ឱ្យ។ អ្នកនៅតែអាចអូស ប្តូររចនាប័ទ្ម និងភ្ជាប់ឡើងវិញនូវអ្វីៗទាំងអស់បាន។",
      },
      {
        q: "តើខ្ញុំអាចកែដ្យាក្រាមបន្ទាប់ពីគូររួចបានទេ?",
        a: "បាន តាមពីរវិធី។ កែដោយផ្ទាល់លើផ្ទាំងគំនូរ ឬស្នើទៅជំនួយការ AI ឧទាហរណ៍ “add a manager approval before the card is charged” ហើយវានឹងកែដ្យាក្រាមនៅនឹងកន្លែង។",
      },
      {
        q: "តើគាំទ្រប្រភេទដ្យាក្រាមអ្វីខ្លះ?",
        a: "ដំណើរការ swimlane ស្ថាបត្យកម្ម បណ្តាញ លំដាប់ (sequence) ទំនាក់ទំនងអង្គភាព (ER) លំហូរទិន្នន័យ តារាងរចនាសម្ព័ន្ធ ផែនទីគំនិត មែកធាង និងដ្យាក្រាមរង្វង់។ មានគំរូស្រាប់សម្រាប់ប្រភេទដែលប្រើញឹកញាប់។",
      },
      {
        q: "តើខ្ញុំនាំដ្យាក្រាមចេញពី Kumnous ដោយរបៀបណា?",
        a: "នាំចេញជា PNG, SVG ឬ PDF ឬផ្ញើតំណចែករំលែក ដើម្បីឱ្យអ្នកផ្សេងបើកមើលបាន។",
      },
      {
        q: "តើក្រេឌីតមួយអាចប្រើធ្វើអ្វីបាន?",
        a: "ការបង្កើតដ្យាក្រាម ឬការកែម្តងដោយជំនួយការ AI ប្រើ 1 ក្រេឌីត។ ការអានគំនូរព្រាង ឬរូបថត ឬការសរសេរឯកសារ ប្រើ 2 ក្រេឌីត។ ការផ្លាស់ទីរាង ការប្តូររចនាប័ទ្ម ការនាំចេញ និងការរៀបប្លង់ និងការពិនិត្យដោយស្វ័យប្រវត្តិ គឺឥតគិតថ្លៃ។",
      },
      {
        q: "តើមានអ្វីកើតឡើង បើខ្ញុំប្រើក្រេឌីតអស់?",
        a: "គ្មានអ្វីត្រូវបានចាក់សោទេ។ អ្នកអាចបន្តកែ និងនាំចេញដោយដៃ ហើយបញ្ចូលក្រេឌីតបានគ្រប់ពេល ដោយស្កេន KHQR ជាមួយ ABA, ACLEDA, Wing ឬកម្មវិធី Bakong ណាមួយ។ ក្រេឌីតមិនផុតកំណត់ទេ។",
      },
    ],
  },
  closing: {
    title: "រៀបរាប់ដំណើរការដែលអ្នកកំពុងធ្វើឥឡូវនេះ។",
    body: "គណនីថ្មីនីមួយៗទទួលបានក្រេឌីតឥតគិតថ្លៃ 20 និងកម្មវិធីកែសម្រួលពេញលេញ។",
  },
};

export const COPY: Record<Lang, LandingCopy> = { en, km };

const LANG_KEY = "kumnous.lang";

/** `?lang=km` or `?lang=en` in the address wins (so a Khmer link can be
 *  shared), then the last choice made on this device, then English. */
export function storedLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "km" || fromUrl === "en") return fromUrl;
    return localStorage.getItem(LANG_KEY) === "km" ? "km" : "en";
  } catch {
    return "en";
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: the choice just won't persist */
  }
}
