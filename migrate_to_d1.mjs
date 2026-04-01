import fs from 'fs';
import { hubData } from './src/data/hubData.js';

let sql = "BEGIN TRANSACTION;\n";
sql += "DROP TABLE IF EXISTS Questions;\n";
sql += "CREATE TABLE Questions (\n";
sql += "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n";
sql += "  original_id TEXT,\n";
sql += "  discipline TEXT,\n";
sql += "  question TEXT,\n";
sql += "  options TEXT,\n";
sql += "  answer TEXT,\n";
sql += "  explanation TEXT,\n";
sql += "  banca TEXT,\n";
sql += "  pegadinha TEXT,\n";
sql += "  content_id INTEGER DEFAULT 1\n";
sql += ");\n\n";

for (const q of hubData.quiz) {
    const original_id = q.id.toString();
    const discipline = q.disciplina;
    
    // As aspas simples precisam ser duplicadas no SQL (' -> '')
    const question = q.enunciado.replace(/'/g, "''"); 
    const options = JSON.stringify(q.alternativas).replace(/'/g, "''");
    
    const correctAnswer = q.alternativas.find(o => o.correta);
    const answer = correctAnswer ? correctAnswer.letra : "";
    const explanation = (q.explicacao || "").replace(/'/g, "''");
    const banca = (q.banca || "ESAF").replace(/'/g, "''");
    const pegadinha = (q.pegadinha_esaf || "").replace(/'/g, "''");
    const content_id = 1; // Default context
    
    sql += `INSERT INTO Questions (original_id, discipline, question, options, answer, explanation, banca, pegadinha, content_id) VALUES ('${original_id}', '${discipline}', '${question}', '${options}', '${answer}', '${explanation}', '${banca}', '${pegadinha}', ${content_id});\n`;
}

sql += "COMMIT;\n";

fs.writeFileSync('./cloudflare-api/mass_insert.sql', sql);
console.log("SQL dump de " + hubData.quiz.length + " questões gerado em ./cloudflare-api/mass_insert.sql !");
