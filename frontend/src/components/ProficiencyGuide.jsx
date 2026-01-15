import { getProficiencyFromScore } from '../utils/proficiencyUtils';

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
