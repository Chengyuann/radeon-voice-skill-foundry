import type {
  ActionEvent,
  AgentHarnessContract,
  AgentVerifierContract,
  TestFixture
} from "../shared/types.js";
import { stableHash } from "./hash.js";

export const MAX_AUTO_REPAIR_ATTEMPTS = 2;

const capabilityByAction: Record<
  ActionEvent["type"],
  Pick<
    AgentHarnessContract["components"]["tools"][number],
    "capability" | "sideEffect"
  >
> = {
  open_document: {
    capability: "filesystem:read:workspace/**",
    sideEffect: "read"
  },
  filter_findings: {
    capability: "filesystem:read:workspace/**",
    sideEffect: "read"
  },
  select_commitment: {
    capability: "filesystem:read:workspace/**",
    sideEffect: "read"
  },
  draft_email: {
    capability: "mail:draft",
    sideEffect: "local_write"
  },
  send_email: {
    capability: "mail:send",
    sideEffect: "external_write"
  },
  create_calendar_hold: {
    capability: "calendar:draft",
    sideEffect: "local_write"
  },
  write_report: {
    capability: "filesystem:write:workspace/reports/**",
    sideEffect: "local_write"
  }
};

export function createAgentHarnessContract(
  actions: ActionEvent[]
): AgentHarnessContract {
  const actionTypes = [...new Set(actions.map((action) => action.type))].sort();
  return {
    schemaVersion: "0.1.0",
    harnessId: "rvsf-governed-local-agent",
    components: {
      systemPolicy: {
        instructionSource: "spoken-sop-and-server-action-contract",
        completionRule: "independent-verifier-only",
        preserveExistingGuardrails: true
      },
      tools: actionTypes.map((actionType) => ({
        actionType,
        ...capabilityByAction[actionType],
        authority: "server"
      })),
      context: {
        strategy: "proof-preserving-revision-lineage",
        maxRevisions: 20,
        preserveParentProofs: true
      },
      memory: {
        strategy: "versioned-local-skill-registry",
        promotionRequired: true,
        exactReuseOnly: true
      },
      skills: {
        format: "agent-skill-markdown",
        policyFormat: "yaml"
      },
      sandbox: {
        runtime: "deterministic-review-workspace",
        externalWritesAllowed: false,
        actionEvidence: "server-authoritative"
      },
      subagents: {
        enabled: false,
        roles: []
      }
    },
    budgets: {
      maxActions: 50,
      maxConstraints: 20,
      maxFixtures: 8,
      maxAutoRepairAttempts: MAX_AUTO_REPAIR_ATTEMPTS
    }
  };
}

export function createAgentVerifierContract(
  fixtures: TestFixture[]
): AgentVerifierContract {
  return {
    schemaVersion: "0.1.0",
    verifierId: "rvsf-proof-verifier",
    checks: [
      ...fixtures.map((fixture) => ({
        id: `fixture:${fixture.name}`,
        source: "fixture" as const,
        severity: fixture.severity,
        repairable: fixtureRepairable(fixture.name),
        successCriterion: fixture.expected
      })),
      {
        id: "sandbox:replay",
        source: "sandbox",
        severity: "critical",
        repairable: false,
        successCriterion:
          "All workflow steps and adversarial probes pass in the isolated workspace"
      },
      {
        id: "sandbox:no-external-effects",
        source: "sandbox",
        severity: "critical",
        repairable: false,
        successCriterion: "External side-effect count remains zero"
      },
      {
        id: "integrity:proof-hash",
        source: "integrity",
        severity: "critical",
        repairable: false,
        successCriterion:
          "Proof binds the harness, verifier, actions, policy, skill, and runtime"
      }
    ],
    completionAuthority: "independent-verifier",
    requireAllChecks: true,
    requireZeroExternalSideEffects: true,
    hiddenChecksSupported: false,
    verifierIsolation: "server-side",
    repairPolicy: {
      maxAttempts: MAX_AUTO_REPAIR_ATTEMPTS,
      repairableCategories: ["policy", "permission"],
      manualCategories: ["voice", "sandbox", "runtime"]
    }
  };
}

export function contractHashes(input: {
  harnessContract: AgentHarnessContract;
  verifierContract: AgentVerifierContract;
}): {
  harnessContractHash: string;
  verifierContractHash: string;
} {
  return {
    harnessContractHash: stableHash(input.harnessContract),
    verifierContractHash: stableHash(input.verifierContract)
  };
}

export function ensureAgentContracts(input: {
  actions: ActionEvent[];
  fixtures: TestFixture[];
  harnessContract?: AgentHarnessContract;
  verifierContract?: AgentVerifierContract;
}): {
  harnessContract: AgentHarnessContract;
  verifierContract: AgentVerifierContract;
} {
  return {
    harnessContract:
      input.harnessContract || createAgentHarnessContract(input.actions),
    verifierContract:
      input.verifierContract || createAgentVerifierContract(input.fixtures)
  };
}

export function fixtureRepairable(name: string): boolean {
  return [
    "Automatic send is blocked",
    "Sensitive field leakage is rejected",
    "Conditional scope is enforced",
    "Missing context opens review",
    "Network write remains denied"
  ].includes(name);
}
