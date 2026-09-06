import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/tanstack-react-start';
import { createUserSkill, deleteUserSkill, fetchUserSkills, setUserSkillActive, updateUserSkill, type UserSkill } from '#/lib/user-skills';

const emptyForm = { name: '', description: '', instructions: '' };

export function SkillManager() {
  const { getToken, isSignedIn } = useAuth();
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [editing, setEditing] = useState<UserSkill | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const token = await getToken();
    if (token) setSkills(await fetchUserSkills(token));
  }

  useEffect(() => { if (isSignedIn) void load(); }, [isSignedIn]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const token = await getToken();
    if (!token) return;
    try {
      await (editing ? updateUserSkill(token, editing.id, form) : createUserSkill(token, form));
      setOpen(false); setEditing(null); setForm(emptyForm); setError(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存できませんでした。'); }
  }

  async function toggle(skill: UserSkill) {
    const token = await getToken(); if (!token) return;
    await setUserSkillActive(token, skill.id, skill.status !== 'active');
    await load();
  }

  async function remove(skill: UserSkill) {
    const token = await getToken(); if (!token) return;
    await deleteUserSkill(token, skill.id);
    await load();
  }

  if (!isSignedIn) return null;
  return <section className="skill-manager">
    <div className="skill-manager-heading"><h2>My Skills</h2><button className="text-button" onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} type="button">+ New</button></div>
    {skills.map(skill => <div className="skill-row" key={skill.id}><div><strong>{skill.name}</strong><span className={`skill-status ${skill.status}`}>{skill.status}</span></div><div className="skill-actions"><button className="text-button" onClick={() => { setEditing(skill); setForm({ name: skill.name, description: skill.description, instructions: skill.instructions }); setOpen(true); }} type="button">Edit</button><button className="text-button" onClick={() => void toggle(skill)} type="button">{skill.status === 'active' ? 'Deactivate' : 'Activate'}</button><button className="text-button danger" onClick={() => void remove(skill)} type="button">Delete</button></div></div>)}
    {skills.length === 0 ? <p className="sidebar-empty">No skills yet.</p> : null}
    {open ? <form className="skill-form" onSubmit={save}><input required maxLength={100} placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input required maxLength={500} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><textarea required maxLength={50000} placeholder="Instructions (Markdown)" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /><div className="skill-form-actions"><button className="primary-button" type="submit">Save</button><button className="text-button" onClick={() => setOpen(false)} type="button">Cancel</button></div>{error ? <p className="chat-error">{error}</p> : null}</form> : null}
  </section>;
}
