// src/utils/proficiencyUtils.js
// Utility functions for proficiency level calculations

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
