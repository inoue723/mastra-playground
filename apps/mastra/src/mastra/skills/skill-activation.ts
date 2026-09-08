import { randomUUID } from "node:crypto";
import type { Processor } from "@mastra/core/processors";
import type { InlineSkill } from "@mastra/core/skills";
import { formatSkillActivation } from "@mastra/core/workspace";
import { dynamicSkills } from "./dynamic-skills";

type Activation = { id: string; skillId: string; name: string; status: "loaded" };

export function selectedSkillInstructions(skills: InlineSkill[]) {
  if (!skills.length) return "No skill is selected for this request.";
  const instructions = skills.map(formatSkillActivation).join("\n\n");
  return `The user explicitly selected the following skill for this request. Its full instructions are already loaded below; follow them without needing to call the skill tool first.\n\n${instructions}`;
}

export function createSkillActivationProcessor(resolveSkills = dynamicSkills) {
  return {
    id: "skill-activation-notification",
    async processInput({ requestContext, state, messageList }) {
      state.activations = [];
      state.notified = false;
      const skills = requestContext ? await resolveSkills({ requestContext }) : [];
      messageList.addSystem(selectedSkillInstructions(skills), "selected-skill");
      // Mastra owns this state per request and shares it with processOutputStream.
      state.activations = skills.map(
        (skill) =>
          ({
            id: randomUUID(),
            skillId: String(skill.metadata?.skillId ?? skill.name),
            name: String(skill.metadata?.displayName ?? skill.name),
            status: "loaded",
          }) satisfies Activation,
      );
      return messageList;
    },
    async processOutputStream({ part, state, writer }) {
      if (!writer || state.notified) return part;
      const activations = state.activations as Activation[] | undefined;
      if (!activations?.length) return part;
      state.notified = true;
      for (const { id, ...data } of activations) {
        // Non-transient output-processor chunks are also stored in assistant memory.
        await writer.custom({ type: "data-skill-activation", id, data });
      }
      return part;
    },
  } satisfies Processor;
}

// Stateless configuration; all mutable activation data lives in processor state.
export const skillActivationProcessor = createSkillActivationProcessor();
