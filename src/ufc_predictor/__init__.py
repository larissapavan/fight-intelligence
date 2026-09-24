<<<<<<< HEAD
"""Pacote principal do projeto de previsao de lutas do UFC."""
=======
"""Main package for the UFC fight winner prediction project."""
>>>>>>> bdb4474626da9e3848bca11d5d21a07c9ddfa99b

import os


<<<<<<< HEAD
# Evita aviso do loky em algumas instalacoes Windows sem `wmic`.
=======
# Avoid loky warnings on some Windows installations without `wmic`.
>>>>>>> bdb4474626da9e3848bca11d5d21a07c9ddfa99b
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
