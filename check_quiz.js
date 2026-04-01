import { hubData } from './src/data/hubData.js';
import fs from 'fs';
let groups = {}; 
hubData.quiz.forEach((q) => {
  let id = parseInt(q.id, 10);
  let group = Math.floor((id-1)/10);
  if (!groups[group]) groups[group] = [];
  groups[group].push(q.question.substring(0, 100).replace(/\n/g, ' '));
});
fs.writeFileSync('quiz_summary.txt', Object.keys(groups).map(k => `${parseInt(k)*10+1}-${(parseInt(k)*10)+10}: ${groups[k][0]}`).join('\n'));
