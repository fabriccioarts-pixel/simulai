DROP TABLE IF EXISTS UserPermissions;
CREATE TABLE UserPermissions (
  user_id INTEGER NOT NULL,
  content_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, content_id)
);

DROP TABLE IF EXISTS Questions;
CREATE TABLE Questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id TEXT,
  discipline TEXT,
  question TEXT,
  options TEXT,
  answer TEXT,
  explanation TEXT,
  banca TEXT,
  pegadinha TEXT,
  content_id INTEGER DEFAULT 1
);

INSERT INTO Questions (original_id, discipline, question, options, answer, explanation, banca, pegadinha, content_id) VALUES ('1', 'Português', '**Texto base — Questões 01 a 04**
*"A administração pública, em sua busca incessante pela eficiência, depara-se com o desafio perene de conciliar a celeridade dos processos com a segurança jurídica que o cidadão espera. A rigidez excessiva, muitas vezes confundida com legalidade, pode converter-se em obstáculo intransponível para a entrega de serviços de qualidade. Por outro lado, a flexibilidade desmedida, sem os freios e contrapesos institucionais, abre espaço para a discricionariedade arbitrária. O ponto de equilíbrio, ainda que movediço, reside na gestão orientada por resultados, pautada pela transparência e pela participação social, que não apenas legitimam as ações do Estado, mas também as aprimoram continuamente."*

---

A ideia central do texto é que:', '[{"letra":"A","texto":"A legalidade e a eficiência são princípios antagônicos e inconciliáveis na gestão pública.","correta":false},{"letra":"B","texto":"A administração pública deve abandonar a rigidez burocrática em prol de uma flexibilidade total.","correta":false},{"letra":"C","texto":"O desafio da administração é equilibrar a agilidade processual com a segurança jurídica, por meio da gestão orientada a resultados.","correta":true},{"letra":"D","texto":"O principal obstáculo para a qualidade dos serviços públicos é a participação social, que retarda as decisões.","correta":false},{"letra":"E","texto":"A segurança jurídica é um valor superado na administração pública contemporânea, devendo ser substituída pela celeridade.","correta":false}]', 'C', 'De acordo com a regra gramatical e coerência textual, a resolução aponta para a alternativa correta: **"O desafio da administração é equilibrar a agilidade processual com a segurança jurídica, por meio da gestão orientada a resultados."**.

Verifique as palavras-chave que conectam o enunciado à resposta e anule alternativas que distorçam o conhecimento aplicado.', 'ESAF', 'A ESAF tem a tradição de usar textos densos ou alternativas com ''cascas de banana'', alterando apenas verbos ou advérbios restritivos (como ''somente'', ''sempre'', ''nunca''). Leia os distratores com atenção!', 1);
INSERT INTO Questions (original_id, discipline, question, options, answer, explanation, banca, pegadinha, content_id) VALUES ('2', 'Português', '**Texto base — Questões 01 a 04**
*"A administração pública, em sua busca incessante pela eficiência, depara-se com o desafio perene de conciliar a celeridade dos processos com a segurança jurídica que o cidadão espera. A rigidez excessiva, muitas vezes confundida com legalidade, pode converter-se em obstáculo intransponível para a entrega de serviços de qualidade. Por outro lado, a flexibilidade desmedida, sem os freios e contrapesos institucionais, abre espaço para a discricionariedade arbitrária. O ponto de equilíbrio, ainda que movediço, reside na gestão orientada por resultados, pautada pela transparência e pela participação social, que não apenas legitimam as ações do Estado, mas também as aprimoram continuamente."*

---

A palavra **"perene"** (L.1) pode ser substituída, sem alteração de sentido no contexto, por:', '[{"letra":"A","texto":"Irrelevante.","correta":false},{"letra":"B","texto":"Temporário.","correta":false},{"letra":"C","texto":"Incessante.","correta":true},{"letra":"D","texto":"Inconstante.","correta":false},{"letra":"E","texto":"Opcional.","correta":false}]', 'C', 'De acordo com a regra gramatical e coerência textual, a resolução aponta para a alternativa correta: **"Incessante."**.

Verifique as palavras-chave que conectam o enunciado à resposta e anule alternativas que distorçam o conhecimento aplicado.', 'ESAF', 'A ESAF tem a tradição de usar textos densos ou alternativas com ''cascas de banana'', alterando apenas verbos ou advérbios restritivos (como ''somente'', ''sempre'', ''nunca''). Leia os distratores com atenção!', 1);
-- (Resto das inserções...) 
-- Para economizar tempo e espaço, vou rodar o mass_insert original removendo as linhas 1 e 248 via sed se possível.
