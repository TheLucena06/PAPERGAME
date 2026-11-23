# Como colaborar no PaperGame

Bem-vindo(a) ao time! O jogo fica no GitHub: https://github.com/TheLucena06/PAPERGAME
e dá pra jogar a versão mais recente aqui: https://thelucena06.github.io/PAPERGAME/

## 1. Acesso
1. Crie uma conta no GitHub (se ainda não tiver) e mande seu nome de usuário pro Lucena.
2. Ele te adiciona como colaborador; aceite o convite que chega por e-mail (ou em github.com/notifications).

## 2. Programar com o seu Claude ("vibe coding")
- No Claude (claude.ai), conecte o seu GitHub (Configurações → Conectores) e abra o repositório **PAPERGAME**
  no Claude Code (web ou app). O Claude lê o arquivo `CLAUDE.md` sozinho: lá estão as regras do projeto.
- Pode pedir em português, do jeito que você fala de jogo. Exemplo: "adiciona uma espada ★★ pro Knight que faz X".
- Peça pro Claude **criar uma branch e abrir um pull request** no final. Nunca mande direto pra `main`:
  o Lucena revisa e junta (assim o site nunca quebra).
- Um pedido = um pull request. Coisas pequenas juntam sem conflito.

## 3. Testar
- Baixe o repositório (Code → Download ZIP), descompacte e abra `index.html` no Chrome. Funciona offline.
- No menu principal, digite `debug` (no celular: toque 5x no título e digite) → **Test Dungeon**: dá pra criar
  qualquer inimigo, equipar qualquer item e escolher a fase/sala.

## 4. Arte e música
- **Sprites**: hoje tudo é desenhado com formas no código. Para arte de verdade, salve um PNG por coisa com o nome
  do item/inimigo (ex.: `runner.png`, `deadTitan_head.png`) e mande pro time; o Claude embute no jogo
  (imagens viram um arquivo .js, pra continuar funcionando offline e no arquivo único do celular).
- **Música e sons**: o jogo ainda NÃO tem sistema de áudio. Quando tiver músicas/efeitos, mande em .ogg ou .mp3
  (curtos e leves) que dá pra criar o sistema e embutir do mesmo jeito.

## 5. Ideias de classes
- Use o modelo do guia de subclasses (o doc em português que o Lucena tem). Pode escrever em português:
  o Claude constrói em inglês dentro do jogo e mantém os nomes que você escolher.
