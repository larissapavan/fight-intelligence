"""Pacote principal do projeto de previsao de lutas do UFC."""

import os


# Evita aviso do loky em algumas instalacoes Windows sem `wmic`.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
