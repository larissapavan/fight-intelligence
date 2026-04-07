# Previsao de Vencedores do UFC com Machine Learning

Projeto de machine learning para prever vencedores de lutas do UFC utilizando atributos pre-luta dos atletas, engenharia de features, divisao temporal dos dados e uma aplicacao interativa com Streamlit.

## Objetivos

- Treinar um modelo supervisionado para prever o vencedor da luta.
- Evitar vazamento de informacao com divisao temporal dos dados.
- Construir features derivadas de diferencas entre os dois lutadores.
- Disponibilizar uma interface para explorar metricas e fazer novas previsoes.

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

Se esse arquivo nao existir, o projeto gera uma base sintetica para demonstracao.

## Como rodar

1. Instale as dependencias:

```bash
pip install -r requirements.txt
```

2. Treine o modelo:

```bash
python -m src.ufc_predictor.train
```

3. Inicie a aplicacao:

```bash
streamlit run app.py
```

## Publicacao

### GitHub

1. Crie um novo repositorio no GitHub.
2. Na pasta do projeto, execute:

```bash
git add .
git commit -m "Projeto inicial de previsao UFC"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

### Streamlit Community Cloud

1. Publique o codigo no GitHub.
2. Acesse o Streamlit Community Cloud.
3. Escolha o repositorio e selecione `app.py` como arquivo principal.
4. O app cria os artefatos automaticamente se `models/` ainda nao existir.

Isso permite manter o repositorio mais limpo, sem precisar versionar modelo treinado e arquivos processados.

## Pipeline

1. Carregamento dos dados e normalizacao basica.
2. Ordenacao temporal por `fight_date`.
3. Engenharia de features baseada em diferencas, razoes e indicadores de stance.
4. Split temporal em treino e teste.
5. Treinamento com `HistGradientBoostingClassifier`.
6. Geracao de metricas, artefatos do modelo e relatorio simples.

## Observacoes

- O alvo e binario: `1` quando o lutador do canto vermelho vence, `0` quando o azul vence.
- O split temporal ajuda a simular melhor o cenario real de previsao.
- Para producao ou TCC, vale enriquecer os dados com estatisticas historicas acumuladas por lutador.
