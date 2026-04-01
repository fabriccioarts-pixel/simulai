import re
import json

def extract_cronograma(content):
    weeks = []
    current_week = None
    
    # Simple regex for weeks
    week_blocks = re.split(r'### 📅 Semana (\d+)', content)
    for i in range(1, len(week_blocks), 2):
        week_num = week_blocks[i]
        week_content = week_blocks[i+1]
        
        days = []
        # Find table rows | Dia | Disciplina | Tópico | Atividade Específica |
        rows = re.findall(r'\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|', week_content)
        for d, disc, topic, act in rows:
            if d.lower() == 'dia': continue # Skip header
            days.append({
                "day": d.strip(),
                "discipline": disc.strip(),
                "topic": topic.strip(),
                "activity": act.strip()
            })
        weeks.append({"week": week_num, "days": days})
    return weeks

def extract_simulado(content):
    questions = []
    # Match: **01.** Question... \n - a) ... \n - b) ... \n Gabarito is below.
    q_blocks = re.findall(r'\*\*(\d+)\.\*\*\s+(.*?)\n((?:- .*?\n)+)', content, re.DOTALL)
    
    # Extract answers from the gabarito table at the bottom
    gabarito_text = re.search(r'# 📊 GABARITO OFICIAL.*', content, re.DOTALL).group(0)
    answers = {}
    for match in re.finditer(r'\|\s*(\d+)\s*\|\s*\*\*([A-E])\*\*\s*\|', gabarito_text):
        answers[match.group(1).lstrip('0')] = match.group(2)

    for q_num, q_text, options_text in q_blocks:
        n = q_num.lstrip('0')
        options = []
        # Find - a) Text
        opt_matches = re.findall(r'-\s+([a-e])\)\s+(.*?)\n', options_text)
        for letter, text in opt_matches:
            # Clean Bold markers from the marked correct options in MD
            clean_text = text.replace('**', '')
            options.append({"letter": letter.upper(), "text": clean_text.strip()})
        
        questions.append({
            "id": n,
            "question": q_text.strip(),
            "options": options,
            "answer": answers.get(n, ""),
            "explanation": "A ESAF cobra precisão técnica. A alternativa correta reflete a literalidade da lei ou a interpretação rigorosa do texto." # Placeholder for general explanation
        })
    return questions

def extract_apostila(content):
    sections = {}
    # Split by major # headers
    parts = re.split(r'\n# \*\*(\d+\.\s+.*?)\*\*', content)
    for i in range(1, len(parts), 2):
        title = parts[i]
        body = parts[i+1]
        sections[title] = body.strip()
    return sections

# Read files
with open('c:/Users/marke/Desktop/simulado/RaioX_ESAF_Cronograma_ATA.md', 'r', encoding='utf-8') as f:
    cron_data = extract_cronograma(f.read())

with open('c:/Users/marke/Desktop/simulado/Simulado_ATA_Ministerio_Fazenda.md', 'r', encoding='utf-8') as f:
    sim_data = extract_simulado(f.read())

# Combine into JS
hub_data = {
    "schedule": cron_data,
    "quiz": sim_data
}

output = "export const hubData = " + json.dumps(hub_data, indent=4, ensure_ascii=False) + ";"
with open('c:/Users/marke/Desktop/simulado/src/data/hubData.js', 'w', encoding='utf-8') as f:
    f.write(output)

print("Data exported successfully!")
