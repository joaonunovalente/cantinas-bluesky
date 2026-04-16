# cantinas-bluesky

Publica as ementas das cantinas no Bluesky, com contas por cantina e com uma thread agregada na conta cantinas.pt.

## Estrutura

- `src/run-canteen.js`: lógica comum
- `src/santiago.js`, `src/crasto.js`, `src/estga.js`, `src/grelhados.js`: wrappers mínimos com configuração por cantina
- `src/cantinas.js`: publica uma thread com todas as ementas disponíveis no cantinas.pt
- `.github/workflows/post.yml`: agendamento diario no GitHub Actions

## Executar localmente

```bash
npm install
npm run post:santiago
npm run post:crasto
npm run post:estga
npm run post:grelhados
npm run post:cantinas
```

Para publicar tudo de seguida:

```bash
npm run post:all
```

Para publicar uma thread agregada com todas as ementas na conta `cantinas.pt`:

```bash
npm run post:cantinas
```

Para validar sem publicar no Bluesky:

```bash
DRY_RUN=1 npm run post:cantinas
```