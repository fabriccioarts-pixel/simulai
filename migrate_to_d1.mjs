import fs from 'fs';
import { randomUUID } from 'crypto';
import { hubData } from './src/data/hubData.js';

let sql = "BEGIN TRANSACTION;\n\n";

// Limpeza inicial
sql += "DELETE FROM Questions;\n";
sql += "DELETE FROM Quizzes;\n\n";

// Insere o Quiz Principal (ATA)
const quizId = "ata-ministerio-fazenda-v1";

sql += `INSERT INTO Quizzes (id, title, description, subject, is_premium, difficulty, is_active) VALUES ('${quizId}', 'Simulado Oficial ATA', 'Simulado completo com foco no Ministério da Fazenda, abrangendo todas as disciplinas da prova.', 'ATA-MF', 1, 'hard', 1);\n\n`;

for (let i = 0; i < hubData.quiz.length; i++) {
    const q = hubData.quiz[i];
    const id = randomUUID();
    const discipline = q.disciplina || "Geral";
    
    // As aspas simples precisam ser duplicadas no SQL (' -> '')
    const question = (q.enunciado || "").replace(/'/g, "''"); 
    const options = JSON.stringify(q.alternativas).replace(/'/g, "''");
    
    const correctAnswer = q.alternativas.find(o => o.correta);
    const answer = correctAnswer ? correctAnswer.letra : "A";
    const explanation = (q.explicacao || "").replace(/'/g, "''");
    const banca = (q.banca || "ESAF").replace(/'/g, "''");
    const pegadinha = (q.pegadinha_esaf || "").replace(/'/g, "''");
    
    sql += `INSERT INTO Questions (id, quiz_id, discipline, question, options, answer, explanation, banca, pegadinha, sort_order) VALUES ('${id}', '${quizId}', '${discipline}', '${question}', '${options}', '${answer}', '${explanation}', '${banca}', '${pegadinha}', ${i});\n`;
}

sql += "\nCOMMIT;\n";

fs.writeFileSync('./cloudflare-api/mass_insert.sql', sql);
console.log("SQL dump de " + hubData.quiz.length + " questões e 1 Quiz gerado em ./cloudflare-api/mass_insert.sql !");
