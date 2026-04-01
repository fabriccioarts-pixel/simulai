import fs from 'fs';
import { hubData } from './src/data/hubData.js';

const disciplineMap = (id) => {
    const numId = parseInt(id);
    if (numId <= 20) return "Português";
    if (numId <= 30) return "Matemática e Raciocínio Lógico";
    if (numId <= 40) return "Informática";
    if (numId <= 50) return "Atualidades";
    if (numId <= 60) return "Administração Pública";
    return "Regime Jurídico";
};

hubData.quiz = hubData.quiz.map(q => {
    return {
        id: parseInt(q.id),
        disciplina: disciplineMap(q.id),
        nivel: "medio",
        banca: "ESAF",
        enunciado: q.question,
        alternativas: q.options.map(opt => ({
            letra: opt.letter,
            texto: opt.text,
            correta: opt.letter === q.answer
        })),
        explicacao: q.explanation,
        pegadinha_esaf: "Atenção aos detalhes",
        tags: [disciplineMap(q.id).toLowerCase().replace(/[ eãçõíóáú]/g, (match) => ({' ':'_','e':'e','ã':'a','ç':'c','õ':'o','í':'i','ó':'o','á':'a','ú':'u'}[match]))]
    };
});

const fileContent = `export const hubData = ${JSON.stringify(hubData, null, 4)};`;
fs.writeFileSync('./src/data/hubData.js', fileContent);
console.log('Migration complete');
