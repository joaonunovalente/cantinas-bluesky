# cantinas-bluesky

Publica as ementas das cantinas no Bluesky, com uma conta por cantina.

## Estrutura

- `src/run-canteen.js`: lógica comum
- `src/santiago.js`, `src/crasto.js`, `src/estga.js`, `src/grelhados.js`: wrappers mínimos com configuração por cantina
- `.github/workflows/post.yml`: agendamento diario no GitHub Actions

## Executar localmente

```bash
npm install
npm run post:santiago
npm run post:crasto
npm run post:estga
npm run post:grelhados
```

Para publicar tudo de seguida:

```bash
npm run post:all
```


