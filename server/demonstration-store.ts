import {
  createDemonstrationState,
  demonstrationReducer,
  deriveDemonstration,
  type DemonstrationCommandType
} from "../shared/demonstration.js";
import type { DemonstrationSession } from "../shared/types.js";
import { dataFile, readStoredJson, updateStoredJson } from "./file-store.js";
import { id, stableHash } from "./hash.js";

const maxRecords = 100;
const sessionsPath = () => dataFile("demonstration-sessions.json");

export async function createDemonstrationSession(): Promise<DemonstrationSession> {
  const now = new Date().toISOString();
  const session = withDerivedState({
    id: id("demo"),
    state: createDemonstrationState(),
    createdAt: now,
    updatedAt: now
  });
  return updateStoredJson(
    sessionsPath(),
    [],
    (sessions: DemonstrationSession[]) => {
      sessions.push(session);
      sessions.splice(0, Math.max(0, sessions.length - maxRecords));
      return structuredClone(session);
    }
  );
}

export async function applyDemonstrationCommand(
  idValue: string,
  type: DemonstrationCommandType
): Promise<DemonstrationSession> {
  return updateStoredJson(
    sessionsPath(),
    [],
    (sessions: DemonstrationSession[]) => {
      const index = sessions.findIndex((session) => session.id === idValue);
      if (index < 0) throw new Error("Demonstration session not found");
      const before = sessions[index];
      const command =
        type === "undo" || type === "reset"
          ? { type }
          : { type, nowMs: Date.now() };
      const state = demonstrationReducer(before.state, command);
      if (state === before.state) {
        throw new Error("Demonstration command is out of order or duplicated");
      }
      const view = deriveDemonstration(state.events);
      const now = new Date().toISOString();
      sessions[index] = withDerivedState({
        ...before,
        state,
        updatedAt: now,
        ...(view.complete && !before.completedAt ? { completedAt: now } : {}),
        ...(!view.complete ? { completedAt: undefined } : {})
      });
      return structuredClone(sessions[index]);
    }
  );
}

export async function resolveDemonstrationSession(
  idValue: string,
  requireComplete = false
): Promise<DemonstrationSession> {
  const sessions = await readStoredJson<DemonstrationSession[]>(
    sessionsPath(),
    []
  );
  const session = sessions.find((item) => item.id === idValue);
  if (!session) {
    throw new Error(
      "Demonstration session is unavailable or expired; start the workflow again"
    );
  }
  const resolved = withDerivedState(session);
  if (requireComplete && !resolved.complete) {
    throw new Error("Complete the six-step demonstration before compiling");
  }
  return structuredClone(resolved);
}

export async function demonstrationSessionCount(): Promise<number> {
  return (
    await readStoredJson<DemonstrationSession[]>(sessionsPath(), [])
  ).length;
}

function withDerivedState(
  session: Omit<DemonstrationSession, "complete" | "actionContractHash"> &
    Partial<Pick<DemonstrationSession, "complete" | "actionContractHash">>
): DemonstrationSession {
  return {
    ...session,
    complete: deriveDemonstration(session.state.events).complete,
    actionContractHash: stableHash(session.state.events)
  };
}
