import React from 'react';

export function getProficiencyFromScore(score) {
  const s = Number(score);
  if (!s && s !== 0) return null;

  let level = 1;
  if (s >= 4.5) level = 5;
  else if (s >= 3.5) level = 4;
  else if (s >= 2.5) level = 3;
  else if (s >= 1.5) level = 2;
  else level = 1;

  const defs = {
    1: { proficiency: 'Fundamental Awareness', definition: 'Limited or basic understanding of concepts; awareness of the subject matter but lacks practical experience.' },
    2: { proficiency: 'Novice', definition: 'Basic understanding and limited experience; able to perform tasks with guidance and supervision.' },
    3: { proficiency: 'Intermediate', definition: 'Competent in the subject matter with moderate experience; can work independently with occasional guidance.' },
    4: { proficiency: 'Advanced', definition: 'Highly skilled with extensive experience; capable of handling complex tasks independently and providing guidance to others.' },
    5: { proficiency: 'Expert', definition: 'Highest level of proficiency; possesses exceptional skills, knowledge, and experience; considered a subject matter expert and may provide strategic leadership in the field.' },
  };

  return { level, ...defs[level] };
}

export default function ProficiencyTable() {
  return (
    <div className="mt-3 text-xs text-slate-700">
      <h4 className="font-semibold mb-2">Proficiency Guide</h4>
      <div className="overflow-x-auto border border-slate-200 rounded-md bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-2 py-2 text-left">Level</th>
              <th className="px-2 py-2 text-left">Proficiency</th>
              <th className="px-2 py-2 text-left">Definition</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4,5].map((lv) => {
              const p = getProficiencyFromScore(lv);
              return (
                <tr key={lv} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-semibold">{lv}</td>
                  <td className="px-2 py-2">{p.proficiency}</td>
                  <td className="px-2 py-2 text-slate-600">{p.definition}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
