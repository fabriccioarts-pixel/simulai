import { hubData } from './src/data/hubData.js';
import fs from 'fs';
let out = hubData.quiz.map(q => {
    const correctOpt = q.alternativas.find(o => o.correta);
    return `Q${q.id} - ${q.disciplina}\nEnunciado: ${q.enunciado.substring(0, 50)}...\nResp Correta: ${correctOpt ? correctOpt.letra + ' - ' + correctOpt.texto : 'None'}\n`;
}).join('\n');
fs.writeFileSync('quiz_dump.txt', out);
