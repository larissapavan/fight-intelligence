# Previsão de Vencedores do UFC com Machine Learning

Projeto de machine learning para prever vencedores de lutas do UFC utilizando atributos pré-luta dos atletas, engenharia de features, divisão temporal dos dados e uma aplicação interativa com Streamlit.

## Objetivos

- Treinar um modelo supervisionado para prever o vencedor da luta.
- Evitar vazamento de informação com divisão temporal dos dados.
- Construir features derivadas de diferenças entre os dois lutadores.
- Disponibilizar uma interface para explorar métricas e fazer novas previsões.

## Estrutura

```text
.
|-- app.py
|-- requirements.txt
|-- README.md
|-- data
|   |-- raw
|   `-- processed
|-- models
|-- reports
`-- src
    `-- ufc_predictor
        |-- __init__.py
        |-- config.py
        |-- data.py
        |-- features.py
        |-- modeling.py
        `-- train.py
```

## Formato esperado dos dados

O pipeline espera um CSV em `data/raw/ufc_fights.csv` com pelo menos estas colunas:

- `fight_date`
- `fighter_red`
- `fighter_blue`
- `winner`
- `red_age`, `blue_age`
- `red_height_cm`, `blue_height_cm`
- `red_reach_cm`, `blue_reach_cm`
- `red_wins`, `blue_wins`
- `red_losses`, `blue_losses`
- `red_sig_str_acc`, `blue_sig_str_acc`
- `red_takedown_acc`, `blue_takedown_acc`
- `red_stance`, `blue_stance`

Se esse arquivo não existir, o projeto gera uma base sintética para demonstração.

## Como rodar

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Treine o modelo:

```bash
python -m src.ufc_predictor.train
```

3. Inicie a aplicação:

```bash
streamlit run app.py
```

## Publicação

### GitHub

1. Crie um novo repositório no GitHub.
2. Na pasta do projeto, execute:

```bash
git add .
git commit -m "Projeto inicial de previsão UFC"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

### Streamlit Community Cloud

1. Publique o código no GitHub.
2. Acesse o Streamlit Community Cloud.
3. Escolha o repositório e selecione `app.py` como arquivo principal.
4. O app cria os artefatos automaticamente se `models/` ainda não existir.

Isso permite manter o repositório mais limpo, sem precisar versionar modelo treinado e arquivos processados.

## Pipeline

1. Carregamento dos dados e normalização básica.
2. Ordenação temporal por `fight_date`.
3. Engenharia de features baseada em diferenças, razões e indicadores de stance.
4. Split temporal em treino e teste.
5. Treinamento com `HistGradientBoostingClassifier`.
6. Geração de métricas, artefatos do modelo e relatório simples.

## Interface

A aplicação Streamlit conta com três abas:

- **Nova Previsão** — preencha os atributos dos dois lutadores e veja o vencedor previsto com probabilidade, barra comparativa e tabela de vantagens por atributo.
- **Base Processada** — visualize as primeiras linhas do dataset e a distribuição de resultados.
- **Relatório** — métricas de treinamento com opção de download.

## Observações

- O alvo é binário: `1` quando o lutador do canto vermelho vence, `0` quando o azul vence.
- O split temporal ajuda a simular melhor o cenário real de previsão.
- Para produção ou TCC, vale enriquecer os dados com estatísticas históricas acumuladas por lutador.
