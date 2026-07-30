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
        // É o único tom FRIO de uma paleta inteiramente quente (âmbar, creme,
        // marrons) — distinguível de âmbar em visão periférica, que é
        // exatamente o modo de falha sendo consertado.
        //
        // Quando o tema claro vier (#12), este token precisa de par claro.
        suggest: '#8FB4C7',
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
