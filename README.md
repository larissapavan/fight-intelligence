# 🥊 Fight Intelligence

### Plataforma Multiorganização de Inteligência Artificial e Telemetria em Esportes de Combate

[![Acessar Plataforma](https://img.shields.io/badge/Plataforma%20Online-fight--intelligence.vercel.app-C8102E?style=for-the-badge&logo=vercel&logoColor=white)](https://fight-intelligence.vercel.app/)
[![Trilíngue](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20FR-F2C230?style=for-the-badge)](https://fight-intelligence.vercel.app/)
[![Dataset no Kaggle](https://img.shields.io/badge/Kaggle-Dataset%20UFC%20(1993--2026)-20BEFF?style=for-the-badge&logo=kaggle&logoColor=white)](https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026)
[![Atualização Diária](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml/badge.svg)](https://github.com/larissapavan/fight-intelligence/actions/workflows/update-data.yml)

> O **Fight Intelligence** é uma plataforma analítica e preditiva independente desenvolvida para fãs, analistas e pesquisadores dos esportes de combate. Indo além de palpites empíricos e odds convencionais, o sistema avalia confrontos através de **46 variáveis técnicas**, calcula probabilidades de vitória estatisticamente calibradas e decompõe o racional de cada prognóstico com **SHAP (SHapley Additive exPlanations)**.

---

## 🧭 O Que a Plataforma Oferece

### 🧠 1. Preditor & Inteligência de Confrontos (Matchup Intelligence)
- **Modelagem Preditiva Calibrada:** Algoritmo `HistGradientBoostingClassifier` treinado sobre mais de 30 anos de combates oficiais, com calibração isotônica de probabilidades e avaliação bidirecional simétrica (neutralidade de córner).
- **Explicabilidade por SHAP:** Cada predição detalha quais fatores (diferencial de golpes significativos por minuto, precisão de quedas, envergadura, idade, tempo médio de luta, etc.) impulsionaram o resultado a favor do vencedor previsto.
- **Simulador Personalizado:** Permite testar combates oficiais futuros ou confrontos hipotéticos entre quaisquer atletas cadastrados.

### 🥋 2. Dossiê Editorial do Atleta (Fighter Dossier)
- **Duplo Cartel Integrado:** O cartel oficial no octógono do **UFC é exibido em grande destaque visual**, complementado pelo **cartel profissional completo de MMA**, abrangendo todas as organizações disputadas ao longo da carreira (Jungle Fight, WSOF, WEC, Strikeforce, Bellator, Cage Warriors, LFA, etc.).
- **Atributos Físicos & Biometria Oficial:** Exibição precisa de altura (cm e pés/polegadas), peso (lb e kg), envergadura (cm e polegadas), idade, status na organização e postura técnica de guarda (destro, canhoto, switch).
- **Régua Cronológica de Temporadas:** Navegação temporal horizontal que agrupa os combates ano a ano. Ao clicar em qualquer temporada, abre-se o painel detalhado de lutas com método de vitória, round, tempo de interrupção, divisão de peso e selos de disputa de cinturão linear, interino ou BMF.

### 🏆 3. Rankings Oficiais & Galeria de Campeões
- **Classificações Divisionais & Pound-for-Pound (P4P):** Rankings das categorias de peso masculinas e femininas acompanhados de taxas oficiais de vitória, recordes recentes e movimentação no plantel.
- **Histórico e Linhagem de Títulos:** Detalhamento completo dos atuais campeões, ex-campeões de cada divisão, disputas interinas e detentores de cinturões honorários.

### 📅 4. Calendário de Eventos & Histórico Round a Round
- **Cards Futuros e Passados:** Visualização cronológica dos próximos cards do UFC e de outras organizações com horários, locais e status de casamentos de luta.
- **Telemetria de Luta:** Acompanhamento de finalizações, nocautes, decisões e detalhes dos árbitros e juízes.

### 🌐 5. Ecossistema Multiorganização
Páginas e dados integrados cobrindo múltiplos cenários do MMA e esportes de combate:
- **UFC (Ultimate Fighting Championship):** Núcleo analítico principal com dataset histórico de 1993 a 2026.
- **PFL (Professional Fighters League):** Formato de torneio regular e playoffs.
- **ONE Championship:** Modalidades de MMA e Muay Thai em luvas abertas de 4oz.
- **Bellator MMA:** Acervo documental e histórico completo (2009–2023).

### 📈 6. Auditoria Pública de Acurácia (Track Record)
- **Transparência Absoluta:** As predições são geradas e congeladas no log público antes do início dos eventos.
- **Métricas Científicas:** Acurácia global, Brier Score, curva de calibração e comparação com linhas de base públicas.

### 🏢 7. Mapeamento de Centros de Treinamento (Gyms)
- Diretório de academias e equipes de elite (City Kickboxing, American Top Team, Chute Boxe Diego Lima, Nova União, Kill Cliff FC, etc.), identificando os principais atletas e treinadores afiliados.

### 🌍 8. Suporte Trilíngue Nativo
- Interface completa com troca dinâmica entre **Português Brasileiro (pt-BR)**, **Inglês (en-US)** e **Francês (fr-FR)**.

---

## 🛠️ Stack Tecnológica

| Camada | Ferramentas |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Recharts |
| **Backend & APIs** | Python, FastAPI, Uvicorn, Pydantic, SlowAPI |
| **Inteligência Artificial** | Scikit-learn (`HistGradientBoostingClassifier`, `CalibratedClassifierCV`), SHAP, Pandas, NumPy |
| **Automação & Dados** | GitHub Actions diárias, Web Scraping (BeautifulSoup), Kaggle API |

---

## 📚 Fontes de Dados e Créditos

Os dados da plataforma são consolidados, auditados e sincronizados a partir de referências públicas oficiais:
- [**UFCStats.com**](http://ufcstats.com/) & [**UFC.com**](https://www.ufc.com/rankings) — Resultados oficiais, métricas detalhadas de golpes e quedas round a round, rankings e dados do plantel.
- [**Tapology**](https://www.tapology.com/) — Cartéis completos do MMA profissional em circuitos nacionais e internacionais.
- [**Sherdog**](https://www.sherdog.com/) — Arquivo histórico de combates de carreira e biografias técnicas.
- [**Wikipedia**](https://en.wikipedia.org/) — Linhas do tempo de torneios mundiais e títulos de organizações históricas (CC BY-SA 4.0).
- [**ESPN MMA**](https://www.espn.com/mma/) & [**Next-Fight**](https://next-fight.com/) — Notícias esportivas e registros de eventos.
- [**PFL MMA**](https://pflmma.com/) & [**ONE Championship**](https://www.onefc.com/) — Estruturas de torneios, eventos e atletas.
- [**FightHub**](https://fighthub-app.com/) — Vínculo de academias e equipes mundiais.
- [**UFC Data by scarekrow (Kaggle)**](https://www.kaggle.com/datasets/scarekrow/ufc-data) — Pontuações de juízes e registros de arbitragem histórica.

---

## 👤 Autoria

Desenvolvido e mantido por **[Larissa Pavan](https://github.com/larissapavan)** ([LinkedIn](https://www.linkedin.com/in/larissacpavan/) • [Kaggle Dataset](https://www.kaggle.com/datasets/larissapavan/ufc-historical-fight-dataset-19942026)).

*Aviso: O Fight Intelligence é um projeto analítico independente e não comercial, sem afiliação oficial, patrocínio ou endosso por parte do UFC, PFL, ONE Championship, Bellator MMA ou ESPN.*
