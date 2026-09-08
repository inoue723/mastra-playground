import type { UIMessage } from "ai";
import { isSkillActivationPart, type SkillActivationPart } from "./skill-activation";

type SerializableMessagePart = { type: "text"; text: string } | { type: "reasoning"; text: string } | SkillActivationPart;

export function toSerializableMessages(messages: UIMessage[]) {
  return messages.map((message) => {
    const parts: SerializableMessagePart[] = [];
    for (const part of message.parts) {
      if (part.type === "text") parts.push({ type: "text", text: part.text });
      if (part.type === "reasoning") parts.push({ type: "reasoning", text: part.text });
      if (isSkillActivationPart(part)) parts.push({ type: part.type, id: part.id, data: part.data });
    }
    return { id: message.id, role: message.role, parts };
  });
}
