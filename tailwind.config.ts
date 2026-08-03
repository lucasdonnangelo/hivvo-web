import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        amber: {
          DEFAULT: '#EF9F27',
          light: '#FAC775',
          dark: '#BA7517',
        },
        bg: {
          DEFAULT: '#1A1714',
          surface: '#2A2520',
          border: '#3A3530',
        },
        text: {
          primary: '#F5F0E8',
          muted: '#888580',
        },
        success: '#3DBF7F',
        danger: '#E85D5D',
        // Marca de "o sistema propôs, você ainda não confirmou" — hoje só a
        // categoria sugerida na revisão de fatura.
        //
        // NÃO pode ser âmbar: o "✦ IA" em âmbar fez o usuário achar que a
        // categoria já estava confirmada, e âmbar aqui já significa
        // "selecionado", "paga_parcial", "estorno" e "atenção" (145 usos).
        // `success`/`danger` carregam juízo de resultado — uma sugestão não é
        // boa nem ruim, é não-confirmada. `text-muted` significa
        // "secundário/desabilitado" e mede 4,13:1 sobre bg-surface, abaixo de
        // AA para os 11px desta tela; este tom mede 6,88:1.
        //
        // É um tom FRIO numa paleta quente (âmbar, creme, marrons) —
        // distinguível de âmbar em visão periférica, que é exatamente o modo de
        // falha sendo consertado. O outro frio é `suspect`, abaixo; a distinção
        // entre os dois está documentada lá.
        //
        // Quando o tema claro vier (#12), este token precisa de par claro.
        suggest: '#8FB4C7',
        // Marca de "este campo provavelmente está ERRADO" — hoje só a data de
        // linha flagada por `data_suspeita` na revisão de fatura e de extrato.
        //
        // É um significado DIFERENTE de `suggest`. Aquele diz "o sistema propôs,
        // ninguém confirmou" (neutro: a proposta não é boa nem ruim). Este diz
        // "isto provavelmente está errado" — mais peso — sem AFIRMAR o erro: a
        // regra é heurística (data > emissão / fora do período) e nós não
        // sabemos qual é a data certa, então a cor não pode ser `danger`, que
        // afirma resultado ruim, nem `success`.
        //
        // NÃO pode ser âmbar (#44): âmbar já carrega quatro sentidos NESTA tela
        // — selecionado/foco, paga_parcial, estorno e o banner de reconciliação.
        // O quinto sentido já custou uma feature (o "✦ IA" âmbar lido como
        // "confirmado"). NÃO pode ser `suggest`: é o outro significado, e as
        // duas marcas coexistem na MESMA linha de despesa.
        //
        // CONTRASTE (medido, mesmo cálculo WCAG 2.x usado para `suggest`):
        // 7,41:1 sobre bg-surface (#2A2520) e 8,72:1 sobre bg (#1A1714). A tela
        // usa 11px nestas marcas — texto normal, então o piso é 4,5:1 (AA), não
        // 3:1. 7,41 fica ACIMA de `suggest` (6,88): o peso maior é literal, não
        // só retórico.
        //
        // Separação de `suggest`: 85° de matiz (285° contra 200°) e saturação
        // bem maior (53% contra 33%). A saturação é o que sobrevive à
        // deuteranopia, em que violeta e azul aproximam de matiz — e, mesmo
        // assim, a cor nunca é o único canal: glifo (⚑ contra ◇), rótulo e
        // posição também diferem.
        //
        // Quando o tema claro vier (#12), este token precisa de par claro.
        suspect: '#D3A5E3',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        full: '999px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
