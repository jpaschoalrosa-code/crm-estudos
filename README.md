# CRM de Estudos

Este projeto e um CRM simples para plano de estudo.

## O que significa CRM aqui

CRM normalmente significa `Customer Relationship Management`, ou seja, um sistema para acompanhar relacionamento e progresso.

Neste projeto, usamos a mesma ideia para estudos:

- `subjects`: materias que voce acompanha
- `tasks`: tarefas ligadas a cada materia
- `sessions`: registros do tempo estudado

## Por que usar API

A API e a camada que recebe pedidos da interface e devolve dados organizados.

Exemplos deste projeto:

- `GET /api/dashboard` devolve o resumo geral
- `POST /api/subjects` cria uma nova materia
- `PUT /api/tasks/2` atualiza uma tarefa

Mesmo em um projeto simples, a API ajuda porque separa:

- interface visual
- regras do sistema
- armazenamento dos dados



## Como rodar

```powershell
python server.py
```

Depois abra:

```text
http://127.0.0.1:8000
```

## Publicar no Render

O projeto ja esta preparado para deploy publico com SQLite persistente.

Arquivos usados:

- `render.yaml`: configuracao do servico
- `data/study_crm.db`: banco local
- `data/admin_access_code.txt`: codigo admin local

Para publicar:

1. Envie o projeto para um repositorio no GitHub.
2. No Render, crie um `Web Service` a partir desse repositorio.
3. Use o plano com `Persistent Disk`, porque o SQLite precisa disso.
4. Defina o segredo `STUDY_CRM_ADMIN_CODE` no painel do Render.
5. Faça o primeiro deploy.

Em producao:

- o app usa `PORT` e `HOST` automaticamente
- o banco fica em `/var/data/study_crm.db`
- o codigo admin vem da variavel `STUDY_CRM_ADMIN_CODE`

## Estrutura

- `server.py`: servidor HTTP e rotas da API
- `storage.py`: camada de persistencia em SQLite e migracao do legado
- `public/`: frontend
- `data/study_crm.db`: banco SQLite usado pelo CRM
- `data/study_crm.json`: arquivo legado usado apenas para migracao inicial

## O que mudou

- migracao do armazenamento para SQLite
- cadastro de conta e login por usuario
- login simples com cookie de sessao
- interface organizada em abas
- edicao e exclusao de materias, tarefas e sessoes
- materia so pode ficar `concluido` com 100% de progresso
