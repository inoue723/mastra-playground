export type SkillActivationPart = {
  type: "data-skill-activation";
  id?: string;
  data: { skillId: string; name: string; status: "loaded" };
};

export function isSkillActivationPart(part: { type: string; data?: unknown }): part is SkillActivationPart {
  if (part.type !== "data-skill-activation" || !part.data || typeof part.data !== "object") return false;
  const data = part.data as Record<string, unknown>;
  return typeof data.skillId === "string" && typeof data.name === "string" && data.status === "loaded";
}
