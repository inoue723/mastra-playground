import { useEffect, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { fetchUserSkills, type UserSkill } from "#/lib/user-skills";

export function SkillPicker({ value, onChange, disabled }: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { getToken, userId } = useAuth();
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Please sign in again.");
        const available = await fetchUserSkills(token, "active");
        if (!cancelled) setSkills(available);
      } catch {
        if (!cancelled) setError("スキルを取得できませんでした。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, userId, refresh]);
  const selected = skills.find(skill => skill.id === value);

  return (
    <div className="skill-picker">
      <label>
        使用するスキル
        <select disabled={disabled || loading} value={value} onChange={event => onChange(event.target.value)}>
          <option value="">{loading ? "読み込み中…" : "選択なし"}</option>
          {value && !selected ? <option value={value}>{loading ? "選択したスキルを確認中…" : "選択したスキルは利用できません"}</option> : null}
          {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={disabled || loading} onClick={() => setRefresh(current => current + 1)}>一覧を更新</button>
      <span role="status">
        {error || (loading ? "" : selected ? selected.description : value ? "別のスキルを選ぶか、選択を解除してください。" : skills.length ? "選択したスキルを各送信で使用します。" : "有効なスキルがありません。Skillsから有効にしてください。")}
      </span>
    </div>
  );
}
