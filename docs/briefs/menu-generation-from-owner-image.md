# Feature Brief — Gerar Cardápio a Partir de Imagem do Dono

Status: Stage 0 — Framing
Date: 2026-03-02
Author: Orchestrator Agent

---

## Alternative Name

Importar cardápio por imagem / OCR+IA para menu JSON / Rascunho de cardápio via foto

---

## Problem

Hoje o cardápio é mantido manualmente em `data/menu.json`. Para simular o fluxo real com o dono da hamburgueria, precisamos aceitar uma imagem (foto/print/PDF convertido) e transformar isso em estrutura de menu utilizável no app.

Sem isso, atualizar cardápio continua lento e técnico, dependente de edição manual de JSON.

---

## Goal

Permitir que um usuário autenticado no admin envie imagem do cardápio, gere um **rascunho estruturado** de itens/categorias/preços e confirme antes de publicar.

Success = imagem -> rascunho estruturado -> revisão humana -> publicação no menu ativo sem editar JSON manualmente.

---

## Who

- **Burger owner / staff (logado):** Quer atualizar cardápio a partir de imagem.
- **Customers:** Devem ver apenas menu publicado e consistente.
- **Developers/operators:** Precisam de fluxo seguro/auditável com fallback quando extração falha.

---

## What We Capture / Change

- **Admin UI (`/admin`):**
  - Nova seção para upload de imagem do cardápio.
  - Tela de revisão com diff entre menu atual e rascunho extraído.
  - Ações: `Descartar`, `Editar`, `Publicar`.
- **Pipeline server-side:**
  - Recebe imagem, chama extrator (OCR/vision), normaliza para schema interno do menu.
  - Retorna rascunho com confiança/avisos por item.
- **Armazenamento de imagem (locked):**
  - Upload vai para **Supabase Storage** em bucket privado dedicado (ex.: `menu-imports`).
  - Banco persiste referência do arquivo (`bucket`, `path`, `size`, `mime`, `uploaded_by`).
- **Persistência:**
  - Armazenar rascunho (DB) separado do menu ativo.
  - Publicação aplica versão aprovada ao menu ativo.
- **Auditoria mínima:**
  - Quem enviou, quando, status do processamento, quem publicou.

---

## Success Criteria

- [ ] Apenas usuários autenticados acessam upload/geração/publicação.
- [ ] Upload de imagem gera rascunho estruturado com categorias, itens e preço quando possível.
- [ ] Fluxo não publica automaticamente: revisão humana é obrigatória antes de ativar.
- [ ] Rascunho suporta edição manual de campos inválidos/incertos.
- [ ] Publicação atualiza menu ativo usado pelo `/`.
- [ ] Falhas de extração retornam mensagens claras em pt-BR sem expor detalhes internos.
- [ ] Fluxo mantém histórico mínimo de tentativas/publicações.
- [ ] Não quebra comportamento atual de pedidos/customização.
- [ ] Upload valida formato/tamanho com limites explícitos e retorna erro pt-BR quando inválido.
- [ ] Fonte de verdade do menu ativo fica explicitamente definida e usada de forma consistente.

---

## Non-Goals (Out of Scope)

- Publicação automática sem revisão humana.
- Extração perfeita de layouts complexos/logo/fotos ruins.
- Suporte multilíngue.
- Controle avançado de versionamento com rollback por clique.
- Treinamento de modelo próprio nesta fase.

---

## Acceptance Scenarios

### Happy Paths

1. **Upload válido:** Funcionário envia imagem legível e recebe rascunho com itens/preços.
2. **Revisão e publicação:** Funcionário ajusta 1-2 campos e publica; `/` passa a exibir novo menu.
3. **Múltiplas categorias:** Extração reconhece categorias e associa itens corretamente.

### Unhappy Paths

1. **Imagem ilegível/baixa qualidade:** Sistema retorna erro orientando novo upload.
2. **Preço ambíguo:** Campo vem como pendente e exige edição manual antes de publicar.
3. **Falha de provedor OCR/vision:** Rascunho não é publicado; erro em pt-BR + log interno.
4. **Usuário não autenticado:** Acesso negado ao fluxo de importação/publicação.
5. **Arquivo inválido:** Upload com tipo não suportado ou tamanho acima do limite é rejeitado antes da extração.
6. **Carrinho com menu desatualizado:** Após publicação de novo menu, submit com item/modificador inexistente no menu ativo é rejeitado com validação pt-BR.

---

## Edge Cases

- Preço com vírgula/ponto (`25,90` vs `25.90`) e símbolo `R$`.
- Item duplicado em duas categorias.
- Texto com acentuação/abreviações (`X-Burguer`, `X Burguer`).
- Itens sem preço explícito na imagem.
- Imagem muito grande (limite de tamanho) ou formato não suportado.
- Publicações quase simultâneas de dois funcionários.
- Falha entre upload em Storage e criação do rascunho no banco (consistência).

---

## Approach (High-Level Rationale)

1. Criar fluxo admin com upload + processamento assíncrono.
2. Salvar imagem no Supabase Storage (privado) e registrar metadados + status inicial do rascunho.
3. Extrair texto/estrutura via serviço de visão/OCR e converter para schema de menu.
4. Salvar como rascunho (não ativo) para revisão humana.
5. Publicar apenas após confirmação explícita, promovendo rascunho a versão ativa.
6. Manter logs de processamento e erros para diagnóstico.

---

## Decisions (Locked)

- **Revisão humana obrigatória** antes de qualquer publicação.
- **Escopo admin-only** (sem endpoint público).
- **Armazenamento de imagem (locked):** usar Supabase Storage (bucket privado) para os uploads do dono/funcionário.
- **Fonte de verdade do menu ativo (locked):** menu ativo passa a ser lido de versão publicada no banco (não de edição manual direta em `data/menu.json` no fluxo admin).
- **Compatibilidade local:** `data/menu.json` pode permanecer como fallback de desenvolvimento/semente, mas publicação oficial do fluxo de imagem atualiza a versão ativa no banco.
- **MVP com rascunho persistido** (sem publicação automática).
- **Formato de preço canônico:** `priceCents` no resultado final.
- **Boundary do extrator (locked):** MVP usa uma implementação única de extração (um provedor de visão/OCR) atrás de interface de aplicação; sem múltiplos provedores nesta fase.
- **Contrato de falha do extrator (locked):**
  - timeout/controlado -> rascunho fica `failed`, sem afetar menu ativo
  - erro de parsing -> rascunho `ready_with_issues` para revisão manual
- **Upload constraints (locked):**
  - formatos aceitos: `image/jpeg`, `image/png`, `image/webp`
  - tamanho máximo por arquivo: `10MB`
  - quantidade: `1` imagem por rascunho nesta fase
- **Lifecycle mínimo de rascunho (locked):**
  - `uploaded` -> `processing` -> `ready` | `ready_with_issues` | `failed` -> `published` | `discarded`
- **Semântica de publicação (locked):**
  - somente um menu ativo por vez
  - publicação é troca explícita de ponteiro/versão ativa
  - falha na publicação não altera menu ativo atual
- **Impacto em carrinhos antigos (locked):** submits com `menuItemId`/modificadores não existentes no menu ativo devem falhar em validação pt-BR (fail closed), sem criar pedido.
- **Idioma de UI/mensagens:** pt-BR.
- **Falha segura:** em erro de extração, menu ativo permanece inalterado.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
