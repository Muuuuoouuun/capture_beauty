import type { Tool } from "@/lib/types";

export const tools: Tool[] = [
  {
    id: "d41f50a2-3b7c-4f7e-8c73-1b8d0b0fe21a",
    name: "Notion",
    description: "A modular workspace for docs, tasks, and lightweight databases.",
    problemContexts: [
      "I have scattered tasks",
      "Our knowledge lives in too many places",
      "I need a single home for projects"
    ],
    whyExist: "Teams outgrew shared folders and needed a living system that blends notes, tasks, and knowledge.",
    impact: {
      judgmentSpeed: 6,
      thinkingDepth: 7,
      executionDensity: 6,
      collaborationClarity: 5
    },
    bestCase:
      "Creates a shared mental model where priorities are visible, and decision history is preserved without friction.",
    worstCase:
      "Becomes a sprawling wiki where everything is documented but nothing is decided.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: true
    },
    alternatives: ["Linear + Google Docs", "Plain markdown + Git"],
    createdAt: "2024-02-01T10:00:00Z",
    updatedAt: "2024-02-01T10:00:00Z"
  },
  {
    id: "55d7ad1a-4c1c-4e58-a2d6-40a00d092e2a",
    name: "Figma",
    description: "Collaborative design and prototyping platform.",
    problemContexts: [
      "Design feedback loops are too slow",
      "We need shared product thinking",
      "Cross-functional alignment is drifting"
    ],
    whyExist: "Product teams needed design work to be collaborative, not serialized or locked on desktops.",
    impact: {
      judgmentSpeed: 7,
      thinkingDepth: 6,
      executionDensity: 8,
      collaborationClarity: 9
    },
    bestCase:
      "Turns design into a shared conversation, reducing misinterpretation across product, engineering, and leadership.",
    worstCase:
      "Creates a flood of feedback without clear ownership, slowing decisions behind a wall of comments.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: false,
      lockinRisk: true
    },
    alternatives: ["Pen + paper workshops", "Adobe XD"],
    createdAt: "2024-02-02T10:00:00Z",
    updatedAt: "2024-02-02T10:00:00Z"
  },
  {
    id: "ef6b79b4-7c1e-4df0-95f1-9011f412e1cb",
    name: "Slack",
    description: "Real-time team communication hub.",
    problemContexts: [
      "Team communication breaks",
      "Important context is lost in email",
      "We need faster coordination"
    ],
    whyExist: "Work moved too fast for email, requiring a shared space for quick coordination and context.",
    impact: {
      judgmentSpeed: 8,
      thinkingDepth: 4,
      executionDensity: 7,
      collaborationClarity: 6
    },
    bestCase:
      "Accelerates alignment by keeping signals visible and reducing waiting cycles.",
    worstCase:
      "Turns into a constant interrupt stream that erodes deep work and reasoning.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: true
    },
    alternatives: ["Twist", "Async standups + email"],
    createdAt: "2024-02-03T10:00:00Z",
    updatedAt: "2024-02-03T10:00:00Z"
  },
  {
    id: "f33e7f82-0d1c-4f57-9c5f-9a8e8e251e88",
    name: "Linear",
    description: "Issue tracking built for fast product teams.",
    problemContexts: [
      "We lose track of what matters",
      "Product execution is noisy",
      "We need tighter planning"
    ],
    whyExist: "Classic ticketing tools slowed modern teams; speed and clarity became a competitive advantage.",
    impact: {
      judgmentSpeed: 7,
      thinkingDepth: 5,
      executionDensity: 8,
      collaborationClarity: 7
    },
    bestCase:
      "Creates a crisp system of record so everyone knows what is shipping and why.",
    worstCase:
      "Optimizes throughput while masking deeper product uncertainty.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: false,
      lockinRisk: false
    },
    alternatives: ["Trello", "Shortcut"],
    createdAt: "2024-02-04T10:00:00Z",
    updatedAt: "2024-02-04T10:00:00Z"
  },
  {
    id: "58dc3f0a-6e9d-4f21-a7c5-2e2186a42e8f",
    name: "Airtable",
    description: "Flexible database-spreadsheet hybrid for operations and knowledge.",
    problemContexts: [
      "We need lightweight internal tools",
      "Data lives in too many spreadsheets",
      "Operations are ad-hoc"
    ],
    whyExist: "Teams wanted the power of databases without engineering effort or rigid schemas.",
    impact: {
      judgmentSpeed: 6,
      thinkingDepth: 6,
      executionDensity: 6,
      collaborationClarity: 5
    },
    bestCase:
      "Empowers non-engineers to build structured workflows quickly.",
    worstCase:
      "Turns into a brittle patchwork that is hard to govern or scale.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: true
    },
    alternatives: ["Google Sheets + AppScript", "Retool"],
    createdAt: "2024-02-05T10:00:00Z",
    updatedAt: "2024-02-05T10:00:00Z"
  },
  {
    id: "a1aa1f1d-67f8-4dbd-aec0-2ed51b932d0a",
    name: "Miro",
    description: "Collaborative whiteboard for workshops and ideation.",
    problemContexts: [
      "Workshops feel flat",
      "Remote brainstorming lacks energy",
      "Strategy is hard to visualize"
    ],
    whyExist: "Remote teams needed a shared space to think visually and co-create in real time.",
    impact: {
      judgmentSpeed: 5,
      thinkingDepth: 7,
      executionDensity: 4,
      collaborationClarity: 7
    },
    bestCase:
      "Makes abstract thinking visible, enabling better alignment before execution.",
    worstCase:
      "Generates a mess of sticky notes without converging decisions.",
    verdictBadges: {
      timeSaver: false,
      thinkCarefully: true,
      lockinRisk: false
    },
    alternatives: ["Physical workshops", "FigJam"],
    createdAt: "2024-02-06T10:00:00Z",
    updatedAt: "2024-02-06T10:00:00Z"
  },
  {
    id: "b559d3ef-7c52-4ed0-9e84-2f5b1a9775b4",
    name: "Zapier",
    description: "Automation platform connecting apps without code.",
    problemContexts: [
      "Manual handoffs slow us down",
      "We need quick automation without engineering",
      "Data entry is repetitive"
    ],
    whyExist: "Teams needed automation without waiting for developer bandwidth.",
    impact: {
      judgmentSpeed: 7,
      thinkingDepth: 4,
      executionDensity: 9,
      collaborationClarity: 5
    },
    bestCase:
      "Eliminates low-value work and keeps ops moving without bottlenecks.",
    worstCase:
      "Creates fragile automation chains no one owns when they break.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: true
    },
    alternatives: ["Make", "n8n"],
    createdAt: "2024-02-07T10:00:00Z",
    updatedAt: "2024-02-07T10:00:00Z"
  },
  {
    id: "6b6f9d15-0a05-4c34-8a6b-4d6b5a6ae7ea",
    name: "Jasper",
    description: "AI writing assistant for marketing and content teams.",
    problemContexts: [
      "Content backlog grows too fast",
      "Brand voice is inconsistent",
      "We need faster drafts"
    ],
    whyExist: "Marketing teams needed to scale content without sacrificing velocity.",
    impact: {
      judgmentSpeed: 8,
      thinkingDepth: 3,
      executionDensity: 7,
      collaborationClarity: 4
    },
    bestCase:
      "Speeds up first drafts so humans can focus on strategic edits.",
    worstCase:
      "Encourages shallow copy that feels generic and drains brand nuance.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: false
    },
    alternatives: ["Human editorial sprints", "Grammarly"],
    createdAt: "2024-02-08T10:00:00Z",
    updatedAt: "2024-02-08T10:00:00Z"
  },
  {
    id: "d07d34fb-2cd2-4fcb-95dd-e1fceaa52d27",
    name: "Gong",
    description: "Revenue intelligence platform for sales conversations.",
    problemContexts: [
      "Sales calls feel like black boxes",
      "Coaching relies on anecdotes",
      "We need better deal visibility"
    ],
    whyExist: "Sales leaders needed data-driven coaching and visibility beyond CRM notes.",
    impact: {
      judgmentSpeed: 6,
      thinkingDepth: 6,
      executionDensity: 6,
      collaborationClarity: 7
    },
    bestCase:
      "Turns qualitative conversations into coaching signals that improve deal outcomes.",
    worstCase:
      "Creates a surveillance feeling that erodes trust and authenticity.",
    verdictBadges: {
      timeSaver: false,
      thinkCarefully: true,
      lockinRisk: true
    },
    alternatives: ["Manual call reviews", "Chorus"],
    createdAt: "2024-02-09T10:00:00Z",
    updatedAt: "2024-02-09T10:00:00Z"
  },
  {
    id: "e357c35d-bfd4-4c14-aad0-9910de98837f",
    name: "Replit",
    description: "Browser-based development environment with AI copilots.",
    problemContexts: [
      "We need quick prototypes",
      "Onboarding engineers takes too long",
      "Learning to code feels intimidating"
    ],
    whyExist: "Developers needed instant environments without setup friction, plus AI guidance.",
    impact: {
      judgmentSpeed: 7,
      thinkingDepth: 5,
      executionDensity: 8,
      collaborationClarity: 6
    },
    bestCase:
      "Removes setup friction so ideas can be tested within minutes.",
    worstCase:
      "Encourages shipping demos without understanding underlying architecture.",
    verdictBadges: {
      timeSaver: true,
      thinkCarefully: true,
      lockinRisk: false
    },
    alternatives: ["Local dev environments", "GitHub Codespaces"],
    createdAt: "2024-02-10T10:00:00Z",
    updatedAt: "2024-02-10T10:00:00Z"
  }
];
