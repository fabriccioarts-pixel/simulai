import fs from 'fs';
import { hubData } from './src/data/hubData.js';

hubData.quiz = hubData.quiz.map(q => {
    let correta = q.alternativas.find(o => o.correta);
    
    // Fix Q15 Error
    if (q.id === 15 || q.id === "15") {
        q.alternativas.forEach(o => o.correta = false);
        const optA = q.alternativas.find(o => o.letra === "A");
        if(optA) optA.correta = true;
        q.explicacao = "[GABARITO CORRIGIDO] Segundo a 3ª edição do Manual de Redação da Presidência da República (2018), os padrões 'Memorando' e 'Aviso' foram abolidos. Toda comunicação oficial (seja interna ou externa) agora utiliza o padrão único chamado **Ofício**.";
        q.pegadinha_esaf = "Bancas usam material antigo para confundir alunos sobre o finado 'Memorando'. Memorize a extinção dele pelo MRPR de 2018.";
        return q;
    }

    // Generic dynamic explanations
    let contexto = "o conceito direto da questão";
    if (q.disciplina === "Português") contexto = "a regra gramatical e coerência textual";
    if (q.disciplina === "Informática") contexto = "o padrão técnico da ferramenta e as características de hardware/software";
    if (q.disciplina === "Administração Pública") contexto = "os princípios administrativos vigentes e o modelo constitucional";
    if (q.disciplina === "Regime Jurídico") contexto = "a literalidade da lei (ex. Lei 8.112/90) aliada à jurisprudência atual";
    if (q.disciplina.includes("Matemática")) contexto = "as propriedades numéricas e a estrutura lógica proposicional";
    if (q.disciplina === "Atualidades") contexto = "o cenário global, ambiental e geopolítico recente";

    q.explicacao = `De acordo com ${contexto}, a resolução aponta para a alternativa correta: **"${correta.texto}"**.\n\nVerifique as palavras-chave que conectam o enunciado à resposta e anule alternativas que distorçam o conhecimento aplicado.`;
    
    if (q.enunciado.includes('8.112')) q.explicacao += "\n\n💡 **Dica Extra:** Prazos, penalidades graves (demissão e cassação) e formas de provimento garantem a maioria das questões desse Título na Lei 8.112/90.";
    if (q.enunciado.includes('Acordo Ortográfico')) q.explicacao += "\n\n💡 **Dica Extra:** Foque na perda do acento em ditongos abertos paroxítonos (ideia, jiboia) e nos hiatos (voo, leem).";

    q.pegadinha_esaf = "A ESAF tem a tradição de usar textos densos ou alternativas com 'cascas de banana', alterando apenas verbos ou advérbios restritivos (como 'somente', 'sempre', 'nunca'). Leia os distratores com atenção!";

    return q;
});

const fileContent = `export const hubData = ${JSON.stringify(hubData, null, 4)};`;
fs.writeFileSync('./src/data/hubData.js', fileContent);
console.log('Explanations and fixes applied!');
