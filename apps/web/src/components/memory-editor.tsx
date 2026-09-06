import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getUserMemory, updateUserMemory } from "#/lib/chat-functions";

export function MemoryEditor() {
  const getMemoryFn = useServerFn(getUserMemory);
  const updateMemoryFn = useServerFn(updateUserMemory);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    void getMemoryFn()
      .then((result) => {
        if (isMounted) setContent(result.content);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setStatus(error instanceof Error ? error.message : "Could not load memory.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [getMemoryFn]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(undefined);

    try {
      await updateMemoryFn({ data: { content } });
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save memory.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="memory-editor" aria-labelledby="memory-editor-title">
      <div className="memory-editor-heading">
        <div>
          <p className="eyebrow">Personal context</p>
          <h2 id="memory-editor-title">Your memory</h2>
        </div>
        <span className="memory-counter">{content.length.toLocaleString()} / 20,000</span>
      </div>
      <p className="memory-help">Notes here are available to the agent in every conversation.</p>
      <form onSubmit={handleSubmit}>
        <textarea
          aria-label="Your memory"
          className="memory-textarea"
          disabled={isLoading || isSaving}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add preferences, background, or instructions…"
          rows={7}
          value={content}
        />
        <div className="memory-editor-footer">
          <span className="memory-status" role="status">
            {isLoading ? "Loading…" : status}
          </span>
          <button className="memory-save-button" disabled={isLoading || isSaving} type="submit">
            {isSaving ? "Saving…" : "Save memory"}
          </button>
        </div>
      </form>
    </section>
  );
}
