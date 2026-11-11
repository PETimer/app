# PETimer

Controle de horas em equipe: cronômetro, registros, períodos com metas e análises.
Front-end estático (HTML/CSS/JS puro) + backend em Google Apps Script com Planilha Google.

## Estrutura

```
index.html              marcação da página e ordem de carregamento
assets/icons/           favicons
css/                    estilos, um arquivo por área (ordem de carga em index.html)
js/
  config.js             URL do backend (API_URL): único arquivo a editar ao trocar de implantação
  boot/                 scripts do <head> (tema, logo, restauração de tela)
  utils/                funções compartilhadas
  core/                 API, cache/estado, sessão e navegação
  features/             login, hub de equipes, perfil, estrutura do app
  tracker/              registro de horas: formulário, cronômetro, lista, observador
  analysis/             aba Análise: filtros, metas, relatórios e exportação
  team/                 gestão de membros e equipes
  cycles/               períodos (ciclos) e progresso
  admin/                administração PETimer (master)
  ui/                   melhorias globais de interface
  main.js               ponto de entrada
```

## Como funciona o carregamento

Os scripts são clássicos (sem `type="module"`) e compartilham o escopo global,
como no arquivo único original. **A ordem das tags `<script>` em `index.html` importa**:
`config.js` e `utils/dates.js` vêm primeiro e `main.js` por último.
Ao criar um arquivo novo, adicione a tag na posição correta.

## Configuração

Edite `js/config.js` e cole a URL do Web App do Apps Script
(Implantar > Gerenciar implantações).

## Testar localmente

```
python3 -m http.server 8000
```

Abra http://localhost:8000. Abrir o `index.html` com duplo clique não funciona bem,
pois o navegador bloqueia o armazenamento local em `file://`.
