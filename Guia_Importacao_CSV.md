# 📚 Guia de Importação de Questões (CSV) — Simulaí

Este guia ensina como estruturar seus arquivos CSV para importar questões em massa para a plataforma Simulaí através do Painel Admin.

---

## 🛠️ Estrutura Necessária

O importador funciona baseado em **cabeçalhos**. A primeira linha do seu arquivo deve conter os nomes das colunas exatamente como mostrado abaixo.

### Colunas Suportadas (Nomes Aceitos)

| Coluna Principal | Apelidos (Aliases) | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| **question_text** | `question` | O texto do enunciado da questão | "Em que ano foi promulgada a CF?" |
| **answer1** | `a` | Texto da Alternativa A | "1988" |
| **answer2** | `b` | Texto da Alternativa B | "1967" |
| **answer3** | `c` | Texto da Alternativa C | "1946" |
| **answer4** | `d` | Texto da Alternativa D | "1891" |
| **correct_answer** | `correta` | O número da opção correta (1-4) | `1` |
| **explanation** | `explicacao` | Texto explicativo da resposta | "A Constituição Federal foi..." |
| **discipline** | `disciplina` | Matéria da questão | "Direito Constitucional" |
| **banca** | - | Nome da banca examinadora | "ESAF" |

---

## 📝 Exemplo Prático (Copie e Cole)

Você pode copiar o bloco abaixo e colar diretamente na área de importação do Admin para testar:

```csv
question,a,b,c,d,correta,explicacao,disciplina,banca
"Qual o princípio que impõe que a Administração Pública deve atuar de forma ética e honesta?","Moralidade","Publicidade","Eficiência","Legalidade",1,"O princípio da moralidade exige probidade administrativa.","Direito Administrativo","ESAF"
"Segundo a CF/88, o alistamento eleitoral e o voto são facultativos para:","Analfabetos","Maiores de 18 anos","Estrangeiros","Militares",1,"Art. 14, § 1º, II, 'a' da CF.","Direito Constitucional","ESAF"
```

---

## ⚠️ Regras de Ouro (Evite Erros)

1. **Aspas para Vírgulas Internas**: Se o seu enunciado ou resposta contiver uma vírgula (ex: `A lei, de fato, diz...`), você **deve** envolver todo o texto daquela coluna em aspas duplas: `"A lei, de fato, diz..."`.
2. **Quebras de Linha**: O importador agora suporta quebras de linha (Enter) dentro das aspas. Sinta-se livre para usar parágrafos longos no enunciado.
3. **Número da Resposta**: Use apenas o algarismo:
   - `1` = Alternativa A
   - `2` = Alternativa B
   - `3` = Alternativa C
   - `4` = Alternativa D
4. **Sem Cabeçalho, Sem Importação**: O sistema usa a primeira linha para identificar onde está cada dado. Nunca pule a linha de cabeçalho.
5. **Formato do Arquivo**: Salve como `.csv` (separado por vírgula) ou use o formato de texto simples para colar no navegador.

---

## 💡 Dicas de Produtividade

*   **Excel / Google Sheets**: Você pode montar suas questões em uma planilha e depois ir em *Arquivo > Baixar > Valores Separados por Vírgula (.csv)*. Abra esse arquivo no Bloco de Notas e cole o conteúdo no Admin.
*   **ChatGPT**: Você pode pedir ao ChatGPT: *"Converta estas 10 questões para o formato CSV com os cabeçalhos: question, a, b, c, d, correta, explicacao, disciplina"*.

---

> [!TIP]
> Se o importador mostrar "0 questões importadas", verifique se o cabeçalho está exatamente igual aos nomes permitidos acima!
