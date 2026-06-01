import { describe, expect, it } from "vitest";
import { recommendTemplate } from "./recommend-template";
import type { Role, UseCase } from "./types";

const ALL_USE_CASES: UseCase[] = [
  "ship_code",
  "manage_team",
  "personal_tasks",
  "plan_research",
  "write_publish",
  "automate_ops",
  "evaluate",
  "other",
];

const ALL_ROLES: Role[] = [
  "engineer",
  "product",
  "designer",
  "founder",
  "marketing",
  "writer",
  "research",
  "ops",
  "student",
  "other",
];

describe("recommendTemplate", () => {
  describe("engineer × use_case tiebreaker", () => {
    it.each<UseCase>(["manage_team", "automate_ops", "evaluate"])(
      "engineer × [%s] → prompt_engineer",
      (use_case) => {
        expect(
          recommendTemplate({ role: "engineer", use_case: [use_case] }),
        ).toBe("prompt_engineer");
      },
    );
    it("engineer × [plan_research] → planning", () => {
      expect(
        recommendTemplate({ role: "engineer", use_case: ["plan_research"] }),
      ).toBe("planning");
    });
    it("engineer × [write_publish] → writing", () => {
      expect(
        recommendTemplate({ role: "engineer", use_case: ["write_publish"] }),
      ).toBe("writing");
    });
    it.each<UseCase>(["ship_code", "personal_tasks", "other"])(
      "engineer × [%s] → coding",
      (use_case) => {
        expect(
          recommendTemplate({ role: "engineer", use_case: [use_case] }),
        ).toBe("coding");
      },
    );
    it("engineer × [] → coding", () => {
      expect(
        recommendTemplate({ role: "engineer", use_case: [] }),
      ).toBe("coding");
    });
  });

  describe("multi-select priority (first matching branch wins)", () => {
    // Prompt-engineering signals win over planning / writing / coding
    // fallbacks. The order inside the recommendTemplate switch is the
    // implicit priority.
    it("engineer × [ship_code, manage_team] → prompt_engineer (manage_team wins over default)", () => {
      expect(
        recommendTemplate({
          role: "engineer",
          use_case: ["ship_code", "manage_team"],
        }),
      ).toBe("prompt_engineer");
    });
    it("engineer × [write_publish, ship_code] → writing", () => {
      expect(
        recommendTemplate({
          role: "engineer",
          use_case: ["write_publish", "ship_code"],
        }),
      ).toBe("writing");
    });
    it("engineer × [manage_team, write_publish] → prompt_engineer (earlier branch wins)", () => {
      expect(
        recommendTemplate({
          role: "engineer",
          use_case: ["manage_team", "write_publish"],
        }),
      ).toBe("prompt_engineer");
    });
    it("null × [ship_code, write_publish] → coding (fallback priority)", () => {
      expect(
        recommendTemplate({
          role: null,
          use_case: ["ship_code", "write_publish"],
        }),
      ).toBe("coding");
    });
  });

  describe("product × use_case", () => {
    it.each<UseCase>(["manage_team", "automate_ops", "evaluate"])(
      "product × [%s] → prompt_engineer",
      (use_case) => {
        expect(
          recommendTemplate({ role: "product", use_case: [use_case] }),
        ).toBe("prompt_engineer");
      },
    );
    it("product × [ship_code] → coding", () => {
      expect(
        recommendTemplate({ role: "product", use_case: ["ship_code"] }),
      ).toBe("coding");
    });
    it.each<UseCase>(["plan_research", "other"])(
      "product × [%s] → planning",
      (use_case) => {
        expect(
          recommendTemplate({ role: "product", use_case: [use_case] }),
        ).toBe("planning");
      },
    );
    it("product × [] → planning", () => {
      expect(recommendTemplate({ role: "product", use_case: [] })).toBe(
        "planning",
      );
    });
  });

  describe("marketing × use_case", () => {
    it.each<UseCase>(["manage_team", "automate_ops", "evaluate"])(
      "marketing × [%s] → prompt_engineer",
      (use_case) => {
        expect(
          recommendTemplate({ role: "marketing", use_case: [use_case] }),
        ).toBe("prompt_engineer");
      },
    );
    it.each<UseCase>(["write_publish", "plan_research"])(
      "marketing × [%s] → writing",
      (use_case) => {
        expect(
          recommendTemplate({ role: "marketing", use_case: [use_case] }),
        ).toBe("writing");
      },
    );
  });

  describe("single-template roles", () => {
    it.each(ALL_USE_CASES)("writer × [%s] → writing", (use_case) => {
      expect(recommendTemplate({ role: "writer", use_case: [use_case] })).toBe(
        "writing",
      );
    });
    it.each(ALL_USE_CASES)("designer × [%s] → assistant", (use_case) => {
      expect(
        recommendTemplate({ role: "designer", use_case: [use_case] }),
      ).toBe("assistant");
    });
    it.each<UseCase>(["evaluate"])(
      "research × [%s] → prompt_engineer",
      (use_case) => {
        expect(
          recommendTemplate({ role: "research", use_case: [use_case] }),
        ).toBe("prompt_engineer");
      },
    );
    it.each<UseCase>([
      "ship_code",
      "manage_team",
      "personal_tasks",
      "plan_research",
      "write_publish",
      "automate_ops",
      "other",
    ])("research × [%s] → planning", (use_case) => {
      expect(
        recommendTemplate({ role: "research", use_case: [use_case] }),
      ).toBe("planning");
    });
    it.each<Role>(["founder", "ops"])(
      "%s × [manage_team] → prompt_engineer",
      (role) => {
        expect(recommendTemplate({ role, use_case: ["manage_team"] })).toBe(
          "prompt_engineer",
        );
      },
    );
    it.each<Role>(["founder", "ops", "student", "other"])(
      "%s × [] → assistant",
      (role) => {
        expect(recommendTemplate({ role, use_case: [] })).toBe("assistant");
      },
    );
  });

  describe("role skipped — use_case fallback", () => {
    it("null × [ship_code] → coding", () => {
      expect(recommendTemplate({ role: null, use_case: ["ship_code"] })).toBe(
        "coding",
      );
    });
    it("null × [write_publish] → writing", () => {
      expect(
        recommendTemplate({ role: null, use_case: ["write_publish"] }),
      ).toBe("writing");
    });
    it.each<UseCase>(["manage_team", "automate_ops", "evaluate"])(
      "null × [%s] → prompt_engineer",
      (use_case) => {
        expect(recommendTemplate({ role: null, use_case: [use_case] })).toBe(
          "prompt_engineer",
        );
      },
    );
    it("null × [plan_research] → planning", () => {
      expect(
        recommendTemplate({ role: null, use_case: ["plan_research"] }),
      ).toBe("planning");
    });
    it("both empty → assistant", () => {
      expect(recommendTemplate({ role: null, use_case: [] })).toBe("assistant");
    });
  });

  describe("exhaustive role coverage", () => {
    it.each(ALL_ROLES)("role=%s returns a valid template id", (role) => {
      const result = recommendTemplate({ role, use_case: [] });
      expect([
        "coding",
        "planning",
        "writing",
        "assistant",
        "prompt_engineer",
      ]).toContain(result);
    });
  });
});
