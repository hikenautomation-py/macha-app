'use client';

// Kartu konteks task kecil yang muncul di atas form complete/problem.
// tone: 'teal' (complete) | 'coral' (problem).
export default function TaskContextCard({ judul, tone = 'teal' }) {
  return (
    <div className={`card task-context ${tone}`}>
      <p className="tc-label">Task</p>
      <p className="tc-title">{judul}</p>
    </div>
  );
}